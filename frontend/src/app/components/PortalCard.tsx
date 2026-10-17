import { useEffect, useRef, useState } from "react";
import type { Link } from "../../api/lumi";
import { formatNumber, shortLabel } from "../format";
import { icons } from "../icons";

const TONES = ["violet", "cyan", "blue", "pink", "amber", "indigo"] as const;

export function toneFor(code: string) {
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length]!;
}

export function stateBadge(link: Link): { label: string; tone: string } {
  switch (link.state) {
    case "ACTIVE":
      return { label: "Ativo", tone: "ativo" };
    case "PAUSED":
      return { label: "Pausado", tone: "pausado" };
    case "CLOSED":
      if (link.maxTravels !== null && link.travelCount >= link.maxTravels)
        return { label: "Esgotado", tone: "fechado" };
      if (link.expiresAt !== null && Date.parse(link.expiresAt) <= Date.now())
        return { label: "Expirado", tone: "fechado" };
      return { label: "Fechado", tone: "fechado" };
    default:
      return { label: String(link.state), tone: "desconhecido" };
  }
}

export function portalName(link: Link) {
  return link.title?.trim() || link.code;
}

type Props = {
  link: Link;
};

export default function PortalCard({ link }: Props) {
  const copiedTimerRef = useRef(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => () => window.clearTimeout(copiedTimerRef.current), []);

  const name = portalName(link);
  const badge = stateBadge(link);

  async function copy() {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(link.shortUrl);
    } catch {
      return;
    }
    window.clearTimeout(copiedTimerRef.current);
    setCopied(true);
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className="library-card">
      <div className={`library-portal ${toneFor(link.code)}`}>
        <i />
        <span>{icons.link}</span>
      </div>
      <div className="library-card-top">
        <span className={`portal-status ${badge.tone}`}>
          <i /> {badge.label}
        </span>
      </div>
      <h2>{name}</h2>
      <button aria-label={`Copiar ${shortLabel(link.shortUrl)}`} className="short-link" onClick={copy} type="button">
        {shortLabel(link.shortUrl)} {copied ? icons.check : icons.copy}
      </button>
      {copied && (
        <span className="library-copied" role="status">
          Copiado
        </span>
      )}
      <div className="destination-line">
        <span>DESTINO</span>
        <p title={link.targetUrl}>{shortLabel(link.targetUrl)}</p>
      </div>
      <div className="library-footer">
        <div>
          <strong>
            {formatNumber(link.travelCount)}
            {link.maxTravels !== null && ` / ${formatNumber(link.maxTravels)}`}
          </strong>
          <span>viagens</span>
        </div>
      </div>
    </article>
  );
}
