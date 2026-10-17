/** Links do Usuário logado (backend Spring). A sessão vai no cookie, como em auth.ts. */
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
  return "Confira os dados do portal e tente de novo.";
}

export async function createLink(targetUrl: string, alias: string | null): Promise<Link> {
  let res: Response;
  try {
    res = await fetch("/api/links", {
      method: "POST",
      credentials: "same-origin",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ targetUrl, alias }),
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
