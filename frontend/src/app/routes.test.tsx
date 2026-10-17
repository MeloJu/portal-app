import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as auth from "../api/auth";
import { routes } from "./routes";

vi.mock("../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/auth")>()),
  currentUser: vi.fn(),
}));
const currentUser = vi.mocked(auth.currentUser);
const ana = { id: "u1", name: "Ana Martins", email: "ana@lumi.dev" };

function go(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("rotas", () => {
  // Com chaves: uma função devolvida pelo beforeEach vira teardown, e o Vitest chamaria o mock depois do teste.
  beforeEach(() => {
    currentUser.mockReset();
  });

  it("sem sessão, a raiz e o dashboard levam ao login", async () => {
    currentUser.mockResolvedValue(null);
    const fromRoot = go("/");
    await vi.waitFor(() => expect(fromRoot.state.location.pathname).toBe("/login"));
    const fromDashboard = go("/dashboard");
    await vi.waitFor(() => expect(fromDashboard.state.location.pathname).toBe("/login"));
  });

  it("com sessão, o login leva ao dashboard com o nome do usuário", async () => {
    currentUser.mockResolvedValue(ana);
    const fromLogin = go("/login");
    await vi.waitFor(() => expect(fromLogin.state.location.pathname).toBe("/dashboard"));
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
  });

  it("a página de redirecionamento não exige sessão", async () => {
    const router = go("/r/abc123");
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/r/abc123"));
    expect(currentUser).not.toHaveBeenCalled();
  });

  it("com a API fora do ar mostra a estação desligada e tenta de novo", async () => {
    currentUser.mockRejectedValueOnce(new auth.AuthError(500, "OFFLINE", "fora do ar"));
    const router = go("/");
    expect(await screen.findByRole("heading", { name: /estação está fora do ar/i })).toBeInTheDocument();
    expect(screen.getByText(/dev-backend/i)).toBeInTheDocument();

    currentUser.mockResolvedValue(null);
    await userEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(await screen.findByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("vale também para quem abre direto o login ou o dashboard", async () => {
    currentUser.mockImplementation(async () => {
      throw new auth.AuthError(0, "NETWORK", "sem rede");
    });
    go("/dashboard");
    expect(await screen.findByRole("heading", { name: /estação está fora do ar/i })).toBeInTheDocument();
  });

  it("outros erros mostram uma tela genérica, não a do React Router", async () => {
    currentUser.mockImplementation(async () => {
      throw new auth.AuthError(500, "INTERNAL_ERROR", "boom");
    });
    go("/login");
    expect(await screen.findByRole("heading", { name: /algo deu errado/i })).toBeInTheDocument();
    expect(screen.queryByText(/estação está fora do ar/i)).not.toBeInTheDocument();
  });
});
