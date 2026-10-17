import { api, type BlockedReason } from "../../api/lumi";
import { useApi } from "../../api/useApi";
import { formatNumber, relativeTime } from "../format";
import { icons } from "../icons";

export const REASON_LABELS: Record<BlockedReason, string> = {
  INVALID_URL: "Destino inválido recusado",
  SELF_LOOP: "Loop para a própria Lumi",
  RESERVED_ALIAS: "Nome reservado recusado",
  PAUSED: "Viagem em portal pausado",
  CLOSED: "Viagem em portal fechado",
  RATE_LIMIT: "Excesso de tentativas bloqueado",
};

const EVENTS_LIMIT = 20;

const reasonLabel = (reason: string) => REASON_LABELS[reason as BlockedReason] ?? reason;

async function loadProtection() {
  const [summary, events] = await Promise.all([api.protectionSummary(), api.protectionEvents(EVENTS_LIMIT)]);
  return { summary, events };
}

export default function ProtectionSection() {
  const { data, error, reload } = useApi(loadProtection, []);

  if (!data) {
    if (!error) return <section className="page-content" aria-busy="true" aria-label="Carregando proteção" />;
    return (
      <section className="page-content">
        <div className="portal-library-state" role="alert">
          <strong>Não deu para carregar a proteção</strong>
          <p>{error.message}</p>
          <button className="page-primary" onClick={reload} type="button">
            Tentar de novo
          </button>
        </div>
      </section>
    );
  }

  const { summary, events } = data;

  return (
    <section className="page-content">
      <div className="security-hero">
        <div className="security-copy">
          <span>LUMI ESTÁ DE VIGIA</span>
          <h2>Todos os portais estão protegidos</h2>
          <p>Cada destino é conferido antes de virar portal, e cada viagem passa pelas regras de bloqueio da Lumi.</p>
        </div>
        <span className="secure-badge">
          <i /> Escudo ativo
        </span>
      </div>
      <div className="security-grid">
        <article className="security-card">
          <div className="security-icon">{icons.shield}</div>
          <span>AMEAÇAS BLOQUEADAS</span>
          <strong>{formatNumber(summary.blockedThreats)}</strong>
          <p>Tentativas barradas pela Lumi.</p>
        </article>
        <article className="security-card">
          <div className="security-icon cyan">{icons.link}</div>
          <span>DESTINOS VERIFICADOS</span>
          <strong>{formatNumber(summary.verifiedDestinations)}</strong>
          <p>Destinos conferidos na criação dos portais.</p>
        </article>
        <article className="security-card">
          <div className="security-icon violet">{icons.chart}</div>
          <span>POR MOTIVO</span>
          <ul className="reason-list" aria-label="Bloqueios por motivo">
            {Object.entries(summary.byReason).map(([reason, count]) => (
              <li key={reason}>
                <span>{reasonLabel(reason)}</span>
                <b>{formatNumber(count)}</b>
              </li>
            ))}
          </ul>
        </article>
      </div>
      <article className="threat-log">
        <div className="panel-heading">
          <div>
            <span>DIÁRIO DE BORDO</span>
            <h3>Atividade de proteção recente</h3>
          </div>
        </div>
        {events.length === 0 ? (
          <p className="threat-empty">Nenhuma ameaça até agora. A Lumi segue de vigia.</p>
        ) : (
          events.map((event, index) => (
            <div className="threat-row" key={`${event.occurredAt}-${event.reason}-${index}`}>
              <div className="threat-dot" />
              <div>
                <strong>{reasonLabel(event.reason)}</strong>
                <span>{event.code ?? "—"}</span>
              </div>
              <time dateTime={event.occurredAt}>{relativeTime(event.occurredAt)}</time>
              <b>Bloqueado</b>
            </div>
          ))
        )}
      </article>
    </section>
  );
}
