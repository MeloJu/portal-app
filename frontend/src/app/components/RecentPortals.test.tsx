import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Link } from "../../api/lumi";
import RecentPortals from "./RecentPortals";

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    code: "nebulosa",
    shortUrl: "https://lumi.example/nebulosa",
    targetUrl: "https://lumi.studio/campanha",
    title: "Campanha Nebulosa",
    state: "ACTIVE",
    travelCount: 1248,
    expiresAt: null,
    maxTravels: null,
    createdAt: "2026-10-16T12:00:00Z",
    ...overrides,
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function mockLinks(items: Link[]) {
  const fetchMock = vi.fn(() => Promise.resolve(json({ items, page: 0, totalItems: items.length })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const urls = (fetchMock: ReturnType<typeof mockLinks>) => fetchMock.mock.calls.map((call) => (call as unknown[])[0]);

afterEach(() => vi.unstubAllGlobals());

describe("RecentPortals", () => {
  it("busca os 3 portais mais recentes", async () => {
    const fetchMock = mockLinks([makeLink()]);
    render(<RecentPortals version={0} onSeeAll={() => {}} />);
    await screen.findByText("Campanha Nebulosa");
    expect(urls(fetchMock)).toEqual(["/api/links?size=3"]);
  });

  it("mostra título, link curto, viagens e status vindos da API", async () => {
    mockLinks([makeLink(), makeLink({ code: "orbit", title: null, travelCount: 0, state: "PAUSED" })]);
    render(<RecentPortals version={0} onSeeAll={() => {}} />);
    const first = (await screen.findByText("Campanha Nebulosa")).closest(".link-row") as HTMLElement;
    expect(within(first).getByText(/lumi\.example\/nebulosa/)).toBeInTheDocument();
    expect(within(first).getByText("1.248")).toBeInTheDocument();
    expect(within(first).getByText("Ativo")).toBeInTheDocument();
    const second = screen.getByText("orbit").closest(".link-row") as HTMLElement;
    expect(within(second).getByText("0")).toBeInTheDocument();
    expect(within(second).getByText("Pausado")).toBeInTheDocument();
    expect(screen.queryByText(/l2\.to/)).not.toBeInTheDocument();
  });

  it("copiar usa a shortUrl exata", async () => {
    mockLinks([makeLink()]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<RecentPortals version={0} onSeeAll={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: /lumi\.example\/nebulosa/ }));
    expect(writeText).toHaveBeenCalledWith("https://lumi.example/nebulosa");
  });

  it("pré-visualizar abre a Travessia do código numa aba nova", async () => {
    mockLinks([makeLink()]);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<RecentPortals version={0} onSeeAll={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: "Visualizar portal Campanha Nebulosa" }));
    expect(open).toHaveBeenCalledWith("/nebulosa", "_blank", "noopener,noreferrer");
    open.mockRestore();
  });

  it("Ver todos leva para Meus portais", async () => {
    mockLinks([makeLink()]);
    const onSeeAll = vi.fn();
    render(<RecentPortals version={0} onSeeAll={onSeeAll} />);
    await userEvent.click(await screen.findByRole("button", { name: /ver todos/i }));
    expect(onSeeAll).toHaveBeenCalled();
  });

  it("usuário sem portais vê estado vazio", async () => {
    mockLinks([]);
    render(<RecentPortals version={0} onSeeAll={() => {}} />);
    expect(await screen.findByText("Você ainda não abriu nenhum portal.")).toBeInTheDocument();
    expect(document.querySelector(".link-row")).toBeNull();
  });

  it("versão nova busca de novo", async () => {
    const fetchMock = mockLinks([makeLink()]);
    const { rerender } = render(<RecentPortals version={0} onSeeAll={() => {}} />);
    await screen.findByText("Campanha Nebulosa");
    rerender(<RecentPortals version={1} onSeeAll={() => {}} />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("erro da API aparece no card", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(json({ code: "INTERNAL", message: "Algo deu errado. Tente novamente." }, 500))),
    );
    render(<RecentPortals version={0} onSeeAll={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Algo deu errado. Tente novamente.");
  });
});
