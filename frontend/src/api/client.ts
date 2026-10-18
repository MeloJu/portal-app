/** Cliente HTTP do backend da Lumi (/api). A sessão vai no cookie lumi_session, nunca lido pelo front. */

import { isOfflineResponse, OFFLINE_MESSAGE } from "./offline";

export const UNAUTHORIZED_EVENT = "lumi:unauthorized";

type ErrorBody = { code?: string; message?: string };

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type RequestOptions = Omit<RequestInit, "body" | "credentials"> & { body?: unknown };

export async function request<T>(path: string, { body, headers, ...init }: RequestOptions = {}): Promise<T> {
  const hasBody = body !== undefined;
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: hasBody ? { "content-type": "application/json", ...headers } : headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch (err) {
    if (init.signal?.aborted) throw err;
    throw new ApiError(0, "NETWORK", "Não foi possível falar com a Lumi. Verifique sua conexão e tente de novo.");
  }

  let data: unknown = undefined;
  let hasJsonBody = false;
  try {
    data = await res.json();
    hasJsonBody = true;
  } catch {}

  if (res.status === 401) window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));

  if (!res.ok) {
    if (isOfflineResponse(res.status, hasJsonBody)) throw new ApiError(res.status, "OFFLINE", OFFLINE_MESSAGE);
    const err = (data ?? {}) as ErrorBody;
    throw new ApiError(res.status, err.code ?? "UNKNOWN", err.message ?? "Algo deu errado. Tente novamente.");
  }
  return data as T;
}
