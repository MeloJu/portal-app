import { useRevalidator, useRouteError } from "react-router";
import { isApiOffline } from "../../api/offline";
import lumiLogo from "../../assets/lumi-logo-v2.png";

export default function RouteErrorPage() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const offline = isApiOffline(error);
  const retrying = revalidator.state === "loading";

  return (
    <main className="route-error-page">
      <div className="redirect-stars" />
      <header className="route-error-brand">
        <img src={lumiLogo} alt="Lumi Links" />
        <span>ROTA SEGURA L²</span>
      </header>

      <section className="route-error-card">
        <div className="redirect-portal" aria-hidden="true">
          <span className="redirect-ring ring-r-one">
            <i />
          </span>
          <span className="redirect-ring ring-r-two">
            <i />
          </span>
          <span className="redirect-ring ring-r-three" />
          <strong>L²</strong>
        </div>
        <span className="route-error-eyebrow">{offline ? "SINAL PERDIDO" : "ROTA INSTÁVEL"}</span>
        <h1 className="route-error-title">{offline ? "A estação está fora do ar." : "Algo deu errado."}</h1>
        <p className="route-error-text">
          {offline
            ? "Não conseguimos falar com a API da Lumi. Verifique sua conexão e tente de novo em instantes."
            : "A estação respondeu com um erro inesperado. Tente de novo em instantes."}
        </p>
        {offline && import.meta.env.DEV && (
          <p className="route-error-hint">
            Rodando local? Suba o backend com <code>scripts/dev-backend-docker.sh</code> e confira se{" "}
            <code>http://127.0.0.1:8080/api/me</code> responde 401.
          </p>
        )}
        <button
          className="route-error-button"
          disabled={retrying}
          onClick={() => void revalidator.revalidate()}
          type="button"
        >
          {retrying ? "Tentando..." : "Tentar de novo"}
        </button>
      </section>
    </main>
  );
}
