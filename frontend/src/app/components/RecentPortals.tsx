import { useEffect, useRef, useState } from "react";
import { api } from "../../api/lumi";
import { useApi } from "../../api/useApi";
import { formatNumber, shortLabel } from "../format";
import { icons } from "../icons";
import { portalName, stateBadge } from "./PortalCard";

const RECENT_LIMIT = 3;
const ORB_TONES = ["violet", "cyan", "blue"] as const;

type Props = {
  version: number;
  onSeeAll: () => void;
};

export default function RecentPortals({ version, onSeeAll }: Props) {
  const { data, error } = useApi(() => api.listLinks({ size: RECENT_LIMIT }), [version]);
  const copiedTimerRef = useRef(0);
  const [copied, setCopied] = useState("");

  useEffect(() => () => window.clearTimeout(copiedTimerRef.current), []);

  async function copyLink(shortUrl: string) {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
    } catch {
      return;
    }
    window.clearTimeout(copiedTimerRef.current);
    setCopied(shortUrl);
    copiedTimerRef.current = window.setTimeout(() => setCopied(""), 1600);
  }

  function previewPortal(code: string) {
    window.open(`/${encodeURIComponent(code)}`, "_blank", "noopener,noreferrer");
  }

  const items = data?.items ?? [];

  return (
    <article className="panel links-panel">
      <div className="panel-heading">
        <div>
          <span>PORTAIS RECENTES</span>
          <h3>Últimos links criados</h3>
        </div>
        <button onClick={onSeeAll} type="button">
          Ver todos {icons.arrow}
        </button>
      </div>
      <div className="links-list" aria-busy={!data && !error}>
        {!data && error && (
          <p className="links-empty" role="alert">
            {error.message}
          </p>
        )}
        {data && items.length === 0 && <p className="links-empty">Você ainda não abriu nenhum portal.</p>}
        {items.map((link, index) => {
          const name = portalName(link);
          return (
            <div className="link-row" key={link.code}>
              <div className={`link-orb ${ORB_TONES[index % ORB_TONES.length]}`}>
                <i />
              </div>
              <div className="link-info">
                <strong>{name}</strong>
                <button onClick={() => copyLink(link.shortUrl)} type="button">
                  {shortLabel(link.shortUrl)} {copied === link.shortUrl ? icons.check : icons.copy}
                </button>
              </div>
              <div className="click-count">
                <strong>{formatNumber(link.travelCount)}</strong>
                <span>viagens</span>
              </div>
              <span className="change">{stateBadge(link).label}</span>
              <button
                className="row-preview"
                aria-label={`Visualizar portal ${name}`}
                onClick={() => previewPortal(link.code)}
                title="Visualizar portal (a pré-visualização conta como uma viagem)"
                type="button"
              >
                {icons.arrow}
              </button>
            </div>
          );
        })}
      </div>
    </article>
  );
}
