import net from "node:net";
import { ApiError } from "../errors.ts";

/** True para endereços que nunca devem ser alcançados a partir da internet pública. */
export function isPrivateIp(ip: string): boolean {
  if (ip.startsWith("::ffff:")) return isPrivateIp(ip.slice(7));
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || /^fe[89ab]/.test(v);
  }
  return true;
}

/** Valida a URL recebida do usuário: só http/https e sem host interno óbvio. */
export function parsePublicUrl(raw: unknown): URL {
  if (typeof raw !== "string" || raw.trim().length === 0 || raw.length > 2048) {
    throw new ApiError(400, "INVALID_URL", "Informe um link válido (até 2048 caracteres).");
  }
  const text = raw.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw new ApiError(400, "INVALID_URL", "Informe um link válido.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiError(400, "INVALID_URL", "Só links http e https são aceitos.");
  }
  assertPublicHost(url);
  return url;
}

export function assertPublicHost(url: URL): void {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new ApiError(400, "FORBIDDEN_HOST", "Esse endereço não é permitido.");
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    throw new ApiError(400, "FORBIDDEN_HOST", "Esse endereço não é permitido.");
  }
}
