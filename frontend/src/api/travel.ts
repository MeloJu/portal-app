/**
 * Travessia pública: GET /api/travel/{code} registra a Viagem e devolve o destino. Cada chamada
 * conta uma Viagem no backend, então quem chama deve fazê-la uma única vez por visita.
 */
export type TravelOutcome =
  | { status: "ok"; targetUrl: string; title: string | null; travelCount: number }
  | { status: "not_found" }
  | { status: "paused" }
  | { status: "closed" }
  | { status: "rate_limited"; retryAfter: number | null }
  | { status: "error" };

/** Nunca lança: todo desfecho vira um estado que a Travessia sabe mostrar. */
export async function travel(code: string): Promise<TravelOutcome> {
  let res: Response;
  try {
    res = await fetch(`/api/travel/${encodeURIComponent(code)}`, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
  } catch {
    return { status: "error" };
  }

  if (res.ok) {
    const body = (await res.json().catch(() => null)) as {
      targetUrl?: string;
      title?: string | null;
      travelCount?: number;
    } | null;
    if (!body?.targetUrl) return { status: "error" };
    return { status: "ok", targetUrl: body.targetUrl, title: body.title ?? null, travelCount: body.travelCount ?? 0 };
  }
  if (res.status === 404) return { status: "not_found" };
  if (res.status === 423) return { status: "paused" };
  if (res.status === 410) return { status: "closed" };
  if (res.status === 429) {
    const seconds = Number(res.headers.get("Retry-After"));
    return { status: "rate_limited", retryAfter: Number.isFinite(seconds) && seconds > 0 ? seconds : null };
  }
  return { status: "error" };
}
