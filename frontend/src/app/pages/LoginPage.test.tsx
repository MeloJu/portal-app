import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, vi } from "vitest";
import * as auth from "../../api/auth";
import LoginPage from "./LoginPage";

vi.mock("../../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/auth")>()),
  login: vi.fn(),
  register: vi.fn(),
}));
const login = vi.mocked(auth.login);
const register = vi.mocked(auth.register);

async function openRegister() {
  await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
}

async function fillRegister(name: string, email: string, password: string) {
  if (name) await userEvent.type(screen.getByPlaceholderText("Como podemos te chamar?"), name);
  if (email) await userEvent.type(screen.getByPlaceholderText("voce@estacao.com"), email);
  if (password) await userEvent.type(screen.getByPlaceholderText(/pelo menos 8 caracteres/i), password);
  await userEvent.click(screen.getByRole("button", { name: /criar minha estação/i }));
}

async function fillAndSubmit(email = "ana@lumi.studio", password = "segredo") {
  await userEvent.type(screen.getByPlaceholderText("voce@estacao.com"), email);
  await userEvent.type(screen.getByPlaceholderText("Digite sua senha"), password);
  await userEvent.click(screen.getByRole("button", { name: /entrar na estação/i }));
}

function renderLogin(initialEntry = "/login") {
  const router = createMemoryRouter(
    [
      { path: "/login", Component: LoginPage },
      { path: "/dashboard", element: <p>dashboard</p> },
    ],
    { initialEntries: [initialEntry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const GENERIC_OAUTH_MESSAGE = "Não foi possível entrar com o provedor. Tente novamente.";

describe("LoginPage", () => {
  // Os mocks guardam as chamadas entre testes: sem isso, um "not.toHaveBeenCalled" pega a chamada do teste anterior.
  beforeEach(() => vi.clearAllMocks());

  it("mostra erro quando e-mail ou senha estão vazios", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: /entrar na estação/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/preencha seu e-mail e sua senha/i);
    expect(login).not.toHaveBeenCalled();
  });

  it("alterna a visibilidade da senha", async () => {
    renderLogin();
    const password = screen.getByPlaceholderText("Digite sua senha");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(password).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("faz login na API e navega para o dashboard", async () => {
    login.mockResolvedValue({
      id: "u1",
      name: "Ana",
      email: "ana@lumi.studio",
      emailVerified: true,
      hasPassword: true,
    });
    const router = renderLogin();
    await fillAndSubmit();
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(login).toHaveBeenCalledWith("ana@lumi.studio", "segredo");
    expect(window.localStorage.getItem("lumi-session")).toBeNull();
  });

  it("avisa quando e-mail ou senha não conferem e continua no login", async () => {
    login.mockRejectedValue(new auth.AuthError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos"));
    const router = renderLogin();
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/não conferem/i);
    expect(router.state.location.pathname).toBe("/login");
    expect(screen.getByRole("button", { name: /entrar na estação/i })).toBeEnabled();
  });

  it("mostra a mensagem de rede quando a API não responde", async () => {
    login.mockRejectedValue(new auth.AuthError(0, "NETWORK", "Não foi possível falar com a estação."));
    renderLogin();
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível falar com a estação/i);
  });

  describe("criar conta", () => {
    it("alterna para o cadastro e mostra o campo nome", async () => {
      renderLogin();
      expect(screen.queryByPlaceholderText("Como podemos te chamar?")).not.toBeInTheDocument();
      await openRegister();
      expect(screen.getByPlaceholderText("Como podemos te chamar?")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /crie sua estação/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /criar minha estação/i })).toBeInTheDocument();
      expect(screen.queryByText("Esqueci minha senha")).not.toBeInTheDocument();
    });

    it("cadastra na API e navega para o dashboard", async () => {
      register.mockResolvedValue({
        id: "u1",
        name: "Ana",
        email: "ana@lumi.studio",
        emailVerified: true,
        hasPassword: true,
      });
      const router = renderLogin();
      await openRegister();
      await fillRegister("Ana", "ana@lumi.studio", "segredo-grande");
      await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
      expect(register).toHaveBeenCalledWith("Ana", "ana@lumi.studio", "segredo-grande");
      expect(login).not.toHaveBeenCalled();
    });

    it("mostra o conflito de e-mail vindo da API", async () => {
      register.mockRejectedValue(new auth.AuthError(409, "EMAIL_TAKEN", "E-mail já cadastrado"));
      const router = renderLogin();
      await openRegister();
      await fillRegister("Ana", "ana@lumi.studio", "segredo-grande");
      expect(await screen.findByRole("alert")).toHaveTextContent("E-mail já cadastrado");
      expect(router.state.location.pathname).toBe("/login");
      expect(screen.getByRole("button", { name: /criar minha estação/i })).toBeEnabled();
    });

    it("valida senha curta antes de chamar a API", async () => {
      renderLogin();
      await openRegister();
      await fillRegister("Ana", "ana@lumi.studio", "curta");
      expect(await screen.findByRole("alert")).toHaveTextContent("A senha precisa ter pelo menos 8 caracteres.");
      expect(register).not.toHaveBeenCalled();
    });

    it("exige o nome no cadastro", async () => {
      renderLogin();
      await openRegister();
      await fillRegister("", "ana@lumi.studio", "segredo-grande");
      expect(await screen.findByRole("alert")).toHaveTextContent(/preencha nome, e-mail e senha/i);
      expect(register).not.toHaveBeenCalled();
    });

    it("troca a validação técnica da API por uma mensagem em português", async () => {
      register.mockRejectedValue(
        new auth.AuthError(400, "VALIDATION_ERROR", "email: must be a well-formed email address"),
      );
      renderLogin();
      await openRegister();
      await fillRegister("Ana", "ana@lumi.studio", "segredo-grande");
      expect(await screen.findByRole("alert")).toHaveTextContent(/o e-mail precisa ser válido/i);
    });

    it("volta para o login com Já tenho conta, sem o erro anterior", async () => {
      renderLogin();
      await openRegister();
      await fillRegister("Ana", "ana@lumi.studio", "curta");
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Já tenho conta" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Como podemos te chamar?")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /entrar na estação/i })).toBeInTheDocument();
    });
  });

  describe("login social", () => {
    const originalLocation = window.location;
    const assign = vi.fn();

    beforeEach(() => {
      assign.mockClear();
      Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, assign } });
    });

    afterEach(() => {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    });

    it("o botão do Google navega para a rota OAuth do Google", async () => {
      renderLogin();
      await userEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));
      expect(assign).toHaveBeenCalledWith("/api/auth/oauth/google");
      expect(assign).toHaveBeenCalledTimes(1);
    });

    it("o botão do GitHub navega para a rota OAuth do GitHub", async () => {
      renderLogin();
      await userEvent.click(screen.getByRole("button", { name: "Continuar com GitHub" }));
      expect(assign).toHaveBeenCalledWith("/api/auth/oauth/github");
      expect(assign).toHaveBeenCalledTimes(1);
    });
  });

  describe("erro de OAuth na URL", () => {
    it("mostra a mensagem do e-mail não verificado e limpa o parâmetro", async () => {
      const router = renderLogin("/login?oauth_error=OAUTH_EMAIL_UNVERIFIED");
      expect(await screen.findByRole("alert")).toHaveTextContent(/e-mail no provedor ainda não foi verificado/i);
      await waitFor(() => expect(router.state.location.search).toBe(""));
      expect(router.state.location.pathname).toBe("/login");
      expect(screen.getByRole("alert")).toHaveTextContent(/não foi verificado/i);
    });

    it("usa a mensagem genérica para o erro do provedor", async () => {
      renderLogin("/login?oauth_error=OAUTH_PROVIDER_ERROR");
      expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC_OAUTH_MESSAGE);
    });

    it.each(["__proto__", "constructor", "toString", "hasOwnProperty"])(
      "nome herdado de Object.prototype (%s) cai na mensagem genérica",
      async (code) => {
        renderLogin(`/login?oauth_error=${code}`);
        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent(GENERIC_OAUTH_MESSAGE);
        expect(alert.textContent).toBe(GENERIC_OAUTH_MESSAGE);
        expect(screen.getByRole("heading", { name: "Entre na sua estação" })).toBeInTheDocument();
      },
    );

    it.each(["<img src=x onerror=alert(1)>", "Sua conta foi bloqueada, ligue 0800"])(
      "valor arbitrário (%s) mostra a genérica e nunca o texto bruto",
      async (raw) => {
        const container = document.body;
        renderLogin(`/login?oauth_error=${encodeURIComponent(raw)}`);
        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toBe(GENERIC_OAUTH_MESSAGE);
        expect(container.textContent).not.toContain(raw);
        expect(container.innerHTML).not.toContain("onerror");
      },
    );

    it("o alerta de OAuth some ao trocar para Criar conta", async () => {
      renderLogin("/login?oauth_error=OAUTH_DENIED");
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("mantém os outros parâmetros da URL depois de limpar o oauth_error", async () => {
      const router = renderLogin("/login?oauth_error=OAUTH_DENIED&ref=abc");
      await waitFor(() => expect(router.state.location.search).toBe("?ref=abc"));
    });

    it("sem o parâmetro não mostra erro", () => {
      renderLogin();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
