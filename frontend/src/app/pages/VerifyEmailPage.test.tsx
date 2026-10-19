import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as auth from "../../api/auth";
import { routes } from "../routes";

vi.mock("../../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/auth")>()),
  currentUser: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));
const currentUser = vi.mocked(auth.currentUser);
const verifyEmail = vi.mocked(auth.verifyEmail);
const resendVerification = vi.mocked(auth.resendVerification);
const ana = { id: "u1", name: "Ana Martins", email: "ana@lumi.dev", emailVerified: true, hasPassword: true };

function renderVerify(path = "/verificar-email?token=abc123", strict = false) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const tree = <RouterProvider router={router} />;
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return router;
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    currentUser.mockReset().mockResolvedValue(null);
    verifyEmail.mockReset().mockResolvedValue(undefined);
    resendVerification.mockReset().mockResolvedValue(undefined);
    window.history.replaceState(null, "", "/");
  });

  it("confirma o e-mail e leva ao login quando não há sessão", async () => {
    renderVerify();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("E-mail confirmado!");
    expect(verifyEmail).toHaveBeenCalledWith("abc123");
    expect(screen.getByRole("link", { name: "Ir para minha estação" })).toHaveAttribute("href", "/login");
  });

  it("confirma o e-mail e leva ao dashboard quando há sessão", async () => {
    currentUser.mockResolvedValue(ana);
    renderVerify();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("E-mail confirmado!");
    expect(screen.getByRole("link", { name: "Ir para minha estação" })).toHaveAttribute("href", "/dashboard");
  });

  it("token expirado sem sessão pede o login", async () => {
    verifyEmail.mockRejectedValue(new auth.AuthError(400, "TOKEN_EXPIRED", "expirado"));
    renderVerify();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Este link expirou");
    expect(screen.getByRole("link", { name: "Entrar para pedir outro link" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "Enviar novo link" })).not.toBeInTheDocument();
  });

  it("token expirado com sessão reenvia o link", async () => {
    currentUser.mockResolvedValue(ana);
    verifyEmail.mockRejectedValue(new auth.AuthError(400, "TOKEN_EXPIRED", "expirado"));
    renderVerify();
    await userEvent.click(await screen.findByRole("button", { name: "Enviar novo link" }));
    expect(resendVerification).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent(/novo link/i);
    expect(screen.getByRole("button", { name: "Enviar novo link" })).toBeDisabled();
  });

  it.each([
    ["RATE_LIMIT", 429, /links demais/i],
    ["ALREADY_VERIFIED", 409, /já está confirmado/i],
  ])("mostra o erro %s ao reenviar", async (code, status, message) => {
    currentUser.mockResolvedValue(ana);
    verifyEmail.mockRejectedValue(new auth.AuthError(400, "TOKEN_EXPIRED", "expirado"));
    resendVerification.mockRejectedValue(new auth.AuthError(status, code, "x"));
    renderVerify();
    await userEvent.click(await screen.findByRole("button", { name: "Enviar novo link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Enviar novo link" })).toBeEnabled();
  });

  it("token inválido deslogado mostra a dica e o botão de entrar", async () => {
    verifyEmail.mockRejectedValue(new auth.AuthError(400, "TOKEN_INVALID", "inválido"));
    renderVerify();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Link inválido ou já usado");
    expect(screen.getByText("Se você já confirmou, é só entrar.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it("token inválido com sessão leva ao dashboard", async () => {
    currentUser.mockResolvedValue(ana);
    verifyEmail.mockRejectedValue(new auth.AuthError(400, "TOKEN_INVALID", "inválido"));
    renderVerify();
    expect(await screen.findByRole("link", { name: "Ir para minha estação" })).toHaveAttribute("href", "/dashboard");
  });

  it("token longo demais (VALIDATION_ERROR) é tratado como link inválido", async () => {
    verifyEmail.mockRejectedValue(new auth.AuthError(400, "VALIDATION_ERROR", "token: size"));
    renderVerify();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Link inválido ou já usado");
  });

  it.each([
    ["RATE_LIMIT", "RATE_LIMIT"],
    ["429 sem corpo JSON", "UNKNOWN"],
  ])("429 (%s) mostra o aviso de tentativas sem repetir o POST", async (_caso, code) => {
    verifyEmail.mockRejectedValue(new auth.AuthError(429, code, "limite"));
    renderVerify("/verificar-email?token=abc123", true);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Vamos com calma");
    expect(screen.getByText(/muitas tentativas/i)).toBeInTheDocument();
    expect(screen.getByText(/link que enviamos por e-mail/i)).toBeInTheDocument();
    expect(screen.getByText(/recarregar esta página não funciona/i)).toBeInTheDocument();
    expect(screen.queryByText(/link inválido/i)).not.toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
  });

  it("5xx continua caindo na tela de erro da rota", async () => {
    verifyEmail.mockRejectedValue(new auth.AuthError(500, "INTERNAL_ERROR", "boom"));
    renderVerify();
    expect(await screen.findByRole("heading", { name: /algo deu errado/i })).toBeInTheDocument();
  });

  it("sem token é inválido e não chama a API de verificação", async () => {
    renderVerify("/verificar-email");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Link inválido ou já usado");
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it("API fora do ar cai na tela de erro da rota", async () => {
    verifyEmail.mockRejectedValue(new auth.AuthError(500, "OFFLINE", "fora do ar"));
    renderVerify();
    expect(await screen.findByRole("heading", { name: /estação está fora do ar/i })).toBeInTheDocument();
  });

  it("verifica uma única vez mesmo no StrictMode e tira o token da URL", async () => {
    window.history.replaceState(null, "", "/verificar-email?token=abc123");
    renderVerify("/verificar-email?token=abc123", true);
    await screen.findByRole("heading", { level: 1 });
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/verificar-email");
  });

  it("com a sessão inacessível não gasta o token e tenta de novo com um único POST", async () => {
    currentUser.mockRejectedValueOnce(new auth.AuthError(0, "NETWORK", "sem rede"));
    renderVerify();
    expect(await screen.findByRole("heading", { name: /estação está fora do ar/i })).toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));
    expect(await screen.findByRole("heading", { name: "E-mail confirmado!" })).toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
  });

  it("não deixa o token vazar pelo referrer", async () => {
    renderVerify();
    await screen.findByRole("heading", { level: 1 });
    expect(document.querySelector('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  });
});
