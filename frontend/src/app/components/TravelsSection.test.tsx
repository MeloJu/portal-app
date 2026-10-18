import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CountryCount, DashboardSummary, TimePoint } from "../../api/lumi";
import TravelsSection from "./TravelsSection";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const SUMMARY: DashboardSummary = { activeLinks: 4, totalTravels: 8429, travelsChangePct: 18.4, blockedThreats: 2 };

function series(values: number[]): TimePoint[] {
  return values.map((travels, index) => ({ date: `2026-09-${String(index + 1).padStart(2, "0")}`, travels }));
}

type Data = { summary?: DashboardSummary; travels?: TimePoint[]; countries?: CountryCount[] };

function mockApi({ summary = SUMMARY, travels = series(Array(30).fill(0)), countries = [] }: Data = {}) {
  const fetchMock = vi.fn((url: string) => {
    if (url.startsWith("/api/dashboard/summary")) return Promise.resolve(json(summary));
    if (url.startsWith("/api/dashboard/travels")) return Promise.resolve(json(travels));
    if (url.startsWith("/api/dashboard/countries")) return Promise.resolve(json(countries));
    return Promise.resolve(json({ code: "NOT_FOUND", message: "rota inesperada" }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const card = (label: string) => screen.getByText(label).closest("article")!;

afterEach(() => vi.unstubAllGlobals());

describe("TravelsSection", () => {
  it("pede a janela de 30 dias", async () => {
    const fetchMock = mockApi();
    render(<TravelsSection />);
    await screen.findByText("VIAGENS TOTAIS");
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "/api/dashboard/summary?days=30",
        "/api/dashboard/travels?days=30",
        "/api/dashboard/countries",
      ]),
    );
  });

  it("mostra os cards com os números da API", async () => {
    mockApi({ travels: series([...Array(28).fill(0), 3, 4]), countries: [{ country: "BR", travels: 7 }] });
    render(<TravelsSection />);
    await screen.findByText("VIAGENS TOTAIS");
    expect(within(card("VIAGENS TOTAIS")).getByText("8.429")).toBeInTheDocument();
    expect(within(card("VIAGENS TOTAIS")).getByText("+18,4% nos últimos 30 dias")).toBeInTheDocument();
    expect(within(card("VIAGENS NO PERÍODO")).getByText("7")).toBeInTheDocument();
    expect(within(card("PAÍSES ALCANÇADOS")).getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("VIAJANTES ÚNICOS")).not.toBeInTheDocument();
    expect(screen.queryByText("TEMPO ATÉ O DESTINO")).not.toBeInTheDocument();
  });

  it("variação nula vira travessão", async () => {
    mockApi({ summary: { ...SUMMARY, totalTravels: 0, travelsChangePct: null } });
    render(<TravelsSection />);
    await screen.findByText("VIAGENS TOTAIS");
    expect(within(card("VIAGENS TOTAIS")).getByText("— nos últimos 30 dias")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it("gráfico tem 30 barras proporcionais ao maior valor", async () => {
    const values = Array.from({ length: 30 }, (_, index) => (index === 29 ? 10 : index === 0 ? 5 : 0));
    mockApi({ travels: series(values) });
    render(<TravelsSection />);
    const chart = await screen.findByRole("img", { name: /viagens por dia/i });
    const bars = chart.querySelectorAll(".bars span");
    expect(bars).toHaveLength(30);
    expect((bars[0] as HTMLElement).style.height).toBe("50%");
    expect((bars[29] as HTMLElement).style.height).toBe("100%");
  });

  it("gráfico zerado não gera NaN", async () => {
    mockApi();
    render(<TravelsSection />);
    const chart = await screen.findByRole("img", { name: /viagens por dia/i });
    const heights = [...chart.querySelectorAll<HTMLElement>(".bars span")].map((bar) => bar.style.height);
    expect(heights).toHaveLength(30);
    expect(new Set(heights)).toEqual(new Set(["0%"]));
  });

  it("ranking de países usa nomes em português e barra proporcional", async () => {
    mockApi({
      countries: [
        { country: "BR", travels: 3 },
        { country: "US", travels: 1 },
      ],
    });
    render(<TravelsSection />);
    const brazil = (await screen.findByText("Brasil")).closest(".rank-row")!;
    const usa = screen.getByText("Estados Unidos").closest(".rank-row")!;
    expect(within(brazil as HTMLElement).getByText("3")).toBeInTheDocument();
    expect(brazil.querySelector<HTMLElement>("i span")!.style.width).toBe("100%");
    expect(usa.querySelector<HTMLElement>("i span")!.style.width).toBe("33%");
  });

  it("sem país mostra estado vazio e nenhum planeta mockado", async () => {
    mockApi({ countries: [] });
    render(<TravelsSection />);
    expect(
      await screen.findByText("Ainda sem dados de país — a localização das viagens chega em breve."),
    ).toBeInTheDocument();
    expect(within(card("PAÍSES ALCANÇADOS")).getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("Portugal")).not.toBeInTheDocument();
    expect(document.querySelector(".map-planet")).toBeNull();
  });

  it("erro da API aparece com opção de tentar de novo", async () => {
    const fetchMock = mockApi();
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json({ code: "INTERNAL", message: "Algo deu errado. Tente novamente." }, 500)),
    );
    render(<TravelsSection />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Algo deu errado. Tente novamente.");
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("VIAGENS TOTAIS")).toBeInTheDocument();
  });
});
