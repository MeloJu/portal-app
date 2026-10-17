import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Link } from "../../api/lumi";
import PortalsSection from "./PortalsSection";

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    code: "nebulosa",
    shortUrl: "https://l2.to/nebulosa",
    targetUrl: "https://lumi.studio/campanha",
    title: "Campanha Nebulosa",
    state: "ACTIVE",
    travelCount: 396,
    expiresAt: null,
    maxTravels: null,
    createdAt: "2026-10-16T12:00:00Z",
    ...overrides,
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const page = (items: Link[], totalItems = items.length, pageIndex = 0) => json({ items, page: pageIndex, totalItems });

type Route = (url: string, init: RequestInit) => Response | Promise<Response>;

function mockFetch(route: Route) {
  const fetchMock = vi.fn((url: string, init: RequestInit = {}) => Promise.resolve(route(url, init)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const calls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);

afterEach(() => vi.unstubAllGlobals());

describe("PortalsSection", () => {
  it("carrega a primeira página sem state em Todos", async () => {
    const fetchMock = mockFetch(() => page([makeLink()]));
    render(<PortalsSection />);
    expect(await screen.findByText("Campanha Nebulosa")).toBeInTheDocument();
    expect(calls(fetchMock)).toEqual(["GET /api/links?page=0&size=20"]);
    expect(screen.queryByRole("tab", { name: "Agendados" })).not.toBeInTheDocument();
  });

  it.each([
    ["Ativos", "ACTIVE"],
    ["Pausados", "PAUSED"],
    ["Fechados", "CLOSED"],
  ])("o filtro %s manda state=%s", async (label, state) => {
    const fetchMock = mockFetch(() => page([makeLink()]));
    render(<PortalsSection />);
    await screen.findByText("Campanha Nebulosa");
    await userEvent.click(screen.getByRole("tab", { name: label }));
    await vi.waitFor(() => expect(calls(fetchMock)).toContain(`GET /api/links?state=${state}&page=0&size=20`));
    expect(screen.getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true");
  });

  it("mostra shortUrl e destino da API, viagens formatadas e o limite", async () => {
    mockFetch(() =>
      page([makeLink({ travelCount: 1248, maxTravels: 5000, shortUrl: "https://lumi.example/nebulosa" })]),
    );
    render(<PortalsSection />);
    const card = (await screen.findByText("Campanha Nebulosa")).closest("article")!;
    expect(within(card).getByText("lumi.example/nebulosa")).toBeInTheDocument();
    expect(within(card).getByText("lumi.studio/campanha")).toBeInTheDocument();
    expect(within(card).getByText("1.248 / 5.000")).toBeInTheDocument();
    expect(within(card).getByText("Ativo")).toBeInTheDocument();
  });

  it.each([
    [{ state: "PAUSED" as const }, "Pausado"],
    [{ state: "CLOSED" as const }, "Fechado"],
    [{ state: "CLOSED" as const, travelCount: 500, maxTravels: 500 }, "Esgotado"],
    [{ state: "CLOSED" as const, expiresAt: "2020-01-01T00:00:00Z" }, "Expirado"],
  ])("badge de %j é %s", async (overrides, label) => {
    mockFetch(() => page([makeLink(overrides)]));
    render(<PortalsSection />);
    const card = (await screen.findByText("Campanha Nebulosa")).closest("article")!;
    expect(within(card).getByText(label)).toBeInTheDocument();
  });

  it("estado desconhecido vira badge neutro com o nome cru", async () => {
    mockFetch(() => page([makeLink({ state: "ARCHIVED" as Link["state"] })]));
    render(<PortalsSection />);
    expect(await screen.findByText("ARCHIVED")).toHaveClass("portal-status", "desconhecido");
  });

  it("mostra o estado vazio do filtro", async () => {
    mockFetch(() => page([]));
    render(<PortalsSection />);
    await userEvent.click(screen.getByRole("tab", { name: "Pausados" }));
    expect(await screen.findByText("Nenhum portal pausado")).toBeInTheDocument();
  });

  it("mostra skeleton enquanto carrega", async () => {
    mockFetch(() => new Promise<Response>(() => {}));
    render(<PortalsSection />);
    expect(screen.getByLabelText("Carregando portais")).toHaveAttribute("aria-busy", "true");
  });

  it("erro da API tem botão de tentar de novo que recarrega", async () => {
    let fail = true;
    const fetchMock = mockFetch(() =>
      fail ? json({ code: "INTERNAL_ERROR", message: "Falhou feio" }, 500) : page([makeLink()]),
    );
    render(<PortalsSection />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falhou feio");
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Campanha Nebulosa")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
