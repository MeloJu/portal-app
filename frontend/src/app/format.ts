/** Formatadores de exibição (pt-BR) para os números e datas que vêm da API. */

const numberFormat = new Intl.NumberFormat("pt-BR");
const pctFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});


export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/*porcentagem*/
export function formatPct(p: number | null): string {
  return p === null ? "—" : `${pctFormat.format(p)}%`;
}


export function shortLabel(shortUrl: string): string {
  try {
    const url = new URL(shortUrl);
    return url.pathname === "/" ? url.host : url.host + url.pathname;
  } catch {
    return shortUrl;
  }
}


export function relativeTime(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Há ${days} ${days === 1 ? "dia" : "dias"}`;
}
