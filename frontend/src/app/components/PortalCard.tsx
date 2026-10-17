import { useEffect, useRef, useState } from "react";
import { closeLink, setLinkPaused, type Link } from "../../api/links";
import { formatNumber, stripProtocol } from "../format";
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
  onChanged: () => void;
  onOpen: (code: string) => void;
};

export default function PortalCard({ link, onChanged, onOpen }: Props) {
  const copiedTimerRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => () => window.clearTimeout(copiedTimerRef.current), []);

  const name = portalName(link);
  const badge = stateBadge(link);
  const closed = link.state === "CLOSED";
  const paused = link.state === "PAUSED";

  async function copy() {
    setMenuOpen(false);
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

  async function run(action: () => Promise<unknown>) {
    setMenuOpen(false);
    setBusy(true);
    setError("");
    try {
      await action();
      setConfirming(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`library-card ${closed ? "is-closed" : ""}`} aria-busy={busy}>
      <div className={`library-portal ${toneFor(link.code)}`}>
        <i />
        <span>{icons.link}</span>
      </div>
      <div className="library-card-top">
        <span className={`portal-status ${badge.tone}`}>
          <i /> {badge.label}
        </span>
        <div className="library-menu">
          <button
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={`Opções de ${name}`}
            disabled={busy}
            onClick={() => {
              setConfirming(false);
              setMenuOpen(!menuOpen);
            }}
            type="button"
          >
            •••
          </button>
          {menuOpen && (
            <div className="library-menu-list" role="menu" aria-label={`Opções de ${name}`}>
              <button onClick={copy} role="menuitem" type="button">
                {icons.copy} Copiar link
              </button>
              {!closed && (
                <>
                  <button onClick={() => run(() => setLinkPaused(link.code, !paused))} role="menuitem" type="button">
                    {paused ? "Retomar portal" : "Pausar portal"}
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirming(true);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Fechar portal
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <h2>{name}</h2>
      <button aria-label={`Copiar ${stripProtocol(link.shortUrl)}`} className="short-link" onClick={copy} type="button">
        {stripProtocol(link.shortUrl)} {copied ? icons.check : icons.copy}
      </button>
      {copied && (
        <span className="library-copied" role="status">
          Copiado
        </span>
      )}
      <div className="destination-line">
        <span>DESTINO</span>
        <p title={link.targetUrl}>{stripProtocol(link.targetUrl)}</p>
      </div>
      {confirming ? (
        <div className="library-confirm" role="group" aria-label={`Fechar ${name}`}>
          <span>Fechar portal?</span>
          <button className="danger" disabled={busy} onClick={() => run(() => closeLink(link.code))} type="button">
            {busy ? "Fechando..." : "Sim"}
          </button>
          <button disabled={busy} onClick={() => setConfirming(false)} type="button">
            Não
          </button>
        </div>
      ) : (
        <div className="library-footer">
          <div>
            <strong>
              {formatNumber(link.travelCount)}
              {link.maxTravels !== null && ` / ${formatNumber(link.maxTravels)}`}
            </strong>
            <span>viagens</span>
          </div>
          <button onClick={() => onOpen(link.code)} type="button">
            Visualizar {icons.arrow}
          </button>
        </div>
      )}
      {error && (
        <p className="library-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
