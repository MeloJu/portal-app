/**
 * Regras de rastreamento (dados). Para cobrir um rastreador novo basta acrescentar uma linha aqui:
 * a lógica de detecção (trackers.ts) não muda.
 * Parâmetros ambíguos (ref, id) ficam de fora: removê-los poderia quebrar o link.
 */
export type TrackerCategory = "ads" | "social" | "email" | "analytics" | "affiliate";

export type ParamRule = { match: string | RegExp; category: TrackerCategory; hosts?: RegExp };

export const PARAM_RULES: ParamRule[] = [
  { match: /^utm_[a-z0-9_]+$/, category: "analytics" },
  { match: /^(?:mtm|pk|piwik)_[a-z0-9_]+$/, category: "analytics" },
  { match: /^hsa_[a-z0-9_]+$/, category: "ads" },
  { match: /^(?:_ga|_gl|_gac|_gcl_[a-z]+)$/, category: "analytics" },
  { match: /^(?:gclid|gclsrc|dclid|gbraid|wbraid|gad_source|gad_campaignid|msclkid|yclid|_openstat|irclickid)$/, category: "ads" },
  { match: /^(?:fbclid|igshid|igsh|ttclid|twclid|li_fat_id|epik|rdt_cid|scid)$/, category: "social" },
  { match: /^(?:mc_eid|mc_cid|_hsenc|_hsmi|mkt_tok|vero_id|oly_enc_id|oly_anon_id|__s|ck_subscriber_id|s_cid)$/, category: "email" },
  { match: "si", category: "social", hosts: /(?:^|\.)(?:youtube\.com|youtu\.be|spotify\.com)$/ },
];

/** Domínios cujo papel é registrar o clique e redirecionar. */
export const TRACKING_DOMAINS: { host: RegExp; name: string; category: TrackerCategory }[] = [
  { host: /(?:^|\.)doubleclick\.net$/, name: "doubleclick.net", category: "ads" },
  { host: /(?:^|\.)googleadservices\.com$/, name: "googleadservices.com", category: "ads" },
  { host: /^l[m]?\.facebook\.com$/, name: "l.facebook.com", category: "social" },
  { host: /^out\.reddit\.com$/, name: "out.reddit.com", category: "social" },
  { host: /^t\.co$/, name: "t.co", category: "social" },
  { host: /(?:^|\.)list-manage\.com$/, name: "list-manage.com (Mailchimp)", category: "email" },
  { host: /(?:^|\.)ct\.sendgrid\.net$/, name: "sendgrid.net", category: "email" },
  { host: /(?:^|\.)mandrillapp\.com$/, name: "mandrillapp.com", category: "email" },
  { host: /(?:^|\.)hubspotlinks\.com$/, name: "hubspotlinks.com", category: "email" },
  { host: /(?:^|\.)customeriomail\.com$/, name: "customeriomail.com", category: "email" },
  { host: /(?:^|\.)linksynergy\.com$/, name: "linksynergy.com", category: "affiliate" },
  { host: /(?:^|\.)awin1\.com$/, name: "awin1.com", category: "affiliate" },
  { host: /(?:^|\.)shareasale\.com$/, name: "shareasale.com", category: "affiliate" },
  { host: /(?:^|\.)(?:anrdoezrs|jdoqocy|tkqlhce|dpbolvw|kqzyfj)\.net$/, name: "Commission Junction", category: "affiliate" },
  { host: /(?:^|\.)redirectingat\.com$/, name: "redirectingat.com", category: "affiliate" },
];
