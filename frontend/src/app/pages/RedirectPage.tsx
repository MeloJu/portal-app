import { useParams } from "react-router";
import lumiLogo from "../../assets/lumi-logo-v2.png";

const destinations: Record<string, { name: string; url: string }> = {
  nebulosa: { name: "Campanha Nebulosa", url: "https://example.com/campanha-nebulosa" },
  "ana-design": { name: "Portfólio 2025", url: "https://example.com/portfolio" },
  "orbit-live": { name: "Evento Orbit", url: "https://example.com/orbit-live" },
};

export default function RedirectPage() {
  const { slug = "" } = useParams();
  const destination = destinations[slug] ?? {
    name: "Destino Lumi",
    url: "https://example.com",
  };
  const destinationHost = new URL(destination.url).hostname.replace(/^www\./, "");

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
          <span>DESTINO IDENTIFICADO</span>
          <h1>Este serviço vai levar você para {destinationHost}.</h1>
          <p>
            O portal aponta para <b>{destination.name}</b>. Confira o endereço abaixo antes de decidir se deseja
            continuar.
          </p>
        </div>
        <div className="redirect-destination">
          <div className="destination-shield">
            <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
              <path
                d="M12 22s8-3.7 8-10V5l-8-3-8 3v7c0 6.3 8 10 8 10Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
              <path
                d="m8.8 12 2.1 2.1 4.5-4.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </div>
          <div>
            <span>ENDEREÇO DE DESTINO</span>
            <strong>{destinationHost}</strong>
            <small>Conexão HTTPS identificada</small>
          </div>
        </div>
        <p className="redirect-question">Deseja mesmo prosseguir?</p>
        <div className="redirect-actions">
          <button
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else window.location.assign("/login");
            }}
            type="button"
          >
            Não, voltar
          </button>
          <a href={destination.url} rel="noopener noreferrer">
            Sim, prosseguir <span>→</span>
          </a>
        </div>
        <small>A Lumi não redireciona sem a sua confirmação.</small>
      </section>

      <footer className="redirect-footer">
        <p>Este portal foi criado com Lumi Links.</p>
        <a href="/login">Crie seus próprios portais</a>
      </footer>
    </main>
  );
}
