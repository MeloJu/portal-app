/** Links do Usuário logado (backend Spring). A sessão vai no cookie, como em auth.ts. */
import { request } from "./client";

export type LinkState = "ACTIVE" | "PAUSED" | "CLOSED";

export type Link = {
  code: string;
  /** Endereço público do portal (PUBLIC_BASE_URL + código). É o que se copia e compartilha. */
  shortUrl: string;
  targetUrl: string;
  title: string | null;
  state: LinkState;
  travelCount: number;
  expiresAt: string | null;
  maxTravels: number | null;
  createdAt: string;
};

/** `code` é o da API: INVALID_URL, SELF_LOOP, RESERVED_ALIAS, ALIAS_TAKEN, VALIDATION_ERROR... */
export class LinkError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "LinkError";
    this.status = status;
    this.code = code;
  }
}

/** O VALIDATION_ERROR do back vem em inglês e técnico (`alias: must match ...`). */
function friendlyValidation(message: string | undefined): string {
  if (message?.startsWith("alias")) return "O nome personalizado precisa ter de 3 a 32 letras, números ou hífens.";
  if (message?.startsWith("targetUrl")) return "O endereço de destino é longo demais ou está vazio.";
  if (message?.startsWith("title")) return "O título pode ter até 120 caracteres.";
  if (message?.startsWith("maxTravels")) return "O limite de viagens precisa ser um número a partir de 1.";
  return "Confira os dados do portal e tente de novo.";
}

export type LinkExtras = { title?: string | null; maxTravels?: number | null };

export async function createLink(
  targetUrl: string,
  alias: string | null,
  { title, maxTravels }: LinkExtras = {},
): Promise<Link> {
  let res: Response;
  try {
    res = await fetch("/api/links", {
      method: "POST",
      credentials: "same-origin",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ targetUrl, alias, ...(title ? { title } : {}), ...(maxTravels ? { maxTravels } : {}) }),
    });
  } catch {
    throw new LinkError(0, "NETWORK", "Não foi possível falar com a estação. Verifique sua conexão.");
  }
  if (res.ok) return (await res.json()) as Link;

  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
  if (res.status === 401)
    throw new LinkError(401, "UNAUTHORIZED", "Sua sessão expirou. Entre de novo para criar portais.");
  const code = body.code ?? "UNKNOWN";
  const message =
    code === "VALIDATION_ERROR"
      ? friendlyValidation(body.message)
      : (body.message ?? "Algo deu errado. Tente novamente.");
  throw new LinkError(res.status, code, message);
}

export type LinkPage = { items: Link[]; page: number; totalItems: number };

export type LinkStats = {
  code: string;
  totalTravels: number;
  humanTravels: number;
  botTravels: number;
  travelsByDay: { date: string; travels: number }[];
  countries: { country: string; travels: number }[];
};

export const PAGE_SIZE = 20;

const linkPath = (code: string) => `/api/links/${encodeURIComponent(code)}`;

export function listLinks(state: LinkState | null, page = 0, size = PAGE_SIZE, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  params.set("page", String(page));
  params.set("size", String(size));
  return request<LinkPage>(`/api/links?${params}`, { signal });
}

export function getLink(code: string, signal?: AbortSignal) {
  return request<Link>(linkPath(code), { signal });
}

export function getLinkStats(code: string, days = 12, signal?: AbortSignal) {
  return request<LinkStats>(`${linkPath(code)}/stats?days=${days}`, { signal });
}

export function setLinkPaused(code: string, paused: boolean) {
  return request<Link>(linkPath(code), { method: "PATCH", body: { paused } });
}

export function closeLink(code: string) {
  return request<void>(linkPath(code), { method: "DELETE" });
}
