import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Link } from "../../api/links";
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

async function openMenu(name: string) {
  await userEvent.click(await screen.findByRole("button", { name: `Opções de ${name}` }));
  return screen.getByRole("menu", { name: `Opções de ${name}` });
}

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

  it("pausar chama o PATCH com paused e recarrega a lista", async () => {
    const fetchMock = mockFetch((url, init) =>
      init.method === "PATCH" ? json(makeLink({ state: "PAUSED" })) : page([makeLink()]),
    );
    render(<PortalsSection />);
    const menu = await openMenu("Campanha Nebulosa");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Pausar portal" }));
    await vi.waitFor(() =>
      expect(calls(fetchMock)).toEqual([
        "GET /api/links?page=0&size=20",
        "PATCH /api/links/nebulosa",
        "GET /api/links?page=0&size=20",
      ]),
    );
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ paused: true });
  });

  it("portal pausado oferece retomar", async () => {
    const fetchMock = mockFetch((url, init) =>
      init.method === "PATCH" ? json(makeLink()) : page([makeLink({ state: "PAUSED" })]),
    );
    render(<PortalsSection />);
    const menu = await openMenu("Campanha Nebulosa");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Retomar portal" }));
    await vi.waitFor(() => expect(calls(fetchMock)).toContain("PATCH /api/links/nebulosa"));
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ paused: false });
  });

  it("fechar pede confirmação no card e só o Sim chama o DELETE", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const fetchMock = mockFetch((url, init) =>
      init.method === "DELETE" ? new Response(null, { status: 204 }) : page([makeLink()]),
    );
    render(<PortalsSection />);
    let menu = await openMenu("Campanha Nebulosa");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Fechar portal" }));
    let confirm = screen.getByRole("group", { name: "Fechar Campanha Nebulosa" });
    expect(confirm).toHaveTextContent("Fechar portal?");
    await userEvent.click(within(confirm).getByRole("button", { name: "Não" }));
    expect(calls(fetchMock)).not.toContain("DELETE /api/links/nebulosa");

    menu = await openMenu("Campanha Nebulosa");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Fechar portal" }));
    confirm = screen.getByRole("group", { name: "Fechar Campanha Nebulosa" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Sim" }));
    await vi.waitFor(() => expect(calls(fetchMock)).toContain("DELETE /api/links/nebulosa"));
    await vi.waitFor(() => expect(calls(fetchMock).at(-1)).toBe("GET /api/links?page=0&size=20"));
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("botões ficam desabilitados durante a requisição e o erro aparece no card", async () => {
    let finish: (res: Response) => void = () => {};
    mockFetch((url, init) =>
      init.method === "PATCH" ? new Promise<Response>((resolve) => (finish = resolve)) : page([makeLink()]),
    );
    render(<PortalsSection />);
    const menu = await openMenu("Campanha Nebulosa");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Pausar portal" }));
    expect(screen.getByRole("button", { name: "Opções de Campanha Nebulosa" })).toBeDisabled();
    finish(json({ code: "NOT_FOUND", message: "Portal não encontrado" }, 404));
    const card = screen.getByText("Campanha Nebulosa").closest("article")!;
    expect(await within(card).findByRole("alert")).toHaveTextContent("Portal não encontrado");
    expect(screen.getByRole("button", { name: "Opções de Campanha Nebulosa" })).toBeEnabled();
  });

  it("card fechado só oferece copiar", async () => {
    mockFetch(() => page([makeLink({ state: "CLOSED" })]));
    render(<PortalsSection />);
    const menu = await openMenu("Campanha Nebulosa");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent?.trim()),
    ).toEqual(["Copiar link"]);
  });

  it("copiar usa a shortUrl e mostra Copiado", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    mockFetch(() => page([makeLink({ shortUrl: "https://lumi.example/nebulosa" })]));
    render(<PortalsSection />);
    await userEvent.click(await screen.findByRole("button", { name: "Copiar lumi.example/nebulosa" }));
    expect(writeText).toHaveBeenCalledWith("https://lumi.example/nebulosa");
    expect(await screen.findByText("Copiado")).toBeInTheDocument();
  });

  it("carregar mais busca a próxima página e soma os cards", async () => {
    const first = Array.from({ length: 20 }, (_, i) => makeLink({ code: `p${i}`, title: `Portal ${i}` }));
    const fetchMock = mockFetch((url) =>
      url.includes("page=1") ? page([makeLink({ code: "p20", title: "Portal 20" })], 21, 1) : page(first, 21),
    );
    render(<PortalsSection />);
    await screen.findByText("Portal 0");
    expect(screen.getAllByRole("article")).toHaveLength(20);
    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByText("Portal 20")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(21);
    expect(calls(fetchMock)).toContain("GET /api/links?page=1&size=20");
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("criar um portal pelo Novo portal recarrega a lista", async () => {
    const fetchMock = mockFetch((url, init) =>
      init.method === "POST" ? json(makeLink({ code: "novo" }), 201) : page([makeLink()]),
    );
    render(<PortalsSection />);
    await screen.findByText("Campanha Nebulosa");
    await userEvent.click(screen.getByRole("button", { name: /novo portal/i }));
    await userEvent.type(screen.getByPlaceholderText(/cole seu link longo/i), "exemplo.com");
    await userEvent.click(screen.getByRole("button", { name: /criar portal/i }));
    await vi.waitFor(() => expect(calls(fetchMock)).toContain("POST /api/links"), { timeout: 3000 });
    await vi.waitFor(() => expect(calls(fetchMock).filter((c) => c.startsWith("GET"))).toHaveLength(2), {
      timeout: 3000,
    });
  });

  it("visualizar abre o detalhe com humanos e robôs", async () => {
    const stats = {
      code: "nebulosa",
      totalTravels: 396,
      humanTravels: 300,
      botTravels: 96,
      travelsByDay: [
        { date: "2026-10-16", travels: 10 },
        { date: "2026-10-17", travels: 20 },
      ],
      countries: [{ country: "BR", travels: 250 }],
    };
    const fetchMock = mockFetch((url) => {
      if (url.endsWith("/stats?days=12")) return json(stats);
      if (url === "/api/links/nebulosa") return json(makeLink());
      return page([makeLink()]);
    });
    render(<PortalsSection />);
    await userEvent.click(await screen.findByRole("button", { name: /visualizar/i }));
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("humanos")).toBeInTheDocument();
    expect(within(dialog).getByText("300")).toBeInTheDocument();
    expect(within(dialog).getByText("96")).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "76% humanos, 24% robôs" })).toBeInTheDocument();
    expect(calls(fetchMock)).toEqual(
      expect.arrayContaining(["GET /api/links/nebulosa", "GET /api/links/nebulosa/stats?days=12"]),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Fechar detalhe" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
