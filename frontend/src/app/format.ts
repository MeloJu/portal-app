const numberFormat = new Intl.NumberFormat("pt-BR");

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

export function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, "");
}
