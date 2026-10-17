import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as auth from "../api/auth";
import * as api from "../api/travel";
import { routes } from "./routes";

vi.mock("../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/auth")>()),
  currentUser: vi.fn(),
}));
vi.mock("../api/travel", () => ({ travel: vi.fn() }));
const currentUser = vi.mocked(auth.currentUser);
const travel = vi.mocked(api.travel);
const ana = { id: "u1", name: "Ana Martins", email: "ana@lumi.dev" };

function go(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("rotas", () => {
  beforeEach(() => {
    currentUser.mockReset();
    travel.mockReset();
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

  it("a Travessia em /:code não exige sessão e registra uma Viagem", async () => {
    travel.mockResolvedValue({ status: "ok", targetUrl: "https://example.com", title: null, travelCount: 1 });
    const router = go("/abc123");
    expect(await screen.findByRole("link", { name: /sim, prosseguir/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/abc123");
    expect(travel).toHaveBeenCalledTimes(1);
    expect(travel).toHaveBeenCalledWith("abc123");
    expect(currentUser).not.toHaveBeenCalled();
  });

  it("/r/:slug deixou de ser rota do front", async () => {
    currentUser.mockResolvedValue(null);
    const router = go("/r/abc123");
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(travel).not.toHaveBeenCalled();
  });
});
