import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlockedEvent, ProtectionSummary } from "../../api/lumi";
import { relativeTime } from "../format";
import ProtectionSection, { REASON_LABELS } from "./ProtectionSection";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const SUMMARY: ProtectionSummary = {
  blockedThreats: 137,
  verifiedDestinations: 24,
  byReason: { INVALID_URL: 4, SELF_LOOP: 1, RESERVED_ALIAS: 2, PAUSED: 30, CLOSED: 0, RATE_LIMIT: 100 },
};

type Data = { summary?: ProtectionSummary; events?: BlockedEvent[] };

function mockApi({ summary = SUMMARY, events = [] }: Data = {}) {
  const fetchMock = vi.fn((url: string) => {
    if (url.startsWith("/api/protection/summary")) return Promise.resolve(json(summary));
    if (url.startsWith("/api/protection/events")) return Promise.resolve(json(events));
    return Promise.resolve(json({ code: "NOT_FOUND", message: "rota inesperada" }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const card = (label: string) => screen.getByText(label).closest("article")!;

afterEach(() => vi.unstubAllGlobals());

describe("ProtectionSection", () => {
  it("pede o resumo e os 20 eventos mais recentes", async () => {
    const fetchMock = mockApi();
    render(<ProtectionSection />);
    await screen.findByText("AMEAÇAS BLOQUEADAS");
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toEqual(expect.arrayContaining(["/api/protection/summary", "/api/protection/events?limit=20"]));
  });

  it("mostra os cards com os números da API", async () => {
    mockApi();
    render(<ProtectionSection />);
    await screen.findByText("AMEAÇAS BLOQUEADAS");
    expect(within(card("AMEAÇAS BLOQUEADAS")).getByText("137")).toBeInTheDocument();
    expect(within(card("DESTINOS VERIFICADOS")).getByText("24")).toBeInTheDocument();
    expect(screen.queryByText("ÍNDICE DE PROTEÇÃO")).not.toBeInTheDocument();
    expect(screen.queryByText("TRÁFEGO FILTRADO")).not.toBeInTheDocument();
  });

  it("quebra por motivo tem uma linha por chave com rótulo e contagem", async () => {
    mockApi();
    render(<ProtectionSection />);
    const list = await screen.findByRole("list", { name: "Bloqueios por motivo" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(6);
    for (const [reason, count] of Object.entries(SUMMARY.byReason)) {
      const row = within(list)
        .getByText(REASON_LABELS[reason as keyof typeof REASON_LABELS])
        .closest("li")!;
      expect(within(row).getByText(String(count))).toBeInTheDocument();
    }
  });

  it("histórico mostra rótulo, código e tempo relativo", async () => {
    const occurredAt = new Date(Date.now() - 12 * 60_000).toISOString();
    mockApi({
      events: [
        { reason: "RATE_LIMIT", code: "nebulosa", occurredAt },
        { reason: "INVALID_URL", code: null, occurredAt },
      ],
    });
    render(<ProtectionSection />);
    const log = (await screen.findByText("Atividade de proteção recente")).closest("article")!;
    const rows = log.querySelectorAll(".threat-row");
    expect(rows).toHaveLength(2);
    const [first, second] = [...rows] as HTMLElement[];
    expect(within(first!).getByText("Excesso de tentativas bloqueado")).toBeInTheDocument();
    expect(within(first!).getByText("nebulosa")).toBeInTheDocument();
    expect(within(first!).getByText(relativeTime(occurredAt))).toBeInTheDocument();
    expect(within(second!).getByText("Destino inválido recusado")).toBeInTheDocument();
    expect(within(second!).getByText("—")).toBeInTheDocument();
  });

  it("sem eventos mostra estado vazio", async () => {
    mockApi({
      summary: {
        blockedThreats: 0,
        verifiedDestinations: 0,
        byReason: { INVALID_URL: 0, SELF_LOOP: 0, RESERVED_ALIAS: 0, PAUSED: 0, CLOSED: 0, RATE_LIMIT: 0 },
      },
    });
    render(<ProtectionSection />);
    expect(await screen.findByText("Nenhuma ameaça até agora. A Lumi segue de vigia.")).toBeInTheDocument();
    expect(within(card("AMEAÇAS BLOQUEADAS")).getByText("0")).toBeInTheDocument();
    expect(document.querySelector(".threat-row")).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it("erro da API aparece com opção de tentar de novo", async () => {
    const fetchMock = mockApi();
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json({ code: "INTERNAL", message: "Algo deu errado. Tente novamente." }, 500)),
    );
    render(<ProtectionSection />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Algo deu errado. Tente novamente.");
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("AMEAÇAS BLOQUEADAS")).toBeInTheDocument();
  });
});
