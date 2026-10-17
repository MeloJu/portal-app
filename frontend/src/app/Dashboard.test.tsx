import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";
import * as auth from "../api/auth";
import Dashboard from "./Dashboard";

vi.mock("../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/auth")>()),
  logout: vi.fn(),
}));

function renderDashboard() {
  const router = createMemoryRouter(
    [
      { path: "/dashboard", Component: Dashboard },
      { path: "/login", element: <p>login page</p> },
    ],
    { initialEntries: ["/dashboard"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const nav = () => screen.getByRole("navigation", { name: /navegação principal/i });

describe("Dashboard", () => {
  it("começa na visão geral", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/pronta para decolar/i);
    expect(screen.getByPlaceholderText(/cole seu link longo/i)).toBeInTheDocument();
  });

  it("troca de seção pela navegação lateral", async () => {
    renderDashboard();
    await userEvent.click(within(nav()).getByRole("button", { name: "Proteção" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/rotas seguras/i);
    await userEvent.click(within(nav()).getByRole("button", { name: "Conquistas" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/merece ser celebrada/i);
  });

  it("filtra os portais por status", async () => {
    renderDashboard();
    await userEvent.click(within(nav()).getByRole("button", { name: "Meus portais" }));
    expect(screen.getAllByRole("article")).toHaveLength(6);
    await userEvent.click(screen.getByRole("button", { name: "Pausados" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Guia de Marca")).toBeInTheDocument();
  });

  it("copia o link da Nebulosa e mostra o check após copiar", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderDashboard();
    await userEvent.click(within(nav()).getByRole("button", { name: "Meus portais" }));

    const nebulosaLink = screen.getByRole("button", { name: /l2\.to\/nebulosa/i });
    await userEvent.click(nebulosaLink);

    expect(writeText).toHaveBeenCalledWith("https://l2.to/nebulosa");
    expect(nebulosaLink.querySelector("path")?.getAttribute("d")).toBe("m5 12 4 4L19 6");
  });

  it("visualiza o portal pela Travessia em /:code", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: /visualizar portal campanha nebulosa/i }));
    expect(open).toHaveBeenCalledWith("/nebulosa", "_blank", "noopener,noreferrer");
    open.mockRestore();
  });

  it("cria um portal com o slug personalizado normalizado", async () => {
    renderDashboard();
    await userEvent.type(screen.getByPlaceholderText(/cole seu link longo/i), "https://exemplo.com/muito/longo");
    await userEvent.type(screen.getByPlaceholderText("personalizar"), "Meu Link");
    await userEvent.click(screen.getByRole("button", { name: /criar portal/i }));
    expect(await screen.findByText("l2.to/meu-link", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("não cria portal sem URL", async () => {
    renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: /criar portal/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("abre a página Revelar destino sem depender do Bypass City", async () => {
    renderDashboard();
    await userEvent.click(within(nav()).getByRole("button", { name: "Revelar destino" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/revele o destino original/i);
    expect(screen.getByLabelText(/link para revelar/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /bypass city/i })).not.toBeInTheDocument();
  });

  it("alterna o tema e persiste a escolha", async () => {
    renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: /ativar modo (escuro|claro)/i }));
    const theme = document.documentElement.dataset.theme;
    expect(["light", "dark"]).toContain(theme);
    expect(window.localStorage.getItem("lumi-theme")).toBe(theme);
  });

  it("alterna o estado ativo das notificações", async () => {
    renderDashboard();
    const button = screen.getByRole("button", { name: "Notificações" });

    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(button).toHaveClass("active");
    expect(button).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(button);
    expect(button).not.toHaveClass("active");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("encerra a sessão na API ao sair", async () => {
    vi.mocked(auth.logout).mockResolvedValue();
    const router = renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: /sair da conta/i }));
    expect(auth.logout).toHaveBeenCalled();
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("sai da tela mesmo se o logout da API falhar", async () => {
    vi.mocked(auth.logout).mockRejectedValue(new auth.AuthError(0, "NETWORK", "x"));
    const router = renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: /sair da conta/i }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("mostra o nome e as iniciais do usuário da sessão", async () => {
    const router = createMemoryRouter(
      [
        {
          id: "dashboard",
          path: "/dashboard",
          loader: () => ({ id: "u1", name: "Bruno Costa", email: "b@lumi.dev" }),
          Component: Dashboard,
        },
      ],
      { initialEntries: ["/dashboard"] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByText("Bruno Costa")).toBeInTheDocument();
    expect(screen.getAllByText("BC").length).toBeGreaterThan(0);
  });
});
