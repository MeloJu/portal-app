import { ApiError } from "../../api/client";
import { api, type Link, type LinkPage } from "../../api/lumi";
import { useApi } from "../../api/useApi";
import { formatNumber } from "../format";
import { icons } from "../icons";

const PAGE_SIZE = 100;

type AchievementData = {
  totalPortals: number;
  totalTravels: number;
  blockedThreats: number;
  activePortals: number;
  countries: number;
  maxPortalTravels: number;
};

type AchievementDefinition = {
  title: string;
  description: string;
  target: number;
  unit: string;
  value: (data: AchievementData) => number;
  tone: string;
  icon: typeof icons.portal;
};

const definitions: AchievementDefinition[] = [
  {
    title: "Primeiro portal",
    description: "Você abriu seu primeiro portal digital.",
    target: 1,
    unit: "portal",
    value: (data) => data.totalPortals,
    tone: "violet",
    icon: icons.portal,
  },
  {
    title: "Primeiro clique",
    description: "A primeira viagem atravessou um dos seus links.",
    target: 1,
    unit: "viagem",
    value: (data) => data.totalTravels,
    tone: "cyan",
    icon: icons.link,
  },
  {
    title: "Rota popular",
    description: "Um portal alcançou 100 viagens.",
    target: 100,
    unit: "viagens em um portal",
    value: (data) => data.maxPortalTravels,
    tone: "blue",
    icon: icons.chart,
  },
  {
    title: "Guardião atento",
    description: "A Lumi bloqueou sua primeira ameaça.",
    target: 1,
    unit: "bloqueio",
    value: (data) => data.blockedThreats,
    tone: "indigo",
    icon: icons.shield,
  },
  {
    title: "Exploradora orbital",
    description: "Crie 10 portais diferentes.",
    target: 10,
    unit: "portais",
    value: (data) => data.totalPortals,
    tone: "violet",
    icon: icons.portal,
  },
  {
    title: "Mil viajantes",
    description: "Alcance 1.000 viagens em um único portal.",
    target: 1000,
    unit: "viagens em um portal",
    value: (data) => data.maxPortalTravels,
    tone: "cyan",
    icon: icons.chart,
  },
  {
    title: "Constelação global",
    description: "Receba cliques de 10 países.",
    target: 10,
    unit: "países identificados",
    value: (data) => data.countries,
    tone: "blue",
    icon: icons.link,
  },
  {
    title: "Mestre dos portais",
    description: "Mantenha 25 portais ativos ao mesmo tempo.",
    target: 25,
    unit: "portais ativos",
    value: (data) => data.activePortals,
    tone: "indigo",
    icon: icons.trophy,
  },
];

async function loadAllPortals(): Promise<{ totalPortals: number; maxPortalTravels: number }> {
  const firstPage = await api.listLinks({ page: 0, size: PAGE_SIZE });
  const { totalItems } = firstPage;
  const pageCount = Math.ceil(totalItems / PAGE_SIZE);
  const seenCodes = new Set<string>();
  let maxPortalTravels = 0;

  function addPage(page: LinkPage, expectedPage: number) {
    if (page.page !== expectedPage || page.totalItems !== totalItems) {
      throw new ApiError(0, "PAGINATION_CHANGED", "A lista de portais mudou durante a consulta. Tente novamente.");
    }
    for (const link of page.items) {
      if (seenCodes.has(link.code)) {
        throw new ApiError(0, "PAGINATION_CHANGED", "Não foi possível consultar todos os portais. Tente novamente.");
      }
      seenCodes.add(link.code);
      maxPortalTravels = Math.max(maxPortalTravels, link.travelCount);
    }
  }

  addPage(firstPage, 0);
  for (let pageNumber = 1; pageNumber < pageCount; pageNumber += 1) {
    const page = await api.listLinks({ page: pageNumber, size: PAGE_SIZE });
    addPage(page, pageNumber);
  }

  if (seenCodes.size !== totalItems) {
    throw new ApiError(0, "INCOMPLETE_PAGINATION", "Não foi possível consultar todos os portais. Tente novamente.");
  }

  return { totalPortals: totalItems, maxPortalTravels };
}

async function loadAchievementData(): Promise<AchievementData> {
  const [summary, countries, portals] = await Promise.all([api.dashboardSummary(), api.countries(), loadAllPortals()]);

  return {
    totalPortals: portals.totalPortals,
    totalTravels: summary.totalTravels,
    blockedThreats: summary.blockedThreats,
    activePortals: summary.activeLinks,
    countries: countries.length,
    maxPortalTravels: portals.maxPortalTravels,
  };
}

export default function AchievementsSection() {
  const { data, error, loading, reload } = useApi(loadAchievementData, []);

  if (!data) {
    if (loading) {
      return (
        <section className="page-content" aria-busy="true" aria-label="Carregando conquistas">
          <div className="portal-library-state" role="status">
            Consultando suas conquistas...
          </div>
        </section>
      );
    }

    return (
      <section className="page-content">
        <div className="portal-library-state" role="alert">
          <strong>Não deu para carregar suas conquistas</strong>
          <p>{error?.message ?? "Algo deu errado. Tente novamente."}</p>
          <button className="page-primary" onClick={reload} type="button">
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  const achievements = definitions.map((definition) => {
    const current = definition.value(data);
    const unlocked = current >= definition.target;
    return {
      ...definition,
      current,
      unlocked,
      progress: Math.min(100, Math.round((current / definition.target) * 100)),
      detail: unlocked
        ? "Meta alcançada"
        : `${formatNumber(current)} de ${formatNumber(definition.target)} ${definition.unit}`,
    };
  });
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
  const totalCount = achievements.length;
  const completion = Math.round((unlockedCount / totalCount) * 100);
  const inProgressCount = totalCount - unlockedCount;

  return (
    <section className="page-content achievements-page">
      <article className="achievements-hero">
        <div className="achievement-emblem">
          <div className="emblem-orbit">
            <i />
          </div>
          <span>{icons.trophy}</span>
        </div>
        <div className="achievement-rank">
          <span>PROGRESSO DA JORNADA</span>
          <h2>Marcos da sua jornada</h2>
          <p>
            {unlockedCount} de {totalCount} conquistas concluídas.
          </p>
          <div className="rank-progress">
            <i style={{ width: `${completion}%` }} />
          </div>
        </div>
        <div className="achievement-score">
          <span>CONQUISTAS DISPONÍVEIS</span>
          <strong>{totalCount}</strong>
          <b>Metas exibidas</b>
        </div>
      </article>

      <div className="achievement-summary">
        <article>
          <span>{icons.trophy}</span>
          <div>
            <strong>{unlockedCount}</strong>
            <small>Desbloqueadas</small>
          </div>
        </article>
        <article>
          <span>{icons.portal}</span>
          <div>
            <strong>{inProgressCount}</strong>
            <small>Em progresso</small>
          </div>
        </article>
        <article>
          <span>{icons.spark}</span>
          <div>
            <strong>{completion}%</strong>
            <small>Da constelação</small>
          </div>
        </article>
      </div>

      {data.totalPortals === 0 && (
        <div className="portal-library-state" role="status">
          <strong>Nenhum portal ainda</strong>
          <p>Crie seu primeiro portal para começar sua jornada de conquistas.</p>
        </div>
      )}

      {data.countries === 0 && (
        <p className="rank-empty" role="status">
          Nenhum país foi identificado nas viagens. O progresso desta conquista depende de viagens com país registrado
          pelo GeoIP.
        </p>
      )}

      <div className="achievements-heading">
        <div>
          <span>CONSTELAÇÃO ATUAL</span>
          <h2>Marcos da sua jornada</h2>
        </div>
        <button type="button">Todas as conquistas {icons.arrow}</button>
      </div>

      <div className="achievements-grid">
        {achievements.map((achievement) => (
          <article
            className={`achievement-card ${achievement.unlocked ? "unlocked" : "locked"}`}
            key={achievement.title}
          >
            <div className={`achievement-icon ${achievement.tone}`}>
              <div className="achievement-icon-orbit">
                <i />
              </div>
              <span>{achievement.icon}</span>
            </div>
            <div className="achievement-state">
              {achievement.unlocked ? (
                <span>
                  <i /> CONQUISTADA
                </span>
              ) : (
                <span>EM PROGRESSO</span>
              )}
            </div>
            <h3>{achievement.title}</h3>
            <p>{achievement.description}</p>
            <div className="achievement-progress">
              <div>
                <i style={{ width: `${achievement.progress}%` }} />
              </div>
              <span>{achievement.detail}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
