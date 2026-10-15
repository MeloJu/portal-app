import { Tracker, TrackerCategory } from "../../api/tools";

const categoryLabel: Record<TrackerCategory, string> = {
  ads: "anúncio",
  social: "rede social",
  email: "e-mail marketing",
  analytics: "campanha",
  affiliate: "afiliado",
};

function describe(tracker: Tracker) {
  if (tracker.kind === "domain") return "A rota passa por este domínio de rastreamento";
  return tracker.inFinal ? "Parâmetro no destino final" : "Parâmetro só no link de origem";
}

/** Lista os rastreadores vistos no link. Só apresenta: quem decide o que fazer é a tela que o usa. */
export default function TrackerList({ trackers }: { trackers: Tracker[] }) {
  if (trackers.length === 0) return null;
  return (
    <div className="reveal-trackers" role="group" aria-label="Rastreadores no link">
      <strong>{trackers.length === 1 ? "1 rastreador no link" : `${trackers.length} rastreadores no link`}</strong>
      <ul>
        {trackers.map((tracker) => (
          <li key={`${tracker.kind}-${tracker.name}`} title={describe(tracker)}>
            <b>{tracker.name}</b>
            <small>{categoryLabel[tracker.category]}</small>
          </li>
        ))}
      </ul>
      <p>Rastreadores contam a quem criou o link quem clicou, de onde veio e o que fez depois.</p>
    </div>
  );
}
