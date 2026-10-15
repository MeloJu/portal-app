/**
 * Detecta rastreadores nos endereços da rota: parâmetros de campanha/clique (utm_*, fbclid, gclid...)
 * e domínios de redirecionamento de rastreamento. Só lê os endereços, sem fazer requisição.
 * As regras ficam em trackers.rules.ts.
 */
import { PARAM_RULES, TRACKING_DOMAINS, type ParamRule, type TrackerCategory } from "./trackers.rules.ts";

export type { TrackerCategory };
export type Tracker = {
  name: string;
  category: TrackerCategory;
  /** "param": parâmetro no endereço; "domain": o endereço passa por um domínio de rastreamento. */
  kind: "param" | "domain";
  /** O parâmetro está no destino final (e sai no link limpo). */
  inFinal: boolean;
};

const normalizeHost = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, "");

function ruleFor(key: string, host: string): ParamRule | null {
  const name = key.toLowerCase();
  for (const rule of PARAM_RULES) {
    if (rule.hosts && !rule.hosts.test(host)) continue;
    if (typeof rule.match === "string" ? rule.match === name : rule.match.test(name)) return rule;
  }
  return null;
}

function queryKeys(url: URL): string[] {
  return url.search
    .slice(1)
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const key = pair.split("=")[0].replace(/\+/g, " ");
      try {
        return decodeURIComponent(key);
      } catch {
        return key;
      }
    });
}

/** Rastreadores de uma rota: parâmetros de cada endereço e domínios de rastreamento. Sem repetidos. */
export function findTrackers(route: URL[], final: URL): Tracker[] {
  const found = new Map<string, Tracker>();
  for (const url of route) {
    const host = normalizeHost(url);
    const isFinal = url.href === final.href;
    for (const key of queryKeys(url)) {
      const rule = ruleFor(key, host);
      if (!rule) continue;
      const name = key.toLowerCase();
      const previous = found.get(`param:${name}`);
      found.set(`param:${name}`, { name, category: rule.category, kind: "param", inFinal: isFinal || (previous?.inFinal ?? false) });
    }
    const domain = TRACKING_DOMAINS.find((d) => d.host.test(host));
    if (domain && !found.has(`domain:${domain.name}`)) {
      found.set(`domain:${domain.name}`, { name: domain.name, category: domain.category, kind: "domain", inFinal: false });
    }
  }
  return [...found.values()];
}

/** Endereço sem os parâmetros de rastreamento; o resto da query fica exatamente como estava. */
export function stripTrackers(url: URL): string {
  if (!url.search) return url.href;
  const host = normalizeHost(url);
  const kept = url.search
    .slice(1)
    .split("&")
    .filter((pair) => {
      if (!pair) return false;
      const key = pair.split("=")[0].replace(/\+/g, " ");
      let decoded = key;
      try {
        decoded = decodeURIComponent(key);
      } catch {
        // chave com % inválido: compara como veio
      }
      return !ruleFor(decoded, host);
    });
  const clean = new URL(url.href);
  clean.search = kept.length ? `?${kept.join("&")}` : "";
  return clean.href;
}

/** O que a rota revela sobre rastreamento; cada campo só existe quando há algo a mostrar. */
export type TrackerReport = { trackers?: Tracker[]; cleanUrl?: string };
export type TrackerAnalyzer = (route: URL[], final: URL) => TrackerReport;

/** Ponto de entrada usado pelo unshorten: junta a detecção e o link limpo. */
export const analyzeTrackers: TrackerAnalyzer = (route, final) => {
  const trackers = findTrackers(route, final);
  const cleanUrl = stripTrackers(final);
  return {
    ...(trackers.length > 0 && { trackers }),
    ...(cleanUrl !== final.href && { cleanUrl }),
  };
};
