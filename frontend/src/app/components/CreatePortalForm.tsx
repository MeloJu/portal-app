import { useEffect, useRef, useState, type FormEvent } from "react";
import { createLink, LinkError, type Link } from "../../api/links";
import lumiLogo from "../../assets/lumi-logo-v2.png";
import lumiPortalBackground from "../../assets/lumi-portal-bg.png";
import { icons } from "../icons";

/** Mesma regra do back (`^[a-zA-Z0-9-]{3,32}$`), checada antes para não gastar uma chamada. */
const ALIAS_PATTERN = /^[a-zA-Z0-9-]{3,32}$/;

type Props = {
  /** Tempo mínimo da animação de abertura, para o portal não piscar quando a API responde rápido. */
  minOpeningMs?: number;
  onCreated?: (link: Link) => void;
};

/** "Promoção de Verão" → "promocao-de-verao": tira acentos e junta o resto com um hífen só. */
function normalizeAlias(typed: string) {
  return typed
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function displayUrl(shortUrl: string) {
  return shortUrl.replace(/^https?:\/\//, "");
}

export default function CreatePortalForm({ minOpeningMs = 1400, onCreated }: Props) {
  const copiedTimerRef = useRef(0);
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [title, setTitle] = useState("");
  const [maxTravels, setMaxTravels] = useState("");
  const [created, setCreated] = useState<Link | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => () => window.clearTimeout(copiedTimerRef.current), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim() || isOpening) return;
    const alias = normalizeAlias(slug) || null;
    if (slug.trim() && !ALIAS_PATTERN.test(alias ?? "")) {
      setError("O nome personalizado precisa ter de 3 a 32 letras, números ou hífens.");
      return;
    }
    const limit = maxTravels.trim() ? Number(maxTravels) : null;
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
      setError("O limite de viagens precisa ser um número inteiro a partir de 1.");
      return;
    }

    setError("");
    setCreated(null);
    setCopied(false);
    setIsOpening(true);
    const minimum = new Promise((resolve) => window.setTimeout(resolve, minOpeningMs));
    try {
      const extras = { title: title.trim() || null, maxTravels: limit };
      const [link] = await Promise.all([createLink(url.trim(), alias, extras), minimum]);
      setCreated(link);
      onCreated?.(link);
    } catch (err) {
      await minimum;
      setError(err instanceof LinkError ? err.message : "Algo deu errado. Tente novamente.");
    } finally {
      setIsOpening(false);
    }
  }

  async function copy() {
    if (!created || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(created.shortUrl);
    } catch {
      return;
    }
    window.clearTimeout(copiedTimerRef.current);
    setCopied(true);
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section
      className={`creator-card ${isOpening ? "portal-active" : ""} ${showExtras ? "with-extras" : ""}`}
      aria-busy={isOpening}
    >
      <img className="creator-background" src={lumiPortalBackground} alt="" aria-hidden="true" />
      <div className="creator-overlay" />
      <div className="creator-copy">
        <span className="pill">{icons.spark} ABRIR NOVO PORTAL</span>
        <h2>Para onde vamos agora?</h2>
        <p>Cole seu link. A Lumi cuida do caminho.</p>
      </div>
      <form className="link-form" noValidate onSubmit={submit}>
        <label className="url-field">
          <span>{icons.link}</span>
          <input
            inputMode="url"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Cole seu link longo aqui..."
            type="text"
            value={url}
          />
        </label>
        <label className="slug-field">
          <span>{window.location.host}/</span>
          <input
            maxLength={32}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="personalizar"
            type="text"
            value={slug}
          />
        </label>
        <button className="primary-button" disabled={isOpening} type="submit">
          {isOpening ? "Abrindo portal..." : "Criar portal"} {!isOpening && icons.arrow}
        </button>
        <button
          aria-expanded={showExtras}
          className="link-form-toggle"
          onClick={() => setShowExtras(!showExtras)}
          type="button"
        >
          {showExtras ? "Menos opções" : "Mais opções"}
        </button>
        {showExtras && (
          <div className="link-form-extras">
            <label>
              <span>Título</span>
              <input
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Campanha Nebulosa"
                type="text"
                value={title}
              />
            </label>
            <label>
              <span>Limite de viagens</span>
              <input
                inputMode="numeric"
                min={1}
                onChange={(event) => setMaxTravels(event.target.value)}
                placeholder="sem limite"
                type="number"
                value={maxTravels}
              />
            </label>
          </div>
        )}
      </form>
      {isOpening && (
        <div className="portal-opening" role="status" aria-live="polite">
          <div className="opening-vortex" aria-hidden="true">
            <div className="portal-energy">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="portal-ripples">
              <i />
              <i />
              <i />
            </div>
            <span className="vortex-ring ring-outer" />
            <span className="vortex-ring ring-middle" />
            <span className="vortex-ring ring-inner" />
            <span className="vortex-core">
              <img src={lumiLogo} alt="" />
            </span>
            <div className="portal-particles">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="opening-copy">
            <strong>Portal em formação</strong>
            <span>Lumi está traçando a rota mais segura</span>
          </div>
        </div>
      )}
      {error && (
        <p className="create-portal-error" role="alert">
          {error}
        </p>
      )}
      {created && (
        <div className="created-link" role="status">
          <span>Portal aberto com sucesso</span>
          <strong>{displayUrl(created.shortUrl)}</strong>
          <button onClick={copy} type="button">
            {copied ? icons.check : icons.copy} {copied ? "Copiado" : "Copiar"}
          </button>
          <button onClick={() => window.open(created.shortUrl, "_blank", "noopener,noreferrer")} type="button">
            Visualizar {icons.arrow}
          </button>
        </div>
      )}
    </section>
  );
}
