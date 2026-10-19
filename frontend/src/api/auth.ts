/**
 * Cliente de autenticação da API (backend Spring). A sessão fica num cookie HttpOnly que o
 * navegador manda sozinho: o front nunca vê nem guarda o token.
 */
import { isOfflineResponse, OFFLINE_MESSAGE } from "./offline";

export type User = { id: string; name: string; email: string };

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }

  get isInvalidCredentials() {
    return this.status === 401;
  }

  get isTokenExpired() {
    return this.code === "TOKEN_EXPIRED";
  }

  get isTokenInvalid() {
    return this.code === "TOKEN_INVALID";
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
    });
  } catch {
    throw new AuthError(0, "NETWORK", "Não foi possível falar com a estação. Verifique sua conexão.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (isOfflineResponse(res.status, body !== null)) throw new AuthError(res.status, "OFFLINE", OFFLINE_MESSAGE);
    throw new AuthError(res.status, body?.code ?? "UNKNOWN", body?.message ?? "Algo deu errado. Tente novamente.");
  }
  return res;
}

export async function login(email: string, password: string): Promise<User> {
  const res = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  return ((await res.json()) as { user: User }).user;
}

/** Cria a conta e já abre a sessão (a API devolve o cookie, como no login). */
export async function register(name: string, email: string, password: string): Promise<User> {
  const res = await request("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
  return ((await res.json()) as { user: User }).user;
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

export async function verifyEmail(token: string): Promise<void> {
  await request("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
}

export async function resendVerification(): Promise<void> {
  await request("/api/auth/resend-verification", { method: "POST" });
}

/** Usuário da sessão atual, ou null sem sessão. API fora do ar lança (a rota mostra a tela de estação fora do ar). */
export async function currentUser(): Promise<User | null> {
  try {
    return (await (await request("/api/me")).json()) as User;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) return null;
    throw err;
  }
}
