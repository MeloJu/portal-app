import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Link, type LinkPage } from "../../api/lumi";
import AchievementsSection from "./AchievementsSection";

vi.mock("../../api/lumi", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../api/lumi")>();
  return {
    ...original,
    api: {
      ...original.api,
      listLinks: vi.fn(),
      dashboardSummary: vi.fn(),
      countries: vi.fn(),
    },
  };
});

const emptyPage = (page = 0): LinkPage => ({ items: [], page, totalItems: 0 });

function link(code: string, travelCount: number): Link {
  return {
    code,
    shortUrl: `https://lumi.example/${code}`,
    targetUrl: `https://example.com/${code}`,
    title: null,
    state: "ACTIVE",
    travelCount,
    expiresAt: null,
    maxTravels: null,
    createdAt: "2026-10-16T12:00:00Z",
  };
}

function page(items: Link[], pageNumber: number, totalItems: number): LinkPage {
  return { items, page: pageNumber, totalItems };
}

function achievement(title: string) {
  return screen.getByRole("heading", { name: title }).closest("article")!;
}

describe("AchievementsSection", () => {
  beforeEach(() => {
    vi.mocked(api.dashboardSummary).mockReset().mockResolvedValue({
      activeLinks: 0,
      totalTravels: 0,
      travelsChangePct: null,
      blockedThreats: 0,
    });
    vi.mocked(api.countries).mockReset().mockResolvedValue([]);
    vi.mocked(api.listLinks).mockReset().mockResolvedValue(emptyPage());
  });

  it("calcula as oito conquistas usando todos os portais paginados", async () => {
    const links = Array.from({ length: 201 }, (_, index) => link(`portal-${index}`, index === 200 ? 1000 : 0));
    vi.mocked(api.dashboardSummary).mockResolvedValue({
      activeLinks: 25,
      totalTravels: 1000,
      travelsChangePct: null,
      blockedThreats: 1,
    });
    vi.mocked(api.countries).mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({ country: `C${index}`, travels: 1 })),
    );
    vi.mocked(api.listLinks).mockImplementation(async ({ page: pageNumber = 0, size = 100 } = {}) =>
      page(links.slice(pageNumber * size, (pageNumber + 1) * size), pageNumber, links.length),
    );

    render(<AchievementsSection />);

    expect(await screen.findByText("8 de 8 conquistas concluídas.")).toBeInTheDocument();
    expect(within(achievement("Mil viajantes")).getByText("CONQUISTADA")).toBeInTheDocument();
    expect(within(achievement("Mestre dos portais")).getByText("CONQUISTADA")).toBeInTheDocument();
    expect(vi.mocked(api.listLinks).mock.calls.map(([params]) => params)).toEqual([
      { page: 0, size: 100 },
      { page: 1, size: 100 },
      { page: 2, size: 100 },
    ]);
    expect(screen.queryByText("1.480")).not.toBeInTheDocument();
    expect(screen.queryByText(/\+240 esta semana|Cartógrafa de Portais|desbloqueada em/i)).not.toBeInTheDocument();
  });

  it("calcula progresso parcial e mantém a conquista bloqueada abaixo da meta", async () => {
    vi.mocked(api.dashboardSummary).mockResolvedValue({
      activeLinks: 3,
      totalTravels: 4,
      travelsChangePct: null,
      blockedThreats: 0,
    });
    vi.mocked(api.listLinks).mockResolvedValue(page([link("one", 50), link("two", 0), link("three", 0)], 0, 3));

    render(<AchievementsSection />);

    expect(await screen.findByText("2 de 8 conquistas concluídas.")).toBeInTheDocument();
    expect(within(achievement("Primeiro portal")).getByText("CONQUISTADA")).toBeInTheDocument();
    expect(within(achievement("Rota popular")).getByText("50 de 100 viagens em um portal")).toBeInTheDocument();
    expect(achievement("Rota popular")).toHaveClass("locked");
    expect(within(achievement("Guardião atento")).getByText("0 de 1 bloqueio")).toBeInTheDocument();
  });

  it("mostra o estado sem portais e explica que os países dependem de GeoIP", async () => {
    render(<AchievementsSection />);

    expect(await screen.findByText("Nenhum portal ainda")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum país foi identificado.*GeoIP/i)).toBeInTheDocument();
    expect(within(achievement("Constelação global")).getByText("0 de 10 países identificados")).toBeInTheDocument();
    expect(achievement("Primeiro portal")).toHaveClass("locked");
  });

  it("mostra carregamento e erro, com opção para tentar novamente", async () => {
    let resolveSummary!: (value: Awaited<ReturnType<typeof api.dashboardSummary>>) => void;
    vi.mocked(api.listLinks).mockRejectedValueOnce(new Error("falha de rede")).mockResolvedValueOnce(emptyPage());
    vi.mocked(api.dashboardSummary).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSummary = resolve;
      }),
    );

    render(<AchievementsSection />);
    expect(screen.getByRole("status")).toHaveTextContent("Consultando suas conquistas");

    resolveSummary({ activeLinks: 0, totalTravels: 0, travelsChangePct: null, blockedThreats: 0 });
    expect(await screen.findByRole("alert")).toHaveTextContent("Não deu para carregar suas conquistas");

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("0 de 8 conquistas concluídas.")).toBeInTheDocument();
  });

  it("reporta paginação inconsistente sem calcular com uma lista parcial", async () => {
    vi.mocked(api.listLinks)
      .mockResolvedValueOnce(
        page(
          Array.from({ length: 100 }, (_, index) => link(`portal-${index}`, 0)),
          0,
          101,
        ),
      )
      .mockResolvedValueOnce(page([link("portal-100", 1000)], 2, 101));

    render(<AchievementsSection />);

    expect(await screen.findByRole("alert")).toHaveTextContent("A lista de portais mudou durante a consulta");
    expect(screen.queryByRole("heading", { name: "Mil viajantes" })).not.toBeInTheDocument();
  });
});
