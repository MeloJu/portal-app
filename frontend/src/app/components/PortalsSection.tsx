import { useState } from "react";
import { api, type LinkState } from "../../api/lumi";
import { useApi } from "../../api/useApi";
import { icons } from "../icons";
import PortalCard from "./PortalCard";

const PAGE_SIZE = 20;

const FILTERS: { label: string; state: LinkState | null; empty: string }[] = [
  { label: "Todos", state: null, empty: "Nenhum portal por aqui ainda" },
  { label: "Ativos", state: "ACTIVE", empty: "Nenhum portal ativo" },
  { label: "Pausados", state: "PAUSED", empty: "Nenhum portal pausado" },
  { label: "Fechados", state: "CLOSED", empty: "Nenhum portal fechado" },
];

type PortalListProps = {
  state: LinkState | null;
  empty: string;
};

function PortalList({ state, empty }: PortalListProps) {
  const { data, error, loading, reload } = useApi(
    () => api.listLinks({ state: state ?? undefined, page: 0, size: PAGE_SIZE }),
    [state],
  );

  if (!data && loading) {
    return (
      <div className="portal-library" aria-busy="true" aria-label="Carregando portais">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="library-card library-skeleton" key={index} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="portal-library-state" role="alert">
        <strong>Não deu para carregar seus portais</strong>
        <p>{error?.message ?? "Algo deu errado. Tente novamente."}</p>
        <button className="page-primary" onClick={reload} type="button">
          Tentar de novo
        </button>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div className="portal-library-state">
        <strong>{empty}</strong>
        <p>Quando houver, ele aparece aqui.</p>
      </div>
    );
  }

  return (
    <>
      <div className="portal-library">
        {data.items.map((link) => (
          <PortalCard key={link.code} link={link} />
        ))}
      </div>
      {error && (
        <div className="portal-library-inline-error" role="alert">
          {error.message}
          <button onClick={reload} type="button">
            Tentar de novo
          </button>
        </div>
      )}
    </>
  );
}

export default function PortalsSection({ onNewPortal }: { onNewPortal?: () => void }) {
  const [filter, setFilter] = useState(FILTERS[0]!);

  return (
    <section className="page-content">
      <div className="page-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Filtrar portais">
          {FILTERS.map((option) => (
            <button
              aria-selected={filter.label === option.label}
              className={filter.label === option.label ? "selected" : ""}
              key={option.label}
              onClick={() => setFilter(option)}
              role="tab"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <button className="page-primary" onClick={onNewPortal} type="button">
          {icons.plus} Novo portal
        </button>
      </div>
      <PortalList empty={filter.empty} key={filter.label} state={filter.state} />
    </section>
  );
}
