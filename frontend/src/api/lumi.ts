/**
 * Funções tipadas do contrato da API (docs/openapi.yaml), uma por endpoint.
 * Os tipos são cópia dos schemas do contrato: mudou lá, muda aqui.
 */
import { request } from "./client";

/** Derivado: CLOSED cobre fechado manualmente, Validade vencida e maxTravels atingido, e vence PAUSED. */
export type LinkState = "ACTIVE" | "PAUSED" | "CLOSED";
export type BlockedReason = "INVALID_URL" | "SELF_LOOP" | "RESERVED_ALIAS" | "PAUSED" | "CLOSED" | "RATE_LIMIT";

export interface User {
  id: string;
  name: string;
  email: string;
}

/** O token não vem no corpo; viaja no cookie de sessão. */
export interface AuthResponse {
  expiresIn: number;
  user: User;
}

export interface Link {
  code: string;
  shortUrl: string;
  targetUrl: string;
  title: string | null;
  state: LinkState;
  travelCount: number;
  expiresAt: string | null;
  maxTravels: number | null;
  createdAt: string;
}

export interface LinkPage {
  items: Link[];
  page: number;
  totalItems: number;
}

export interface CreateLinkInput {
  /** Sem esquema vira https://. */
  targetUrl: string;
  alias?: string;
  title?: string;
  expiresAt?: string;
  maxTravels?: number;
}

export interface UpdateLinkInput {
  targetUrl?: string;
  title?: string | null;
  paused?: boolean;
  expiresAt?: string | null;
  maxTravels?: number | null;
}

export interface TravelResponse {
  targetUrl: string;
  title: string | null;
  /** Inclui esta Viagem. */
  travelCount: number;
}

/** date em YYYY-MM-DD (UTC). */
export interface TimePoint {
  date: string;
  travels: number;
}

export interface CountryCount {
  country: string;
  travels: number;
}

export interface LinkStats {
  code: string;
  totalTravels: number;
  humanTravels: number;
  botTravels: number;
  travelsByDay: TimePoint[];
  countries: CountryCount[];
}

export interface DashboardSummary {
  activeLinks: number;
  totalTravels: number;
  /** null quando o período anterior não teve Viagens. */
  travelsChangePct: number | null;
  blockedThreats: number;
}

export interface TopLink {
  code: string;
  title: string | null;
  travels: number;
}

export interface ProtectionSummary {
  blockedThreats: number;
  verifiedDestinations: number;
  /** Uma chave por motivo, inclusive os que estão em zero. */
  byReason: Record<BlockedReason, number>;
}

export interface BlockedEvent {
  reason: BlockedReason;
  code: string | null;
  occurredAt: string;
}

/** Monta a query string só com os parâmetros informados. */
function withQuery(path: string, params: Record<string, string | number | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

const linkPath = (code: string) => `/api/links/${encodeURIComponent(code)}`;

export const api = {
  // auth
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body: { name, email, password } }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/me"),

  // links
  listLinks: (params: { state?: LinkState; page?: number; size?: number } = {}) =>
    request<LinkPage>(withQuery("/api/links", params)),
  createLink: (input: CreateLinkInput) => request<Link>("/api/links", { method: "POST", body: input }),
  getLink: (code: string) => request<Link>(linkPath(code)),
  updateLink: (code: string, input: UpdateLinkInput) => request<Link>(linkPath(code), { method: "PATCH", body: input }),
  /** Soft delete: o Link vira CLOSED e mantém o histórico. Idempotente. */
  closeLink: (code: string) => request<void>(linkPath(code), { method: "DELETE" }),
  linkStats: (code: string, days?: number) => request<LinkStats>(withQuery(`${linkPath(code)}/stats`, { days })),

  // travel (público): 404 inexistente, 410 Fechado, 423 Pausado
  travel: (code: string) => request<TravelResponse>(`/api/travel/${encodeURIComponent(code)}`),

  // dashboard
  dashboardSummary: (days?: number) => request<DashboardSummary>(withQuery("/api/dashboard/summary", { days })),
  dashboardTravels: (days?: number) => request<TimePoint[]>(withQuery("/api/dashboard/travels", { days })),
  topLinks: (limit?: number) => request<TopLink[]>(withQuery("/api/dashboard/top-links", { limit })),
  countries: () => request<CountryCount[]>("/api/dashboard/countries"),

  // protection
  protectionSummary: () => request<ProtectionSummary>("/api/protection/summary"),
  protectionEvents: (limit?: number) => request<BlockedEvent[]>(withQuery("/api/protection/events", { limit })),
};
