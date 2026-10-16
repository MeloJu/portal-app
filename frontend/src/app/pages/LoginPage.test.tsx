import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";
import * as auth from "../../api/auth";
import LoginPage from "./LoginPage";

vi.mock("../../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/auth")>()),
  login: vi.fn(),
}));
const login = vi.mocked(auth.login);

async function fillAndSubmit(email = "ana@lumi.studio", password = "segredo") {
  await userEvent.type(screen.getByPlaceholderText("voce@estacao.com"), email);
  await userEvent.type(screen.getByPlaceholderText("Digite sua senha"), password);
  await userEvent.click(screen.getByRole("button", { name: /entrar na estação/i }));
}

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: "/login", Component: LoginPage },
      { path: "/dashboard", element: <p>dashboard</p> },
    ],
    { initialEntries: ["/login"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("LoginPage", () => {
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
    login.mockResolvedValue({ id: "u1", name: "Ana", email: "ana@lumi.studio" });
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
});
