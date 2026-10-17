import { api } from "../../api/lumi";
import { useApi } from "../../api/useApi";
import { formatNumber, formatPct } from "../format";
import { dayLabel } from "./OverviewPanels";

const DAYS = 30;

const regionNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });

function countryName(code: string) {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

async function loadTravels() {
  const [summary, travels, countries] = await Promise.all([
    api.dashboardSummary(DAYS),
    api.dashboardTravels(DAYS),
    api.countries(),
  ]);
  return { summary, travels, countries };
}

export default function TravelsSection() {
  const { data, error, reload } = useApi(loadTravels, []);

  if (!data) {
    if (!error) return <section className="page-content" aria-busy="true" aria-label="Carregando viagens" />;
    return (
      <section className="page-content">
        <div className="portal-library-state" role="alert">
          <strong>Não deu para carregar suas viagens</strong>
          <p>{error.message}</p>
          <button className="page-primary" onClick={reload} type="button">
            Tentar de novo
          </button>
        </div>
      </section>
    );
  }

  const { summary, travels, countries } = data;
  const periodTotal = travels.reduce((sum, point) => sum + point.travels, 0);
  const maxDay = Math.max(0, ...travels.map((point) => point.travels));
  const maxCountry = Math.max(0, ...countries.map((country) => country.travels));
  const labels = travels.length
    ? [...new Set([0, Math.floor((travels.length - 1) / 2), travels.length - 1])].map((index) => travels[index]!)
    : [];

  return (
    <section className="page-content">
      <div className="journey-summary">
        <article>
          <span>VIAGENS TOTAIS</span>
          <strong>{formatNumber(summary.totalTravels)}</strong>
          <b>
            {formatPct(summary.travelsChangePct)} nos últimos {DAYS} dias
          </b>
        </article>
        <article>
          <span>VIAGENS NO PERÍODO</span>
          <strong>{formatNumber(periodTotal)}</strong>
          <b>Últimos {DAYS} dias</b>
        </article>
        <article>
          <span>PAÍSES ALCANÇADOS</span>
          <strong>{formatNumber(countries.length)}</strong>
          <b>{countries.length ? "Origem das viagens" : "Localização em breve"}</b>
        </article>
      </div>
      <div className="journey-layout">
        <article className="panel journey-panel">
          <div className="panel-heading">
            <div>
              <span>ROTAS EM MOVIMENTO</span>
              <h3>Viagens por dia</h3>
            </div>
            <button className="period-button" type="button">
              Últimos {DAYS} dias
            </button>
          </div>
          <div className="chart" role="img" aria-label={`Viagens por dia nos últimos ${DAYS} dias`}>
            <div className="chart-grid">
              <i />
              <i />
              <i />
            </div>
            <div className="bars">
              {travels.map((point, index) => (
                <span
                  className={index === travels.length - 1 ? "highlight" : ""}
                  key={point.date}
                  style={{ height: `${maxDay ? Math.round((point.travels / maxDay) * 100) : 0}%` }}
                  title={`${dayLabel(point.date)}: ${formatNumber(point.travels)} viagens`}
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
        <article className="rank-panel">
          <div className="panel-heading">
            <div>
              <span>ORIGEM DAS VIAGENS</span>
              <h3>Países que mais viajam</h3>
            </div>
          </div>
          {countries.length === 0 ? (
            <p className="rank-empty">Ainda sem dados de país — a localização das viagens chega em breve.</p>
          ) : (
            countries.map((country, index) => (
              <div className="rank-row" key={country.country}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <div>
                  <strong>{countryName(country.country)}</strong>
                  <i>
                    <span style={{ width: `${maxCountry ? Math.round((country.travels / maxCountry) * 100) : 0}%` }} />
                  </i>
                </div>
                <span>{formatNumber(country.travels)}</span>
              </div>
            ))
          )}
        </article>
      </div>
    </section>
  );
}
