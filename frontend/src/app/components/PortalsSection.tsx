import { useCallback, useState } from "react";
import { api, type Link, type LinkState } from "../../api/lumi";
import { useApi } from "../../api/useApi";
import { icons } from "../icons";
import CreatePortalForm from "./CreatePortalForm";
import PortalCard from "./PortalCard";
import PortalDetail from "./PortalDetail";

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
  version: number;
  onOpen: (code: string) => void;
};

async function loadPages(state: LinkState | null, pages: number) {
  const results = await Promise.all(
    Array.from({ length: pages }, (_, page) => api.listLinks({ state: state ?? undefined, page, size: PAGE_SIZE })),
  );
  const seen = new Set<string>();
  const items: Link[] = [];
  for (const item of results.flatMap((result) => result.items)) {
    if (seen.has(item.code)) continue;
    seen.add(item.code);
    items.push(item);
  }
  return { items, totalItems: results[results.length - 1]!.totalItems };
}

function PortalList({ state, empty, version, onOpen }: PortalListProps) {
  const [pages, setPages] = useState(1);
  const { data, error, loading, reload } = useApi(() => loadPages(state, pages), [state, pages, version]);

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
          <PortalCard key={link.code} link={link} onChanged={reload} onOpen={onOpen} />
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
      {data.items.length < data.totalItems && (
        <button className="portal-load-more" disabled={loading} onClick={() => setPages(pages + 1)} type="button">
          {loading ? "Carregando..." : "Carregar mais"}
        </button>
      )}
    </>
  );
}

export default function PortalsSection() {
  const [filter, setFilter] = useState(FILTERS[0]!);
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const closeDetail = useCallback(() => setOpenCode(null), []);

  return (
    <section className="page-content">
      {creating && <CreatePortalForm onCreated={() => setVersion((v) => v + 1)} />}
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
        <button aria-expanded={creating} className="page-primary" onClick={() => setCreating(!creating)} type="button">
          {icons.plus} Novo portal
        </button>
      </div>
      <PortalList empty={filter.empty} key={filter.label} onOpen={setOpenCode} state={filter.state} version={version} />
      {openCode && <PortalDetail code={openCode} onClose={closeDetail} />}
    </section>
  );
}
