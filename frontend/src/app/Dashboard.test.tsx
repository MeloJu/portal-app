import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, vi } from "vitest";
import * as auth from "../api/auth";
import * as links from "../api/links";
import * as dashboard from "../api/dashboard";
import Dashboard from "./Dashboard";

vi.mock("../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/auth")>()),
  logout: vi.fn(),
}));
vi.mock("../api/links", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/links")>()),
  createLink: vi.fn(),
}));
vi.mock("../api/dashboard", () => ({ getOverview: vi.fn() }));
vi.mocked(dashboard.getOverview).mockResolvedValue({
  summary: { activeLinks: 2, totalTravels: 41, travelsChangePct: 5, blockedThreats: 3 },
  travels: [{ date: "2026-10-16", travels: 4 }],
  topLinks: [{ code: "abc123", title: "Campanha Real", travels: 41 }],
});

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

const NO_EXTRAS = { title: null, maxTravels: null };
const linksPage = (items: unknown[] = []) =>
  new Response(JSON.stringify({ items, page: 0, totalItems: items.length }), { status: 200 });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const protectionSummary = { blockedThreats: 0, verifiedDestinations: 0, byReason: {} };
const apiResponse = (url: string, items: unknown[] = []) => {
  if (url.startsWith("/api/protection/summary")) return json(protectionSummary);
  if (url.startsWith("/api/protection/events")) return json([]);
  return linksPage(items);
};
const recentLink = {
  code: "orbit",
  shortUrl: "https://lumi.example/orbit",
  targetUrl: "https://lumi.studio/orbit",
  title: "Evento Orbit Real",
  state: "ACTIVE",
  travelCount: 7,
  expiresAt: null,
  maxTravels: null,
  createdAt: "2026-10-16T12:00:00Z",
};
const nav = () => screen.getByRole("navigation", { name: /navegação principal/i });

describe("Dashboard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => Promise.resolve(apiResponse(url))),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("começa na visão geral", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/pronta para decolar/i);
    expect(screen.getByPlaceholderText(/cole seu link longo/i)).toBeInTheDocument();
  });

  it("a visão geral mostra os números da API", async () => {
    renderDashboard();
    expect(await screen.findByText("Campanha Real")).toBeInTheDocument();
    const travels = screen.getByText("Viagens realizadas").closest("article")!;
    expect(within(travels).getByText("41")).toBeInTheDocument();
    expect(screen.getByText("41 viajantes")).toBeInTheDocument();
    expect(dashboard.getOverview).toHaveBeenCalledWith(12);
  });

  it("portais recentes vêm da API, sem mock", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => Promise.resolve(apiResponse(url, [recentLink]))),
    );
    renderDashboard();
    expect(await screen.findByText("Evento Orbit Real")).toBeInTheDocument();
    expect(screen.getByText(/lumi\.example\/orbit/)).toBeInTheDocument();
    expect(screen.queryByText(/l2\.to\/nebulosa/)).not.toBeInTheDocument();
  });

  it("Ver todos dos portais recentes abre Meus portais", async () => {
    renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: /ver todos/i }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/seus portais digitais/i);
  });

  it("criar portal recarrega a visão geral na hora", async () => {
    renderDashboard();
    await screen.findByText("Campanha Real");
    const fetchMock = vi.mocked(fetch);
    const overviewCalls = vi.mocked(dashboard.getOverview).mock.calls.length;
    const recentCalls = fetchMock.mock.calls.length;
    vi.mocked(links.createLink).mockResolvedValue({ ...recentLink, code: "novo", title: null } as never);
    await userEvent.type(screen.getByPlaceholderText(/cole seu link longo/i), "https://exemplo.com/novo");
    await userEvent.click(screen.getByRole("button", { name: /criar portal/i }));
    await vi.waitFor(() => expect(vi.mocked(dashboard.getOverview).mock.calls.length).toBeGreaterThan(overviewCalls), {
      timeout: 3000,
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(recentCalls);
  });

  it("troca de seção pela navegação lateral", async () => {
    renderDashboard();
    await userEvent.click(within(nav()).getByRole("button", { name: "Proteção" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/rotas seguras/i);
    await userEvent.click(within(nav()).getByRole("button", { name: "Conquistas" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/merece ser celebrada/i);
  });

  it("Meus portais lista os portais da API", async () => {
    const page = {
      items: [
        {
          code: "nebulosa",
          shortUrl: "https://l2.to/nebulosa",
          targetUrl: "https://lumi.studio/campanha",
          title: "Campanha Nebulosa",
          state: "ACTIVE",
          travelCount: 1248,
          expiresAt: null,
          maxTravels: null,
          createdAt: "2026-10-16T12:00:00Z",
        },
      ],
      page: 0,
      totalItems: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(page), { status: 200 }))),
    );
    renderDashboard();
    await userEvent.click(within(nav()).getByRole("button", { name: "Meus portais" }));
    expect(await screen.findByText("Campanha Nebulosa")).toBeInTheDocument();
    expect(screen.getByText("1.248")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Agendados" })).not.toBeInTheDocument();
  });

  it("cria um portal com o slug personalizado normalizado", async () => {
    renderDashboard();
    await userEvent.type(screen.getByPlaceholderText(/cole seu link longo/i), "https://exemplo.com/muito/longo");
    await userEvent.type(screen.getByPlaceholderText("personalizar"), "Meu Link");
    vi.mocked(links.createLink).mockResolvedValue({
      code: "meu-link",
      shortUrl: "https://l2.to/meu-link",
      targetUrl: "https://exemplo.com/muito/longo",
      title: null,
      state: "ACTIVE",
      travelCount: 0,
      expiresAt: null,
      maxTravels: null,
      createdAt: "2026-10-16T12:00:00Z",
    });
    await userEvent.click(screen.getByRole("button", { name: /criar portal/i }));
    expect(links.createLink).toHaveBeenCalledWith("https://exemplo.com/muito/longo", "meu-link", NO_EXTRAS);
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
          loader: () => ({ id: "u1", name: "Bruno Costa", email: "b@lumi.dev", emailVerified: true }),
          Component: Dashboard,
        },
      ],
      { initialEntries: ["/dashboard"] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByText("Bruno Costa")).toBeInTheDocument();
    expect(screen.getAllByText("BC").length).toBeGreaterThan(0);
  });

  it("saúda o usuário da sessão pelo primeiro nome e preenche o e-mail nas configurações", async () => {
    const router = createMemoryRouter(
      [
        {
          id: "dashboard",
          path: "/dashboard",
          loader: () => ({ id: "u1", name: "Bruno Costa", email: "b@lumi.dev", emailVerified: true }),
          Component: Dashboard,
        },
      ],
      { initialEntries: ["/dashboard"] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Olá, Bruno. Pronta para decolar?");
    await userEvent.click(within(nav()).getByRole("button", { name: /configurações/i }));
    expect(screen.getByDisplayValue("b@lumi.dev")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Estação de Bruno")).toBeInTheDocument();
  });

  describe("conta não verificada", () => {
    const unverified = { id: "u1", name: "Bruno Costa", email: "b@lumi.dev", emailVerified: false };

    function renderWithUser(initial: typeof unverified, afterRevalidate = initial) {
      let calls = 0;
      const router = createMemoryRouter(
        [
          {
            id: "dashboard",
            path: "/dashboard",
            loader: () => (calls++ === 0 ? initial : afterRevalidate),
            Component: Dashboard,
          },
        ],
        { initialEntries: ["/dashboard"] },
      );
      render(<RouterProvider router={router} />);
      return router;
    }

    it("mostra o banner e bloqueia a criação de portais", async () => {
      renderWithUser(unverified);
      expect(await screen.findByText(/enviamos um link para b@lumi.dev/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /criar portal/i })).toBeDisabled();
      expect(screen.getAllByText("Confirme seu e-mail para criar portais").length).toBeGreaterThan(0);
    });

    it("não mostra banner para conta verificada", async () => {
      renderWithUser({ ...unverified, emailVerified: true });
      expect(await screen.findByText("Bruno Costa")).toBeInTheDocument();
      expect(screen.queryByText(/enviamos um link/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /criar portal/i })).toBeEnabled();
    });

    it("Já verifiquei recarrega o usuário e o banner some quando ele está verificado", async () => {
      renderWithUser(unverified, { ...unverified, emailVerified: true });
      await userEvent.click(await screen.findByRole("button", { name: /já verifiquei/i }));
      await vi.waitFor(() => expect(screen.queryByText(/enviamos um link/i)).not.toBeInTheDocument());
      expect(screen.getByRole("button", { name: /criar portal/i })).toBeEnabled();
    });

    it("quando o banner some, o foco vai para o título da página", async () => {
      renderWithUser(unverified, { ...unverified, emailVerified: true });
      await userEvent.click(await screen.findByRole("button", { name: /já verifiquei/i }));
      await vi.waitFor(() => expect(screen.queryByText(/enviamos um link/i)).not.toBeInTheDocument());
      await vi.waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());
    });

    it("403 EMAIL_NOT_VERIFIED na criação revalida o usuário e passa a bloquear", async () => {
      renderWithUser({ ...unverified, emailVerified: true }, unverified);
      vi.mocked(links.createLink).mockRejectedValue(new links.LinkError(403, "EMAIL_NOT_VERIFIED", "x"));
      await screen.findByText("Bruno Costa");
      await userEvent.type(screen.getByPlaceholderText(/cole seu link longo/i), "exemplo.com");
      await userEvent.click(screen.getByRole("button", { name: /criar portal/i }));
      expect(await screen.findByText(/enviamos um link para b@lumi.dev/i, {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /criar portal/i })).toBeDisabled();
    });

    it("a aba Revelar destino segue disponível", async () => {
      renderWithUser(unverified);
      await screen.findByText(/enviamos um link/i);
      await userEvent.click(within(nav()).getByRole("button", { name: /revelar destino/i }));
      expect(await screen.findByLabelText(/link para revelar/i)).toBeEnabled();
    });
  });
});
