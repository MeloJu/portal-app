/**
 * Cliente de autenticação da API (backend Spring). A sessão fica num cookie HttpOnly que o
 * navegador manda sozinho: o front nunca vê nem guarda o token.
 */
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
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new AuthError(res.status, body.code ?? "UNKNOWN", body.message ?? "Algo deu errado. Tente novamente.");
  }
  return res;
}

export async function login(email: string, password: string): Promise<User> {
  const res = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  return ((await res.json()) as { user: User }).user;
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

/** Usuário da sessão atual, ou null sem sessão. Sem conexão com a API também devolve null (vai para o login). */
export async function currentUser(): Promise<User | null> {
  try {
    return (await (await request("/api/me")).json()) as User;
  } catch (err) {
    if (err instanceof AuthError && (err.status === 401 || err.status === 0)) return null;
    throw err;
  }
}
