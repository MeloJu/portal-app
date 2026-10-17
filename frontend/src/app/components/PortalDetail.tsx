import { useEffect } from "react";
import { getLink, getLinkStats } from "../../api/links";
import { formatNumber, stripProtocol } from "../format";
import { useApi } from "../useApi";
import { portalName, stateBadge, toneFor } from "./PortalCard";

const STATS_DAYS = 12;

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
const dayLabel = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`)).replace(".", "");

type Props = { code: string; onClose: () => void };

export default function PortalDetail({ code, onClose }: Props) {
  const { data, error, loading, reload } = useApi(
    (signal) => Promise.all([getLink(code, signal), getLinkStats(code, STATS_DAYS, signal)]),
    [code],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [link, stats] = data ?? [null, null];
  const total = stats ? stats.humanTravels + stats.botTravels : 0;
  const humanPct = total ? Math.round((stats!.humanTravels / total) * 100) : 0;
  const peak = stats ? Math.max(1, ...stats.travelsByDay.map((point) => point.travels)) : 1;

  return (
    <div className="portal-detail-backdrop" onClick={onClose}>
      <section
        aria-labelledby="portal-detail-title"
        aria-modal="true"
        className="portal-detail"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <div>
            <span>DETALHE DO PORTAL</span>
            <h2 id="portal-detail-title">{link ? portalName(link) : code}</h2>
          </div>
          <button aria-label="Fechar detalhe" onClick={onClose} type="button">
            ×
          </button>
        </header>

        {!data && loading && (
          <div className="portal-detail-loading" role="status">
            Carregando portal...
          </div>
        )}

        {!data && error && (
          <div className="portal-detail-error" role="alert">
            <p>{error.message}</p>
            <button onClick={reload} type="button">
              Tentar de novo
            </button>
          </div>
        )}

        {link && stats && (
          <>
            <div className="portal-detail-meta">
              <span className={`portal-status ${stateBadge(link).tone}`}>
                <i /> {stateBadge(link).label}
              </span>
              <strong className={`portal-detail-short ${toneFor(link.code)}`}>{stripProtocol(link.shortUrl)}</strong>
              <p title={link.targetUrl}>{stripProtocol(link.targetUrl)}</p>
            </div>

            <div className="portal-detail-numbers">
              <article>
                <strong>{formatNumber(stats.totalTravels)}</strong>
                <span>viagens{link.maxTravels !== null && ` de ${formatNumber(link.maxTravels)}`}</span>
              </article>
              <article>
                <strong>{formatNumber(stats.humanTravels)}</strong>
                <span>humanos</span>
              </article>
              <article>
                <strong>{formatNumber(stats.botTravels)}</strong>
                <span>robôs</span>
              </article>
            </div>

            <div
              aria-label={`${humanPct}% humanos, ${100 - humanPct}% robôs`}
              className="portal-detail-split"
              role="img"
            >
              <i style={{ width: `${total ? humanPct : 0}%` }} />
              <b style={{ width: `${total ? 100 - humanPct : 0}%` }} />
            </div>

            <div className="portal-detail-chart">
              <span>ÚLTIMOS {STATS_DAYS} DIAS</span>
              <div className="portal-detail-bars">
                {stats.travelsByDay.map((point) => (
                  <i
                    key={point.date}
                    style={{ height: `${Math.max(4, (point.travels / peak) * 100)}%` }}
                    title={`${dayLabel(point.date)}: ${formatNumber(point.travels)} viagens`}
                  />
                ))}
              </div>
              {stats.travelsByDay.length > 0 && (
                <div className="portal-detail-axis">
                  <small>{dayLabel(stats.travelsByDay[0]!.date)}</small>
                  <small>{dayLabel(stats.travelsByDay[stats.travelsByDay.length - 1]!.date)}</small>
                </div>
              )}
            </div>

            {stats.countries.length > 0 && (
              <ul className="portal-detail-countries">
                {stats.countries.slice(0, 5).map((country) => (
                  <li key={country.country}>
                    <span>{country.country}</span>
                    <strong>{formatNumber(country.travels)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
