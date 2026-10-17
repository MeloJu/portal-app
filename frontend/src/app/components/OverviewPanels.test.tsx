import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Overview } from "../../api/dashboard";
import { OrbitStation, StatsGrid, TravelFlowPanel } from "./OverviewPanels";

const data: Overview = {
  summary: { activeLinks: 24, totalTravels: 8429, travelsChangePct: 18.4, blockedThreats: 137 },
  travels: [
    { date: "2026-10-14", travels: 2 },
    { date: "2026-10-15", travels: 0 },
    { date: "2026-10-16", travels: 8 },
  ],
  topLinks: [
    { code: "nebulosa", title: "Campanha Nebulosa", travels: 1248 },
    { code: "aB3x9Q", title: null, travels: 396 },
  ],
};

const card = (label: string) => screen.getByText(label).closest("article")!;

describe("StatsGrid", () => {
  it("mostra os números do summary", () => {
    render(<StatsGrid overview={data} />);
    expect(within(card("Portais ativos")).getByText("24")).toBeInTheDocument();
    expect(within(card("Viagens realizadas")).getByText("8.429")).toBeInTheDocument();
    expect(within(card("Viagens realizadas")).getByText("+18,4%")).toBeInTheDocument();
    expect(within(card("Ameaças bloqueadas")).getByText("137")).toBeInTheDocument();
  });

  it("variação negativa e sem período anterior", () => {
    const { rerender } = render(
      <StatsGrid overview={{ ...data, summary: { ...data.summary, travelsChangePct: -3 } }} />,
    );
    expect(screen.getByText("-3%")).toBeInTheDocument();
    rerender(<StatsGrid overview={{ ...data, summary: { ...data.summary, travelsChangePct: null } }} />);
    expect(within(card("Viagens realizadas")).getByText(/sem viagens nos 12 dias anteriores/i)).toBeInTheDocument();
  });

  it("antes de carregar mostra traços", () => {
    render(<StatsGrid overview={null} />);
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});

describe("TravelFlowPanel", () => {
  it("desenha uma barra por dia proporcional ao maior e destaca hoje", () => {
    const { container } = render(<TravelFlowPanel overview={data} />);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("+18,4%")).toBeInTheDocument();
    const bars = container.querySelectorAll<HTMLElement>(".bars span");
    expect(bars).toHaveLength(3);
    expect(bars[0]!.style.height).toBe("25%");
    expect(bars[2]!.style.height).toBe("100%");
    expect(bars[2]).toHaveClass("highlight");
    expect(screen.getByText("14 out")).toBeInTheDocument();
    expect(screen.getByText("16 out")).toBeInTheDocument();
  });

  it("sem viagens não divide por zero", () => {
    const empty = { ...data, travels: data.travels.map((point) => ({ ...point, travels: 0 })) };
    const { container } = render(<TravelFlowPanel overview={empty} />);
    for (const bar of container.querySelectorAll<HTMLElement>(".bars span")) expect(bar.style.height).toBe("0%");
  });
});

describe("OrbitStation", () => {
  it("lista os portais com mais viagens, usando o código quando não há título", () => {
    render(<OrbitStation overview={data} />);
    expect(screen.getByText("Campanha Nebulosa")).toBeInTheDocument();
    expect(screen.getByText("1.248 viajantes")).toBeInTheDocument();
    expect(screen.getByText("aB3x9Q")).toBeInTheDocument();
    expect(screen.getByText(/24 ativos agora/i)).toBeInTheDocument();
  });

  it("sem viagens convida a compartilhar um portal", () => {
    render(<OrbitStation overview={{ ...data, topLinks: [] }} />);
    expect(screen.getByText(/nenhuma viagem ainda/i)).toBeInTheDocument();
  });
});
