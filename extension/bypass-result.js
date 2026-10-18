/**
 * Roda dentro do quadro do bypass.city aberto pela Lumi. Depois que o usuário resolve o captcha,
 * lê o link revelado na página e manda para a Lumi (window.parent) com postMessage.
 * Não clica em nada nem toca no captcha: só lê o resultado que já está na tela.
 */
(() => {
  // Origens da Lumi que podem receber o resultado (adicione o domínio de produção aqui e no manifest).
  const LUMI_ORIGINS = ["http://localhost:5173"];
  const GIVE_UP_MS = 10 * 60 * 1000;

  // Só age quando está dentro de um quadro da Lumi: abrindo o bypass.city direto, não faz nada.
  if (window === window.top) return;

  // Chrome/Edge informam a origem da página-mãe; o Firefox não (sem ancestorOrigins), então a Lumi
  // se apresenta com uma mensagem "lumi:hello" e a origem dela vem do próprio evento.
  let parentOrigin = location.ancestorOrigins?.[0] ?? null;
  if (parentOrigin && !LUMI_ORIGINS.includes(parentOrigin)) return;

  const isTruncated = (text) => /(\.\.\.|…)$/.test(text);

  function asDestination(text) {
    if (!text || isTruncated(text)) return null;
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      if (url.hostname === location.hostname || url.hostname.endsWith(".bypass.city")) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  /** Procura o link revelado. Os seletores seguem o layout atual do bypass.city. */
  function findResult(doc) {
    // 1) botão/link "Open bypassed Link"
    for (const a of doc.querySelectorAll("a[href]")) {
      if (/open bypassed link/i.test(a.textContent ?? "")) {
        const url = asDestination(a.getAttribute("href"));
        if (url) return url;
      }
    }
    // 2) linha "The resolved url is: ..."
    for (const el of doc.querySelectorAll("div, p, span, li")) {
      const text = el.textContent ?? "";
      if (!/resolved url is/i.test(text) || el.children.length > 3) continue;
      const link = el.querySelector("a[href]");
      const url = asDestination(link?.getAttribute("href")) ?? asDestination(link?.getAttribute("title"));
      if (url) return url;
      const titled = el.querySelector("[title]");
      const fromTitle = asDestination(titled?.getAttribute("title"));
      if (fromTitle) return fromTitle;
      const match = /resolved url is:?\s*(\S+)/i.exec(text);
      const fromText = asDestination(match?.[1]);
      if (fromText) return fromText;
    }
    return null;
  }

  let sent = false;
  function check() {
    if (sent || !parentOrigin) return;
    const url = findResult(document);
    if (!url) return;
    sent = true;
    observer.disconnect();
    window.parent.postMessage({ type: "lumi:bypass-result", url }, parentOrigin);
  }

  window.addEventListener("message", (event) => {
    if (parentOrigin || event.source !== window.parent || !LUMI_ORIGINS.includes(event.origin)) return;
    if (event.data?.type !== "lumi:hello") return;
    parentOrigin = event.origin;
    check();
  });
  // Avisa a página-mãe que está pronta (sem dados), para a Lumi responder com "lumi:hello".
  if (!parentOrigin) window.parent.postMessage({ type: "lumi:ready" }, "*");

  const observer = new MutationObserver(check);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
  setTimeout(() => observer.disconnect(), GIVE_UP_MS);
  check();

})();
