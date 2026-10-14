import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import Dashboard from "./Dashboard";

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

  it("prepara o link do Bypass City na página Fechar portal", async () => {
    renderDashboard();
    await userEvent.click(within(nav()).getByRole("button", { name: "Fechar portal" }));
    await userEvent.type(screen.getByPlaceholderText(/cole o link que deseja revelar/i), "bit.ly/abc");
    await userEvent.click(screen.getByRole("button", { name: /revelar destino/i }));
    const link = await screen.findByRole("link", { name: /continuar no bypass city/i }, { timeout: 3000 });
    expect(link).toHaveAttribute(
      "href",
      `https://bypass.city/bypass?bypass=${encodeURIComponent("https://bit.ly/abc")}`,
    );
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("alterna o tema e persiste a escolha", async () => {
    renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: /ativar modo (escuro|claro)/i }));
    const theme = document.documentElement.dataset.theme;
    expect(["light", "dark"]).toContain(theme);
    expect(window.localStorage.getItem("lumi-theme")).toBe(theme);
  });

  it("encerra a sessão ao sair", async () => {
    window.localStorage.setItem("lumi-session", "active");
    const router = renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: /sair da conta/i }));
    expect(window.localStorage.getItem("lumi-session")).toBeNull();
    expect(router.state.location.pathname).toBe("/login");
  });
});
