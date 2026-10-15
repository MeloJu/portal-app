import { ClipboardEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Hop, scan, ScanResult, ToolsError, unshorten, UnshortenResult, Verdict } from "../../api/tools";
import { icons } from "../icons";
import TrackerList from "./TrackerList";

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
const BYPASS_CITY_ORIGIN = "https://bypass.city";

/** A extensão da Lumi (pasta extension/) marca a página quando está instalada. */
const hasLumiExtension = () => document.documentElement.dataset.lumiExtension === "1";
const EXTENSION_STORE_URL = import.meta.env.VITE_LUMI_EXTENSION_URL;
const EXTENSION_XPI_URL = import.meta.env.VITE_LUMI_EXTENSION_XPI_URL;
/** "Agora não" na notificação da extensão vale para as próximas visitas. */
const EXT_TOAST_DISMISSED_KEY = "lumi:ext-toast-dismissed";
const isFirefox = () => /firefox/i.test(navigator.userAgent);
/** Onde instalar: .xpi no Firefox (aviso nativo), loja nos outros; sem nenhum, a instalação é local. */
function extensionInstallUrl() {
  const url = isFirefox() && EXTENSION_XPI_URL ? EXTENSION_XPI_URL : EXTENSION_STORE_URL;
  return url && isSafeToOpen(url) ? url : null;
}

function toastDismissed() {
  try {
    return localStorage.getItem(EXT_TOAST_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

const extensionsPage = () => (isFirefox() ? "about:debugging#/runtime/this-firefox" : "chrome://extensions");
/** Link com anúncio pendente: sobrevive ao recarregar a página depois de instalar a extensão. */
const PENDING_GATE_KEY = "lumi:pending-gate";

const hopLabel: Record<NonNullable<Hop["kind"]>, { text: string; title: string }> = {
  decoded: { text: "lido", title: "Destino lido do próprio link" },
  page: { text: "página", title: "Destino lido do conteúdo da página" },
  browser: { text: "navegador", title: "Destino revelado abrindo a página no navegador da Lumi" },
  provider: { text: "bypass", title: "Destino revelado pelo serviço de bypass" },
};

/** Só abre destinos http/https (evita esquemas como javascript:). */
function isSafeToOpen(url: string) {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Só lê a área de transferência sem pedir nada quando o usuário já deu permissão (Chrome/Edge). */
async function clipboardGranted() {
  try {
    const { state } = await navigator.permissions.query({ name: "clipboard-read" as PermissionName });
    return state === "granted" && typeof navigator.clipboard?.readText === "function";
  } catch {
    return false;
  }
}

async function readClipboard() {
  try {
    return (await navigator.clipboard.readText()).trim();
  } catch {
    return null;
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function RevealDestinationPanel({ scanRetryMs = 8000, maxScanRetries = 6 }: Props) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<UnshortenResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [cleanCopied, setCleanCopied] = useState(false);
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [gateUrl, setGateUrl] = useState("");
  const [frameOpen, setFrameOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [clipboardHint, setClipboardHint] = useState("");
  const [extensionHelp, setExtensionHelp] = useState(false);
  const [extToast, setExtToast] = useState(false);
  const extHelpRef = useRef<HTMLDivElement>(null);
  const [pageCopied, setPageCopied] = useState(false);
  const runId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  // Voltando de "Já instalei, recarregar": retoma o mesmo link, agora com a extensão ativa.
  useEffect(() => {
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_GATE_KEY);
      sessionStorage.removeItem(PENDING_GATE_KEY);
    } catch {
      // armazenamento bloqueado: o usuário só cola o link de novo
    }
    if (!pending || !isSafeToOpen(pending)) return;
    setInput(pending);
    void runLatest.current(pending);
  }, []);

  // Último texto da área de transferência já visto: não reaproveita o que estava copiado antes (ex.: o próprio link).
  const seenClipboard = useRef("");
  const runLatest = useRef(run);
  runLatest.current = run;

  const frameRef = useRef<HTMLIFrameElement>(null);

  /** Apresenta a Lumi para a extensão no quadro (o Firefox não informa a origem da página-mãe). */
  function helloFrame() {
    frameRef.current?.contentWindow?.postMessage({ type: "lumi:hello" }, BYPASS_CITY_ORIGIN);
  }

  // Com a extensão: depois que o usuário resolve o captcha, ela lê o link no quadro e manda para cá.
  useEffect(() => {
    if (status !== "gated") return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== BYPASS_CITY_ORIGIN || event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (data?.type === "lumi:ready") return helloFrame();
      if (data?.type !== "lumi:bypass-result" || typeof data.url !== "string") return;
      if (!isSafeToOpen(data.url) || data.url === gateUrl) return;
      setPasted(data.url);
      void runLatest.current(data.url, true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [status, gateUrl]);

  // Depois do "Copy Link" na verificação, voltar para a Lumi (clique na página ou volta da outra aba) já usa o link.
  useEffect(() => {
    if (status !== "gated") return;
    let active = true;
    void (async () => {
      if (await clipboardGranted()) seenClipboard.current = (await readClipboard()) ?? "";
    })();

    const onFocus = async () => {
      if (!(await clipboardGranted())) return;
      const text = await readClipboard();
      if (!active || !text || text === seenClipboard.current || text === gateUrl || !isSafeToOpen(text)) return;
      seenClipboard.current = text;
      setPasted(text);
      void runLatest.current(text, true);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [status, gateUrl]);

  function reset() {
    runId.current++;
    controller.current?.abort();
    setResult(null);
    setError("");
    setCopied(false);
    setCleanCopied(false);
    setScanState({ status: "idle" });
    setGateUrl("");
    setFrameOpen(false);
    setFrameLoaded(false);
    setClipboardHint("");
    setExtensionHelp(false);
    setExtToast(false);
  }

  // Link com anúncio e sem a extensão: a Lumi sugere instalar (uma vez, até o usuário dispensar).
  useEffect(() => {
    if (status !== "gated" || hasLumiExtension() || toastDismissed()) return;
    const timer = window.setTimeout(() => setExtToast(true), 600);
    return () => window.clearTimeout(timer);
  }, [status]);

  function dismissExtToast() {
    setExtToast(false);
    try {
      localStorage.setItem(EXT_TOAST_DISMISSED_KEY, "1");
    } catch {
      // sem armazenamento: volta a aparecer na próxima vez
    }
  }

  /** Sem loja nem .xpi, "Instalar" abre o passo a passo local no card. */
  function showLocalInstall() {
    setExtToast(false);
    setExtensionHelp(true);
    window.setTimeout(() => extHelpRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 50);
  }

  function reloadWithExtension() {
    try {
      sessionStorage.setItem(PENDING_GATE_KEY, gateUrl);
    } catch {
      // sem armazenamento: recarrega mesmo assim
    }
    window.location.reload();
  }

  async function copyExtensionsPage() {
    try {
      await navigator.clipboard.writeText(extensionsPage());
      setPageCopied(true);
      window.setTimeout(() => setPageCopied(false), 1600);
    } catch {
      // sem permissão: o endereço continua visível para copiar à mão
    }
  }

  /** fromGate: o destino veio de um link com anúncio (colado pelo usuário depois da verificação). */
  async function run(value: string, fromGate = false) {
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
      // Destino escondido atrás de anúncio é onde mais aparece malware: analisa sem esperar o clique.
      if (fromGate || data.hops.some((hop) => hop.kind)) void analyze(data.finalUrl);
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
    void run(pasted, true);
  }

  /** Colar um endereço válido no campo já revela e analisa, sem precisar clicar no botão. */
  function pasteAndRun(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text").trim();
    if (!isSafeToOpen(text)) return;
    event.preventDefault();
    setPasted(text);
    void run(text, true);
  }

  async function pasteFromClipboard() {
    const text = await readClipboard();
    if (text === null) {
      setClipboardHint("Sem acesso à área de transferência. Cole no campo com Ctrl+V.");
      return;
    }
    seenClipboard.current = text;
    setPasted(text);
    if (isSafeToOpen(text)) void run(text, true);
    else setClipboardHint("O que está copiado não é um link. Use o botão Copy Link da verificação.");
  }

  async function analyze(url = result?.finalUrl) {
    if (!url) return;
    const id = runId.current;
    const signal = controller.current?.signal;
    setScanState({ status: "loading" });
    try {
      for (let attempt = 0; attempt <= maxScanRetries; attempt++) {
        try {
          const data = await scan(url, signal);
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

  async function copyClean() {
    if (!result?.cleanUrl) return;
    try {
      await navigator.clipboard?.writeText(result.cleanUrl);
    } catch {
      return;
    }
    setCleanCopied(true);
    window.setTimeout(() => setCleanCopied(false), 1600);
  }

  const isLoading = status === "loading";
  const canReadClipboard = typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";
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
            <h3>Falta só uma verificação</h3>
            <p>Este link esconde o destino atrás de uma página de anúncio. Resolva a verificação e a Lumi faz o resto.</p>
          </div>

          <ol className="gate-steps" aria-label="Etapas">
            <li className={frameOpen ? "done" : "active"}><span>1</span>Abrir verificação</li>
            <li className={frameOpen ? "active" : ""}><span>2</span>Resolver e copiar o link</li>
            <li><span>3</span>Lumi revela e analisa</li>
          </ol>

          {!hasLumiExtension() && (
            <>
              <div className="gate-ext">
                <p>
                  <b>Quer pular o copiar e colar?</b> Com a extensão da Lumi, o link revelado vem sozinho depois do captcha.
                </p>
                {extensionInstallUrl() ? (
                  <a href={extensionInstallUrl()!} rel="noopener noreferrer" target="_blank">
                    Instalar extensão {icons.arrow}
                  </a>
                ) : (
                  <button aria-expanded={extensionHelp} onClick={() => setExtensionHelp((open) => !open)} type="button">
                    Instalar extensão {icons.arrow}
                  </button>
                )}
              </div>
              {extensionHelp && (
                <div className="gate-ext-help" aria-label="Instalar a extensão localmente" ref={extHelpRef} role="region">
                  <ol>
                    <li>
                      Abra uma nova aba em <code>{extensionsPage()}</code>{" "}
                      <button onClick={() => void copyExtensionsPage()} type="button">{icons.copy} {pageCopied ? "Copiado" : "Copiar"}</button>
                      <small>O navegador não deixa sites abrirem essa página: cole na barra de endereço.</small>
                    </li>
                    {isFirefox() ? (
                      <>
                        <li>
                          Clique em <b>Carregar extensão temporária...</b> e escolha o arquivo <code>extension/manifest.json</code>.
                          <small>No Firefox ela fica até fechar o navegador; depois é só carregar de novo.</small>
                        </li>
                        <li>
                          Em <code>about:addons</code> → Lumi Links → <b>Permissões</b>, ative o acesso a bypass.city e
                          localhost, se estiver desligado.
                        </li>
                      </>
                    ) : (
                      <>
                        <li>Ligue o <b>Modo do desenvolvedor</b> (canto superior direito).</li>
                        <li>Clique em <b>Carregar sem compactação</b> e escolha a pasta <code>extension/</code> do projeto.</li>
                      </>
                    )}
                  </ol>
                  <button className="gate-ext-reload" onClick={reloadWithExtension} type="button">
                    Já instalei, recarregar
                  </button>
                </div>
              )}
            </>
          )}

          {!frameOpen ? (
            <div className="gate-consent">
              <p>A verificação é feita pelo serviço parceiro <b>bypass.city</b>, carregado pelo seu navegador.</p>
              <button onClick={() => setFrameOpen(true)} type="button">Resolver aqui na Lumi {icons.arrow}</button>
            </div>
          ) : (
            <div className="gate-window">
              <div className="gate-window-bar">
                <span className="gate-window-lock">{icons.shield}</span>
                <strong>Verificação segura</strong>
                <small>via bypass.city</small>
                <a
                  aria-label="Abrir verificação em outra aba"
                  href={`${BYPASS_CITY}${encodeURIComponent(gateUrl)}`}
                  rel="noopener noreferrer"
                  target="_blank"
                  title="Abrir em outra aba"
                >
                  {icons.arrow}
                </a>
              </div>
              <div className="gate-window-body">
                {!frameLoaded && (
                  <div className="gate-loading" role="status">
                    <span><i /><i /><i /></span>
                    <strong>Preparando a verificação</strong>
                  </div>
                )}
                <iframe
                  className={`gate-frame ${frameLoaded ? "loaded" : ""}`}
                  ref={frameRef}
                  onLoad={() => {
                    setFrameLoaded(true);
                    helloFrame();
                  }}
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  src={`${BYPASS_CITY}${encodeURIComponent(gateUrl)}`}
                  title="Verificação do bypass.city"
                />
              </div>
            </div>
          )}

          <form className="gate-paste" onSubmit={usePasted}>
            <label>
              <span>{icons.link}</span>
              <input
                aria-label="Cole o destino revelado"
                onChange={(event) => setPasted(event.target.value)}
                onPaste={pasteAndRun}
                placeholder="Cole aqui o link revelado..."
                type="text"
                value={pasted}
              />
              {canReadClipboard && (
                <button className="gate-paste-clip" onClick={() => void pasteFromClipboard()} type="button">
                  {icons.copy} Colar
                </button>
              )}
            </label>
            <button disabled={!pasted.trim()} type="submit">Usar este destino {icons.arrow}</button>
          </form>
          {clipboardHint && <p className="gate-tip" role="status">{clipboardHint}</p>}

          {hasLumiExtension() ? (
            <p className="gate-tip">
              Resolva o captcha e pronto: a <b>extensão da Lumi</b> traz o link revelado e já analisa. Não precisa abrir
              nem copiar nada por lá.
            </p>
          ) : isFirefox() ? (
            <p className="gate-tip">
              Na verificação, clique em <b>Copy Link</b> e cole aqui com Ctrl+V: a Lumi revela e analisa na hora. Evite
              abrir o link por lá: a Lumi analisa antes.
            </p>
          ) : (
            <p className="gate-tip">
              Na verificação, clique em <b>Copy Link</b> e volte para a Lumi: com o acesso à área de transferência
              permitido, o link entra sozinho. Evite abrir o link por lá: a Lumi analisa antes.
            </p>
          )}
          <p className="gate-credit">
            Verificação fornecida por <a href="https://bypass.city/" rel="noopener noreferrer" target="_blank">bypass.city</a>.
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
            {result.provider && (
              <p className="gate-credit">
                Link com anúncio resolvido por{" "}
                {isSafeToOpen(result.provider.site) ? (
                  <a href={result.provider.site} rel="noopener noreferrer" target="_blank">{result.provider.name}</a>
                ) : (
                  <b>{result.provider.name}</b>
                )}
                .
              </p>
            )}
            {result.hops.length > 1 && (
              <ol className="reveal-hops" aria-label="Rota percorrida">
                {result.hops.map((hop, index) => (
                  <li key={`${hop.url}-${index}`}>
                    <b title={hop.kind && hopLabel[hop.kind].title}>{hop.kind ? hopLabel[hop.kind].text : hop.status}</b>
                    <span>{hop.url}</span>
                  </li>
                ))}
              </ol>
            )}

            {result.trackers && <TrackerList trackers={result.trackers} />}

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
            {result.cleanUrl && (
              <button onClick={() => void copyClean()} type="button">
                {icons.copy} {cleanCopied ? "Copiado" : "Copiar link limpo"}
              </button>
            )}
            <button disabled={scanning || scanState.status === "done"} onClick={() => void analyze()} type="button">
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

      {extToast && status === "gated" && (
        <aside aria-label="Instale a extensão da Lumi" className="ext-toast" role="dialog">
          <span className="ext-toast-icon">{icons.shield}</span>
          <div>
            <strong>Instale a extensão da Lumi</strong>
            <p>Depois do captcha, o link revelado vem sozinho e já vai para a análise. Sem copiar e colar.</p>
            <div className="ext-toast-actions">
              {extensionInstallUrl() ? (
                <a href={extensionInstallUrl()!} onClick={() => setExtToast(false)} rel="noopener noreferrer" target="_blank">
                  Instalar {icons.arrow}
                </a>
              ) : (
                <button onClick={showLocalInstall} type="button">Instalar {icons.arrow}</button>
              )}
              <button className="ext-toast-later" onClick={dismissExtToast} type="button">Agora não</button>
            </div>
          </div>
          <button aria-label="Fechar" className="ext-toast-close" onClick={() => setExtToast(false)} type="button">×</button>
        </aside>
      )}

      <div className="close-info-grid">
        <article><span>01</span><div><strong>Cole o portal</strong><p>Links encurtados como bit.ly, tinyurl e t.co.</p></div></article>
        <article><span>02</span><div><strong>Siga a rota</strong><p>A Lumi acompanha cada redirecionamento até o fim, inclusive os escondidos na página.</p></div></article>
        <article><span>03</span><div><strong>Confira o destino</strong><p>Veja o endereço original e peça uma análise de segurança.</p></div></article>
      </div>
      <p className="partner-note">Use apenas em links que você tem permissão para acessar.</p>
    </section>
  );
}
