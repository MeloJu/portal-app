/**
 * Abre a página de anúncio num navegador headless e observa para onde ela leva sozinha:
 * redirecionamentos montados em JavaScript, ofuscados ou disparados por timer, que o leitor
 * estático (lib/extract.ts) não alcança.
 *
 * Só observa: não clica em nada, não resolve captcha nem completa tarefas de anúncio.
 * Se a página pede captcha, desiste e a tela usa o quadro do bypass.city.
 *
 * BROWSER_RESOLVER=on      liga o resolvedor (desligado por padrão).
 * BROWSER_CHANNEL          navegador instalado usado pelo playwright-core: msedge (padrão) ou chrome.
 * BROWSER_EXECUTABLE_PATH  caminho de um Chromium, no lugar do canal.
 * BROWSER_WAIT_MS          quanto esperar a página revelar o destino (padrão: 12000).
 * BROWSER_SANDBOX=off      desliga o sandbox do Chromium (padrão: ligado). Só para ambientes onde ele não
 *                          consegue iniciar; as páginas de anúncio são conteúdo hostil, então evite.
 */
import dns from "node:dns/promises";
import net from "node:net";
import type { Browser, Route } from "playwright-core";
import { isAdGate } from "./adgates.ts";
import { isPrivateIp } from "./ssrf.ts";

export type BrowserResolver = (gate: URL, signal: AbortSignal) => Promise<URL | null>;

/** Recursos que não ajudam a achar o destino: bloquear deixa a página leve e corta boa parte dos anúncios. */
const BLOCKED_TYPES = new Set(["image", "media", "font", "stylesheet", "websocket", "eventsource", "manifest"]);
const CAPTCHA_FRAMES = /recaptcha|hcaptcha\.com|challenges\.cloudflare\.com|turnstile/i;

async function isPublicHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return !isPrivateIp(host);
  if (host === "localhost" || /\.(localhost|local|internal)$/i.test(host)) return false;
  try {
    const list = await dns.lookup(host, { all: true });
    return list.length > 0 && !list.some((a) => isPrivateIp(a.address));
  } catch {
    return false;
  }
}

/** O destino é a primeira navegação do quadro principal para fora do serviço de anúncio. */
export function isDestination(candidate: URL, gate: URL): boolean {
  if (candidate.protocol !== "http:" && candidate.protocol !== "https:") return false;
  if (candidate.hostname === gate.hostname) return false;
  return !isAdGate(candidate.hostname);
}

type Config = { enabled?: boolean; channel?: string; executablePath?: string; waitMs?: number; sandbox?: boolean };

export function createBrowserResolver(config: Config = {}): BrowserResolver | null {
  const {
    enabled = process.env.BROWSER_RESOLVER === "on",
    channel = process.env.BROWSER_CHANNEL || "msedge",
    executablePath = process.env.BROWSER_EXECUTABLE_PATH || undefined,
    waitMs = Number(process.env.BROWSER_WAIT_MS) || 12_000,
    // O Playwright abre o Chromium com --no-sandbox por padrão; aqui o sandbox fica ligado.
    sandbox = process.env.BROWSER_SANDBOX !== "off",
  } = config;
  if (!enabled) return null;

  // Um navegador para todas as requisições; cada link ganha um contexto novo (sem cookies compartilhados).
  let browser: Promise<Browser> | null = null;
  async function getBrowser() {
    if (!browser) {
      const { chromium } = await import("playwright-core");
      browser = chromium.launch({ headless: true, chromiumSandbox: sandbox, ...(executablePath ? { executablePath } : { channel }) });
      browser.then((b) => b.on("disconnected", () => (browser = null))).catch(() => (browser = null));
    }
    return browser;
  }

  return async (gate, signal) => {
    const context = await (await getBrowser()).newContext({
      acceptDownloads: false,
      serviceWorkers: "block",
      javaScriptEnabled: true,
      locale: "pt-BR",
    });
    try {
      const page = await context.newPage();
      // Popups costumam ser anúncios, não o destino: fecha sem olhar.
      context.on("page", (popup) => void (popup !== page && popup.close().catch(() => {})));

      let found: URL | null = null;
      let captcha = false;
      let settle: () => void = () => {};
      const done = new Promise<void>((resolve) => (settle = resolve));
      signal.addEventListener("abort", () => settle(), { once: true });

      await context.route("**/*", async (route: Route) => {
        const request = route.request();
        let url: URL;
        try {
          url = new URL(request.url());
        } catch {
          return route.abort();
        }
        if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
        if ((url.protocol !== "http:" && url.protocol !== "https:") || !(await isPublicHost(url.hostname))) {
          return route.abort("blockedbyclient");
        }
        if (CAPTCHA_FRAMES.test(url.href)) {
          captcha = true;
          settle();
          return route.abort();
        }
        const mainNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame();
        if (mainNavigation && isDestination(url, gate)) {
          // Só precisamos do endereço: não carrega o destino.
          found ??= url;
          settle();
          return route.abort();
        }
        if (BLOCKED_TYPES.has(request.resourceType())) return route.abort();
        return route.continue();
      });

      // Um prazo só para carregar e esperar: senão o navegador gastaria até 2x waitMs e não sobraria
      // tempo para o serviço de bypass dentro do limite total da requisição.
      const deadline = Date.now() + waitMs;
      await page.goto(gate.href, { waitUntil: "domcontentloaded", timeout: waitMs }).catch(() => {});
      const left = deadline - Date.now();
      if (!found && !captcha && !signal.aborted && left > 0) {
        await Promise.race([done, new Promise((resolve) => setTimeout(resolve, left))]);
      }
      return captcha ? null : found;
    } finally {
      await context.close().catch(() => {});
    }
  };
}
