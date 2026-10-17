import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/dashboard";
import { useOverview } from "./useOverview";

vi.mock("../api/dashboard", () => ({ getOverview: vi.fn() }));
const getOverview = vi.mocked(api.getOverview);

const overview = (totalTravels: number): api.Overview => ({
  summary: { activeLinks: 1, totalTravels, travelsChangePct: null, blockedThreats: 0 },
  travels: [],
  topLinks: [],
});

function Probe({ intervalMs, version = 0 }: { intervalMs: number; version?: number }) {
  const data = useOverview(intervalMs, 12, version);
  return <p>total: {data ? data.summary.totalTravels : "carregando"}</p>;
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
}

describe("useOverview", () => {
  beforeEach(() => {
    getOverview.mockReset();
    setHidden(false);
  });

  it("carrega e segue consultando: o número sobe depois da Viagem", async () => {
    getOverview.mockResolvedValueOnce(overview(7)).mockResolvedValue(overview(8));
    render(<Probe intervalMs={30} />);
    expect(screen.getByText("total: carregando")).toBeInTheDocument();
    expect(await screen.findByText("total: 7")).toBeInTheDocument();
    expect(await screen.findByText("total: 8")).toBeInTheDocument();
    expect(getOverview).toHaveBeenCalledWith(12);
  });

  it("mantém o último dado quando uma consulta falha", async () => {
    getOverview.mockResolvedValueOnce(overview(7)).mockRejectedValue(new Error("500"));
    render(<Probe intervalMs={20} />);
    expect(await screen.findByText("total: 7")).toBeInTheDocument();
    await vi.waitFor(() => expect(getOverview.mock.calls.length).toBeGreaterThan(2));
    expect(screen.getByText("total: 7")).toBeInTheDocument();
  });

  it("não consulta com a aba escondida e atualiza na hora ao voltar", async () => {
    getOverview.mockResolvedValueOnce(overview(7)).mockResolvedValue(overview(9));
    render(<Probe intervalMs={20} />);
    expect(await screen.findByText("total: 7")).toBeInTheDocument();

    setHidden(true);
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    const calls = getOverview.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(getOverview.mock.calls.length).toBe(calls);

    setHidden(false);
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(await screen.findByText("total: 9")).toBeInTheDocument();
  });

  it("consulta na hora quando a janela volta ao foco", async () => {
    getOverview.mockResolvedValueOnce(overview(7)).mockResolvedValue(overview(10));
    render(<Probe intervalMs={60_000} />);
    expect(await screen.findByText("total: 7")).toBeInTheDocument();
    act(() => void window.dispatchEvent(new Event("focus")));
    expect(await screen.findByText("total: 10")).toBeInTheDocument();
    expect(getOverview).toHaveBeenCalledTimes(2);
  });

  it("consulta na hora quando a versão muda", async () => {
    getOverview.mockResolvedValueOnce(overview(7)).mockResolvedValue(overview(11));
    const { rerender } = render(<Probe intervalMs={60_000} />);
    expect(await screen.findByText("total: 7")).toBeInTheDocument();
    rerender(<Probe intervalMs={60_000} version={1} />);
    expect(await screen.findByText("total: 11")).toBeInTheDocument();
    expect(getOverview).toHaveBeenCalledTimes(2);
  });

  it("para de consultar ao desmontar", async () => {
    getOverview.mockResolvedValue(overview(7));
    const { unmount } = render(<Probe intervalMs={20} />);
    await screen.findByText("total: 7");
    unmount();
    const calls = getOverview.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(getOverview.mock.calls.length).toBe(calls);
  });
});
