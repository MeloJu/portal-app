import { FormEvent, useEffect, useRef, useState } from "react";
import { scan, ScanResult, ToolsError, unshorten, UnshortenResult, Verdict } from "../../api/tools";
import { icons } from "../icons";

type Props = {
  /** Espera entre tentativas enquanto o VirusTotal ainda analisa (ms). */
  scanRetryMs?: number;
  maxScanRetries?: number;
};

type Status = "idle" | "loading" | "done" | "error" | "gated";
type ScanState = { status: "idle" | "loading" | "pending" | "done" | "error"; result?: ScanResult; message?: string };

const verdictCopy: Record<Verdict, { label: string; text: string }> = {
  clean: { label: "Seguro", text: "Nenhum mecanismo de segurança apontou problemas neste destino." },
  suspicious: { label: "Suspeito", text: "Alguns mecanismos marcaram este destino como suspeito. Tenha cuidado." },
  malicious: { label: "Perigoso", text: "Este destino foi marcado como malicioso. Não recomendamos abrir." },
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const BYPASS_CITY = "https://bypass.city/bypass?bypass=";

/** Só abre destinos http/https (evita esquemas como javascript:). */
function isSafeToOpen(url: string) {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function RevealDestinationPanel({ scanRetryMs = 8000, maxScanRetries = 6 }: Props) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<UnshortenResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [gateUrl, setGateUrl] = useState("");
  const [frameOpen, setFrameOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const runId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  function reset() {
    runId.current++;
    controller.current?.abort();
    setResult(null);
    setError("");
    setCopied(false);
    setScanState({ status: "idle" });
    setGateUrl("");
    setFrameOpen(false);
  }

  async function run(value: string) {
    if (!value.trim() || status === "loading") return;
    reset();
    const id = runId.current;
    controller.current = new AbortController();
    setStatus("loading");
    try {
      const data = await unshorten(value.trim(), controller.current.signal);
      if (id !== runId.current) return;
      setResult(data);
      setPasted("");
      setStatus("done");
    } catch (err) {
      if (id !== runId.current) return;
      if (err instanceof ToolsError && err.isAdGated && isSafeToOpen(err.gateUrl!)) {
        setGateUrl(err.gateUrl!);
        setStatus("gated");
        return;
      }
      setError(err instanceof ToolsError ? err.message : "Algo deu errado. Tente novamente.");
      setStatus("error");
    }
  }

  function reveal(event: FormEvent) {
    event.preventDefault();
    void run(input);
  }

  function usePasted(event: FormEvent) {
    event.preventDefault();
    void run(pasted);
  }

  async function analyze() {
    if (!result) return;
    const id = runId.current;
    const signal = controller.current?.signal;
    setScanState({ status: "loading" });
    try {
      for (let attempt = 0; attempt <= maxScanRetries; attempt++) {
        try {
          const data = await scan(result.finalUrl, signal);
          if (id !== runId.current) return;
          setScanState({ status: "done", result: data });
          return;
        } catch (err) {
          if (!(err instanceof ToolsError && err.isPending)) throw err;
          if (id !== runId.current) return;
          setScanState({ status: "pending" });
          await wait(scanRetryMs);
          if (id !== runId.current) return;
        }
      }
      setScanState({ status: "error", message: "A análise está demorando mais que o normal. Tente novamente em instantes." });
    } catch (err) {
      if (id !== runId.current) return;
      setScanState({
        status: "error",
        message: err instanceof ToolsError ? err.message : "Não foi possível analisar este destino.",
      });
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard?.writeText(result.finalUrl);
    } catch {
      // sem permissão de área de transferência: só não mostra o "Copiado"
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const isLoading = status === "loading";
  const scanning = scanState.status === "loading" || scanState.status === "pending";

  return (
    <section className="page-content close-portal-page">
      <article className={`close-portal-card ${isLoading ? "closing" : ""}`}>
        <div className="close-stars" />
        <div className="close-copy">
          <span className="close-badge">{icons.unlink} REVELAR DESTINO</span>
          <h2>Descubra para onde o portal realmente leva.</h2>
          <p>Cole um link encurtado. A Lumi segue a rota por você e mostra o endereço original aqui mesmo.</p>
        </div>
        <div className="collapse-visual" aria-hidden="true">
          <div className="collapse-ring collapse-outer"><i /></div>
          <div className="collapse-ring collapse-middle"><i /></div>
          <div className="collapse-ring collapse-inner"><span>{icons.unlink}</span></div>
          <div className="collapse-rays"><i /><i /><i /><i /></div>
        </div>
        <form className="close-form" onSubmit={reveal}>
          <label>
            <span>{icons.link}</span>
            <input
              aria-label="Link para revelar"
              inputMode="url"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Cole o link que deseja revelar..."
              type="text"
              value={input}
            />
          </label>
          <button disabled={isLoading} type="submit">
            {isLoading ? "Revelando..." : "Revelar destino"} {!isLoading && icons.arrow}
          </button>
        </form>
        {isLoading && (
          <div className="closing-status" role="status" aria-live="polite">
            <span><i /><i /><i /></span>
            <strong>Seguindo a rota do portal</strong>
            <small>Isso leva só alguns segundos</small>
          </div>
        )}
      </article>

      {status === "gated" && (
        <article className="gate-card" aria-label="Link com página de anúncio">
          <div className="gate-head">
            <span className="close-badge">{icons.shield} LINK COM ANÚNCIO</span>
            <h3>Este link passa por uma página de anúncio</h3>
            <p>
              Só seguir o redirecionamento não revela o destino. Resolva a verificação abaixo, copie o endereço
              final e cole no campo para a Lumi mostrar e analisar.
            </p>
          </div>

          {!frameOpen ? (
            <div className="gate-consent">
              <p>Ao continuar, este link será aberto pelo seu navegador no serviço externo <b>bypass.city</b>.</p>
              <button onClick={() => setFrameOpen(true)} type="button">Resolver aqui na Lumi {icons.arrow}</button>
            </div>
          ) : (
            <iframe
              className="gate-frame"
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms"
              src={`${BYPASS_CITY}${encodeURIComponent(gateUrl)}`}
              title="Verificação do bypass.city"
            />
          )}

          <form className="gate-paste" onSubmit={usePasted}>
            <input
              aria-label="Cole o destino revelado"
              onChange={(event) => setPasted(event.target.value)}
              placeholder="Cole aqui o endereço revelado..."
              type="text"
              value={pasted}
            />
            <button disabled={!pasted.trim()} type="submit">Usar este destino</button>
          </form>

          <p className="gate-credit">
            Processado por <a href="https://bypass.city/" rel="noopener noreferrer" target="_blank">bypass.city</a>.
            Se o quadro não carregar,{" "}
            <a href={`${BYPASS_CITY}${encodeURIComponent(gateUrl)}`} rel="noopener noreferrer" target="_blank">abra em outra aba</a>.
          </p>
        </article>
      )}

      {status === "error" && (
        <p className="reveal-error" role="alert">{error}</p>
      )}

      {status === "done" && result && (
        <article className="close-result reveal-result" role="status">
          <div className="result-symbol">{icons.portal}</div>
          <div className="reveal-body">
            <span>DESTINO REVELADO</span>
            <h3>{hostOf(result.finalUrl)}</h3>
            <p className="reveal-final">{result.finalUrl}</p>
            {result.hops.length > 1 && (
              <ol className="reveal-hops" aria-label="Rota percorrida">
                {result.hops.map((hop, index) => (
                  <li key={`${hop.url}-${index}`}>
                    <b>{hop.status}</b>
                    <span>{hop.url}</span>
                  </li>
                ))}
              </ol>
            )}

            {scanState.status === "done" && scanState.result && (
              <div className={`reveal-scan ${scanState.result.verdict}`} role="status">
                <strong>{verdictCopy[scanState.result.verdict].label}</strong>
                <p>{verdictCopy[scanState.result.verdict].text}</p>
                <small>
                  {scanState.result.stats.malicious} malicioso(s) · {scanState.result.stats.suspicious} suspeito(s) ·{" "}
                  {scanState.result.stats.harmless} seguro(s) ·{" "}
                  <a href={scanState.result.permalink} rel="noopener noreferrer" target="_blank">relatório completo</a>
                </small>
              </div>
            )}
            {scanState.status === "pending" && (
              <p className="reveal-note" role="status">A Lumi está analisando este destino. Pode levar até meio minuto...</p>
            )}
            {scanState.status === "error" && <p className="reveal-error" role="alert">{scanState.message}</p>}
          </div>
          <div className="reveal-actions">
            <button onClick={copy} type="button">
              {icons.copy} {copied ? "Copiado" : "Copiar"}
            </button>
            <button disabled={scanning || scanState.status === "done"} onClick={analyze} type="button">
              {icons.shield} {scanning ? "Analisando..." : "Analisar com a Lumi"}
            </button>
            {isSafeToOpen(result.finalUrl) && (
              <a href={result.finalUrl} rel="noopener noreferrer nofollow" target="_blank">
                Abrir destino {icons.arrow}
              </a>
            )}
          </div>
        </article>
      )}

      <div className="close-info-grid">
        <article><span>01</span><div><strong>Cole o portal</strong><p>Links encurtados como bit.ly, tinyurl e t.co.</p></div></article>
        <article><span>02</span><div><strong>Siga a rota</strong><p>A Lumi acompanha cada redirecionamento até o fim.</p></div></article>
        <article><span>03</span><div><strong>Confira o destino</strong><p>Veja o endereço original e peça uma análise de segurança.</p></div></article>
      </div>
      <p className="partner-note">Use apenas em links que você tem permissão para acessar.</p>
    </section>
  );
}
