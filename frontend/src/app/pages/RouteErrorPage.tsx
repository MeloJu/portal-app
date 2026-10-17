import { useRevalidator, useRouteError } from "react-router";
import { isApiOffline } from "../../api/offline";
import lumiLogo from "../../assets/lumi-logo-v2.png";

/**
 * Erro de loader de qualquer rota. O caso comum é o backend desligado: o /api/me de toda rota falha
 * e, sem esta tela, sobrava a tela de erro padrão do React Router.
 */
export default function RouteErrorPage() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const offline = isApiOffline(error);
  const retrying = revalidator.state === "loading";

  return (
    <main className="redirect-page">
      <div className="redirect-stars" />
      <header className="redirect-brand">
        <img src={lumiLogo} alt="Lumi Links" />
        <span>ROTA SEGURA L²</span>
      </header>

      <section className="redirect-card">
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
        <div className="redirect-copy">
          <span>{offline ? "SINAL PERDIDO" : "ROTA INSTÁVEL"}</span>
          <h1>{offline ? "A estação está fora do ar." : "Algo deu errado."}</h1>
          <p>
            {offline
              ? "Não conseguimos falar com a API da Lumi. Verifique sua conexão e tente de novo em instantes."
              : "A estação respondeu com um erro inesperado. Tente de novo em instantes."}
          </p>
          {offline && import.meta.env.DEV && (
            <p>
              Rodando local? Suba o backend com <b>scripts/dev-backend-docker.sh</b> e confira se{" "}
              <b>http://127.0.0.1:8080/api/me</b> responde 401.
            </p>
          )}
        </div>
        <div className="redirect-actions single">
          <button disabled={retrying} onClick={() => void revalidator.revalidate()} type="button">
            {retrying ? "Tentando..." : "Tentar de novo"}
          </button>
        </div>
      </section>
    </main>
  );
}
