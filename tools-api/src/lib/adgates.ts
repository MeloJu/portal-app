/**
 * Serviços de "link com anúncio": o destino só aparece depois de anúncios, timers ou verificações.
 * Seguir os redirecionamentos termina na página de anúncio, não no destino real.
 */
const AD_GATE_DOMAINS = [
  "linkvertise.com",
  "link-to.net",
  "link-center.net",
  "link-target.net",
  "direct-link.net",
  "up-to-down.net",
  "work.ink",
  "lootlinks.com",
  "loot-link.com",
  "loot-links.com",
  "lootlabs.gg",
  "adf.ly",
  "adfoc.us",
  "boost.ink",
  "mboost.me",
  "bst.gg",
  "rekonise.com",
  "sub2get.com",
  "sub2unlock.com",
  "sub2unlock.net",
  "sh.st",
  "shorte.st",
  "cuty.io",
  "cety.io",
  "exe.io",
  "exey.io",
  "ouo.io",
  "ouo.press",
  "shrinkme.io",
  "paster.so",
];

export function isAdGate(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return AD_GATE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
