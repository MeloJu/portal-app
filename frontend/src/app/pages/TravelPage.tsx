import type { ReactNode } from "react";
import { useLoaderData } from "react-router";
import type { TravelOutcome } from "../../api/travel";
import lumiLogo from "../../assets/lumi-logo-v2.png";

/** Só http e https viram link: javascript:, data: e afins nunca chegam ao href. */
function safeDestination(targetUrl: string): URL | null {
  try {
    const url = new URL(targetUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

const blocked: Record<Exclude<TravelOutcome["status"], "ok" | "rate_limited">, [string, string, string]> = {
  not_found: [
    "PORTAL DESCONHECIDO",
    "Este portal não existe.",
    "Confira o endereço: pode ter faltado ou sobrado alguma letra.",
  ],
  paused: [
    "PORTAL EM PAUSA",
    "Este portal está pausado.",
    "Quem criou o portal pausou as viagens por enquanto. Tente mais tarde.",
  ],
  closed: [
    "PORTAL ENCERRADO",
    "Este portal foi fechado.",
    "O portal não leva mais a lugar nenhum: foi fechado, venceu ou atingiu o limite de viagens.",
  ],
  error: [
    "ROTA INSTÁVEL",
    "Não conseguimos abrir este portal.",
    "A estação não respondeu. Verifique sua conexão e tente de novo.",
  ],
};

export default function TravelPage() {
  // A Viagem é registrada no loader da rota, uma vez por navegação: num useEffect o StrictMode contaria duas.
  const outcome = useLoaderData() as TravelOutcome;

  if (outcome.status === "rate_limited") {
    const wait = outcome.retryAfter
      ? `Tente de novo em ${outcome.retryAfter} ${outcome.retryAfter === 1 ? "segundo" : "segundos"}.`
      : "Tente de novo em instantes.";
    return (
      <Notice
        eyebrow="TRÁFEGO INTENSO"
        title="Muitas viagens em pouco tempo."
        text={`A Lumi segurou a rota por segurança. ${wait}`}
      />
    );
  }
  if (outcome.status !== "ok") {
    const [eyebrow, title, text] = blocked[outcome.status];
    return <Notice eyebrow={eyebrow} title={title} text={text} />;
  }

  const destination = safeDestination(outcome.targetUrl);
  if (!destination) {
    return (
      <Notice
        eyebrow="ROTA BLOQUEADA"
        title="Este destino não é seguro."
        text="O portal aponta para um endereço que não é um site (http ou https). A Lumi não vai levar você até lá."
      />
    );
  }

  const destinationHost = destination.hostname.replace(/^www\./, "");
  const secure = destination.protocol === "https:";

  return (
    <Shell>
      <div className="redirect-copy">
        <span>DESTINO IDENTIFICADO</span>
        <h1>Este serviço vai levar você para {destinationHost}.</h1>
        <p>
          {outcome.title ? (
            <>
              O portal aponta para <b>{outcome.title}</b>.{" "}
            </>
          ) : null}
          Confira o endereço abaixo antes de decidir se deseja continuar.
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
          <small>{secure ? "Conexão HTTPS identificada" : "Atenção: conexão sem HTTPS"}</small>
        </div>
      </div>
      <p className="redirect-question">Deseja mesmo prosseguir?</p>
      <div className="redirect-actions">
        <BackButton />
        <a href={destination.href} rel="noopener noreferrer">
          Sim, prosseguir <span>→</span>
        </a>
      </div>
      <small>A Lumi não redireciona sem a sua confirmação.</small>
    </Shell>
  );
}

function BackButton() {
  return (
    <button
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else window.location.assign("/login");
      }}
      type="button"
    >
      Não, voltar
    </button>
  );
}

function Notice({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <Shell>
      <div className="redirect-copy">
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="redirect-actions">
        <BackButton />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
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
        {children}
      </section>

      <footer className="redirect-footer">
        <p>Este portal foi criado com Lumi Links.</p>
        <a href="/login">Crie seus próprios portais</a>
      </footer>
    </main>
  );
}
