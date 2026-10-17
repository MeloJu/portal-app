import { Fragment } from "react";
import type { Overview } from "../../api/dashboard";
import { icons } from "../icons";
import AnimatedNumber from "./AnimatedNumber";

const pctFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const countFormatter = new Intl.NumberFormat("pt-BR");
const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const orbitTones = ["violet", "cyan", "blue"] as const;

/** Mesma janela pedida em useOverview: o texto da variação fala desses dias. */
const WINDOW_DAYS = 12;

function formatPct(pct: number) {
  return `${pct > 0 ? "+" : ""}${pctFormatter.format(pct)}%`;
}

/** "2026-10-14" → "14 out". A série vem em dias UTC, então o rótulo não passa pelo fuso local. */
export function dayLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${day} ${months[Number(month) - 1] ?? ""}`;
}

type Props = { overview: Overview | null };

export function StatsGrid({ overview }: Props) {
  const summary = overview?.summary;
  const pct = summary?.travelsChangePct;
  return (
    <section className="stats-grid">
      <article className="stat-card">
        <div className="stat-icon violet">{icons.link}</div>
        <div>
          <span>Portais ativos</span>
          <strong>
            <AnimatedNumber value={summary?.activeLinks ?? null} />
          </strong>
          <small>prontos para viajar</small>
        </div>
        <div className="mini-stars">
          <i />
          <i />
          <i />
        </div>
      </article>
      <article className="stat-card">
        <div className="stat-icon cyan">{icons.chart}</div>
        <div>
          <span>Viagens realizadas</span>
          <strong>
            <AnimatedNumber value={summary?.totalTravels ?? null} />
          </strong>
          {summary &&
            (pct === null || pct === undefined ? (
              <small>sem viagens nos {WINDOW_DAYS} dias anteriores</small>
            ) : (
              <small>
                <b>{formatPct(pct)}</b> vs. {WINDOW_DAYS} dias anteriores
              </small>
            ))}
        </div>
      </article>
      <article className="stat-card">
        <div className="stat-icon blue">{icons.shield}</div>
        <div>
          <span>Ameaças bloqueadas</span>
          <strong>
            <AnimatedNumber value={summary?.blockedThreats ?? null} />
          </strong>
          <small>rotas barradas pela Lumi</small>
        </div>
      </article>
    </section>
  );
}

export function OrbitStation({ overview }: Props) {
  const topLinks = overview?.topLinks ?? [];
  return (
    <article className="portal-station">
      <div className="station-heading">
        <div>
          <span>ESTAÇÃO L²</span>
          <h3>Portais em órbita</h3>
        </div>
        <b>
          <i /> {overview ? countFormatter.format(overview.summary.activeLinks) : "—"} ativos agora
        </b>
      </div>
      <div className="portal-list">
        {overview && topLinks.length === 0 && (
          <div className="portal-destination">
            <div>
              <strong>Nenhuma viagem ainda</strong>
              <span>Compartilhe um portal para ver os viajantes aqui.</span>
            </div>
          </div>
        )}
        {topLinks.map((link, index) => (
          <Fragment key={link.code}>
            {index > 0 && (
              <div className="portal-route">
                <i />
                <i />
                <i />
              </div>
            )}
            <div className="portal-destination">
              <div className={`destination-ring ${orbitTones[index % orbitTones.length]}-portal`}>
                <i />
                <span />
              </div>
              <div>
                <strong>{link.title || link.code}</strong>
                <span>{countFormatter.format(link.travels)} viajantes</span>
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </article>
  );
}

export function TravelFlowPanel({ overview }: Props) {
  const points = overview?.travels ?? [];
  const max = Math.max(0, ...points.map((point) => point.travels));
  const total = points.reduce((sum, point) => sum + point.travels, 0);
  const pct = overview?.summary.travelsChangePct;
  const labels = points.length
    ? [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].map((index) => points[index]!)
    : [];

  return (
    <article className="panel journey-panel">
      <div className="panel-heading">
        <div>
          <span>ROTAS EM MOVIMENTO</span>
          <h3>Fluxo de viagens</h3>
        </div>
        <button className="period-button" type="button">
          Últimos {WINDOW_DAYS} dias
        </button>
      </div>
      <div className="chart-meta">
        <div>
          <strong>
            <AnimatedNumber value={overview ? total : null} />
          </strong>
          <span>viagens no período</span>
        </div>
        {pct !== null && pct !== undefined && <b>{formatPct(pct)}</b>}
      </div>
      <div className="chart">
        <div className="chart-grid">
          <i />
          <i />
          <i />
        </div>
        <div className="bars">
          {points.map((point, index) => (
            <span
              className={index === points.length - 1 ? "highlight" : ""}
              key={point.date}
              style={{ height: `${max ? Math.round((point.travels / max) * 100) : 0}%` }}
              title={`${dayLabel(point.date)}: ${countFormatter.format(point.travels)} viagens`}
            />
          ))}
        </div>
      </div>
      <div className="chart-labels">
        {labels.map((point) => (
          <span key={point.date}>{dayLabel(point.date)}</span>
        ))}
      </div>
    </article>
  );
}
