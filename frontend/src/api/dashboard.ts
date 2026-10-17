/** Leitura da Visão geral (backend Spring). A sessão vai no cookie, como em auth.ts. */
import { request } from "./client";

export type DashboardSummary = {
  activeLinks: number;
  totalTravels: number;
  /** null quando o período anterior não teve Viagens: não existe percentual. */
  travelsChangePct: number | null;
  blockedThreats: number;
};

export type TimePoint = { date: string; travels: number };
export type TopLink = { code: string; title: string | null; travels: number };
export type Overview = { summary: DashboardSummary; travels: TimePoint[]; topLinks: TopLink[] };

const get = <T>(path: string) => request<T>(path, { headers: { accept: "application/json" } });

/** Tudo o que a Visão geral mostra, numa ida só. `days` é a janela do gráfico e da variação. */
export async function getOverview(days: number): Promise<Overview> {
  const [summary, travels, topLinks] = await Promise.all([
    get<DashboardSummary>(`/api/dashboard/summary?days=${days}`),
    get<TimePoint[]>(`/api/dashboard/travels?days=${days}`),
    get<TopLink[]>("/api/dashboard/top-links?limit=3"),
  ]);
  return { summary, travels, topLinks };
}
