import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import * as tools from "../../api/tools";
import RevealDestinationPanel from "./RevealDestinationPanel";

vi.mock("../../api/tools", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/tools")>()),
  unshorten: vi.fn(),
  scan: vi.fn(),
}));

const unshorten = vi.mocked(tools.unshorten);
const scan = vi.mocked(tools.scan);

const resolved = {
  originalUrl: "https://bit.ly/abc",
  finalUrl: "https://www.example.com/pagina?x=1",
  hops: [
    { url: "https://bit.ly/abc", status: 301 },
    { url: "https://www.example.com/pagina?x=1", status: 200 },
  ],
  resolvedBy: "redirect",
};

const stats = { malicious: 0, suspicious: 0, harmless: 60, undetected: 10 };

async function reveal(value = "bit.ly/abc") {
  await userEvent.type(screen.getByLabelText(/link para revelar/i), value);
  await userEvent.click(screen.getByRole("button", { name: /revelar destino/i }));
}

beforeEach(() => {
  unshorten.mockReset();
  scan.mockReset();
});

describe("RevealDestinationPanel", () => {
  it("mostra o destino final e a rota na própria tela", async () => {
    unshorten.mockResolvedValue(resolved);
    render(<RevealDestinationPanel />);
    await reveal();

    expect(await screen.findByText(resolved.finalUrl, { selector: ".reveal-final" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("example.com");
    expect(screen.getByRole("list", { name: /rota percorrida/i })).toBeInTheDocument();
    expect(unshorten).toHaveBeenCalledWith("bit.ly/abc", expect.any(AbortSignal));
    expect(screen.getByRole("link", { name: /abrir destino/i })).toHaveAttribute("href", resolved.finalUrl);
  });

  it("marca o salto lido do próprio link em vez de mostrar status 0", async () => {
    unshorten.mockResolvedValue({
      ...resolved,
      resolvedBy: "decoded",
      hops: [
        { url: "https://link-to.net/1/2/dynamic?r=x", status: 0, kind: "decoded" },
        { url: resolved.finalUrl, status: 200 },
      ],
    });
    render(<RevealDestinationPanel />);
    await reveal();

    const route = await screen.findByRole("list", { name: /rota percorrida/i });
    expect(route).toHaveTextContent("lido");
    expect(route).not.toHaveTextContent(/^0/);
  });

  it("marca o salto lido do conteúdo da página", async () => {
    unshorten.mockResolvedValue({
      ...resolved,
      resolvedBy: "page",
      hops: [
        { url: "https://sub2unlock.com/abc", status: 200, kind: "page" },
        { url: resolved.finalUrl, status: 200 },
      ],
    });
    render(<RevealDestinationPanel />);
    await reveal();

    const route = await screen.findByRole("list", { name: /rota percorrida/i });
    expect(route).toHaveTextContent("página");
    expect(screen.getByTitle("Destino lido do conteúdo da página")).toBeInTheDocument();
  });

  it("analisa sozinho o destino que estava escondido atrás de anúncio", async () => {
    unshorten.mockResolvedValue({
      ...resolved,
      resolvedBy: "page",
      hops: [
        { url: "https://sub2unlock.com/abc", status: 200, kind: "page" },
        { url: resolved.finalUrl, status: 200 },
      ],
    });
    scan.mockResolvedValue({
      url: resolved.finalUrl,
      verdict: "clean",
      stats,
      permalink: "https://www.virustotal.com/gui/url/x",
    });
    render(<RevealDestinationPanel />);
    await reveal();

    expect(await screen.findByText("Seguro")).toBeInTheDocument();
    expect(scan).toHaveBeenCalledWith(resolved.finalUrl, expect.any(AbortSignal));
  });

  it("dá o crédito ao serviço de bypass que revelou o destino e já analisa", async () => {
    unshorten.mockResolvedValue({
      ...resolved,
      resolvedBy: "provider",
      provider: { name: "bypass.city", site: "https://bypass.city/" },
      hops: [
        { url: "https://linkvertise.com/1/abc", status: 0, kind: "provider" },
        { url: resolved.finalUrl, status: 200 },
      ],
    });
    scan.mockResolvedValue({
      url: resolved.finalUrl,
      verdict: "clean",
      stats,
      permalink: "https://www.virustotal.com/gui/url/x",
    });
    render(<RevealDestinationPanel />);
    await reveal();

    expect(await screen.findByText(/resolvido por/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "bypass.city" })).toHaveAttribute("href", "https://bypass.city/");
    expect(screen.getByRole("list", { name: /rota percorrida/i })).toHaveTextContent("bypass");
    expect(await screen.findByText("Seguro")).toBeInTheDocument();
  });

  it("mostra os rastreadores do link e copia o link limpo", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    unshorten.mockResolvedValue({
      ...resolved,
      finalUrl: "https://www.example.com/p?id=7&fbclid=z",
      cleanUrl: "https://www.example.com/p?id=7",
      trackers: [
        { name: "utm_source", category: "analytics", kind: "param", inFinal: false },
        { name: "fbclid", category: "social", kind: "param", inFinal: true },
      ],
    });
    render(<RevealDestinationPanel />);
    await reveal();

    const group = await screen.findByRole("group", { name: /rastreadores no link/i });
    expect(group).toHaveTextContent("2 rastreadores no link");
    expect(group).toHaveTextContent("fbclid");
    expect(group).toHaveTextContent("rede social");
    await userEvent.click(screen.getByRole("button", { name: /copiar link limpo/i }));
    expect(writeText).toHaveBeenCalledWith("https://www.example.com/p?id=7");
    expect(await screen.findByRole("button", { name: /copiado/i })).toBeInTheDocument();
  });

  it("não mostra rastreadores nem botão de link limpo em link sem rastreador", async () => {
    unshorten.mockResolvedValue(resolved);
    render(<RevealDestinationPanel />);
    await reveal();

    expect(await screen.findByText("DESTINO REVELADO")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /rastreadores/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /link limpo/i })).not.toBeInTheDocument();
  });

  it("não gasta análise em link comum sem o usuário pedir", async () => {
    unshorten.mockResolvedValue(resolved);
    render(<RevealDestinationPanel />);
    await reveal();

    expect(await screen.findByText("DESTINO REVELADO")).toBeInTheDocument();
    expect(scan).not.toHaveBeenCalled();
  });

  it("não chama a API com o campo vazio", async () => {
    render(<RevealDestinationPanel />);
    await userEvent.click(screen.getByRole("button", { name: /revelar destino/i }));
    expect(unshorten).not.toHaveBeenCalled();
  });

  it("mostra a mensagem de erro da API", async () => {
    unshorten.mockRejectedValue(new tools.ToolsError(422, "REDIRECT_LOOP", "O link redireciona em círculo."));
    render(<RevealDestinationPanel />);
    await reveal("a.com");
    expect(await screen.findByRole("alert")).toHaveTextContent("O link redireciona em círculo.");
  });

  it("não oferece abrir destinos que não sejam http/https", async () => {
    unshorten.mockResolvedValue({ ...resolved, finalUrl: "javascript:alert(1)", hops: [] });
    render(<RevealDestinationPanel />);
    await reveal();
    await screen.findByText("DESTINO REVELADO");
    expect(screen.queryByRole("link", { name: /abrir destino/i })).not.toBeInTheDocument();
  });

  it("analisa o destino e mostra o veredito", async () => {
    unshorten.mockResolvedValue(resolved);
    scan.mockResolvedValue({
      url: resolved.finalUrl,
      verdict: "malicious",
      stats: { ...stats, malicious: 5 },
      permalink: "https://www.virustotal.com/gui/url/x",
    });
    render(<RevealDestinationPanel />);
    await reveal();
    await userEvent.click(await screen.findByRole("button", { name: /analisar com a lumi/i }));

    expect(await screen.findByText("Perigoso")).toBeInTheDocument();
    expect(scan).toHaveBeenCalledWith(resolved.finalUrl, expect.any(AbortSignal));
    expect(screen.getByRole("link", { name: /relatório completo/i })).toHaveAttribute(
      "rel",
      expect.stringContaining("noopener"),
    );
  });

  it("repete a análise enquanto o VirusTotal ainda está processando", async () => {
    unshorten.mockResolvedValue(resolved);
    scan.mockRejectedValueOnce(new tools.ToolsError(202, "ANALYSIS_PENDING", "em andamento")).mockResolvedValueOnce({
      url: resolved.finalUrl,
      verdict: "clean",
      stats,
      permalink: "https://www.virustotal.com/gui/url/x",
    });
    render(<RevealDestinationPanel scanRetryMs={5} />);
    await reveal();
    await userEvent.click(await screen.findByRole("button", { name: /analisar com a lumi/i }));

    expect(await screen.findByText("Seguro")).toBeInTheDocument();
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it("desiste depois de muitas tentativas pendentes", async () => {
    unshorten.mockResolvedValue(resolved);
    scan.mockRejectedValue(new tools.ToolsError(202, "ANALYSIS_PENDING", "em andamento"));
    render(<RevealDestinationPanel scanRetryMs={1} maxScanRetries={2} />);
    await reveal();
    await userEvent.click(await screen.findByRole("button", { name: /analisar com a lumi/i }));

    expect(await screen.findByText(/demorando mais que o normal/i)).toBeInTheDocument();
    expect(scan).toHaveBeenCalledTimes(3);
  });

  describe("link com anúncio (AD_GATED)", () => {
    const gate = "https://linkvertise.com/514008/abc";
    const gated = () => new tools.ToolsError(422, "AD_GATED", "anúncio", gate);

    it("só carrega o bypass.city depois do clique do usuário", async () => {
      unshorten.mockRejectedValue(gated());
      render(<RevealDestinationPanel />);
      await reveal(gate);

      expect(await screen.findByText(/falta só uma verificação/i)).toBeInTheDocument();
      expect(screen.queryByTitle(/verificação do bypass\.city/i)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /resolver aqui na lumi/i }));
      const frame = screen.getByTitle(/verificação do bypass\.city/i);
      expect(frame).toHaveAttribute("src", `https://bypass.city/bypass?bypass=${encodeURIComponent(gate)}`);
      expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    });

    it("isola o quadro: sem navegar a página nem abrir popups", async () => {
      unshorten.mockRejectedValue(gated());
      render(<RevealDestinationPanel />);
      await reveal(gate);
      await userEvent.click(await screen.findByRole("button", { name: /resolver aqui na lumi/i }));

      const sandbox = screen.getByTitle(/verificação do bypass\.city/i).getAttribute("sandbox") ?? "";
      expect(sandbox).not.toContain("allow-top-navigation");
      expect(sandbox).not.toContain("allow-popups");
    });

    it("mostra o crédito e um link para abrir em outra aba", async () => {
      unshorten.mockRejectedValue(gated());
      render(<RevealDestinationPanel />);
      await reveal(gate);

      const credit = await screen.findByRole("link", { name: "bypass.city" });
      expect(credit).toHaveAttribute("rel", expect.stringContaining("noopener"));
      expect(screen.getByRole("link", { name: /abra em outra aba/i })).toHaveAttribute("target", "_blank");
    });

    it("revela e já analisa o destino colado pelo usuário", async () => {
      unshorten.mockRejectedValueOnce(gated()).mockResolvedValueOnce(resolved);
      scan.mockResolvedValue({
        url: resolved.finalUrl,
        verdict: "malicious",
        stats: { ...stats, malicious: 3 },
        permalink: "https://www.virustotal.com/gui/url/x",
      });
      render(<RevealDestinationPanel />);
      await reveal(gate);

      const paste = await screen.findByLabelText(/cole o destino revelado/i);
      expect(screen.getByRole("button", { name: /usar este destino/i })).toBeDisabled();
      await userEvent.type(paste, "https://www.example.com/pagina?x=1");
      await userEvent.click(screen.getByRole("button", { name: /usar este destino/i }));

      expect(await screen.findByText("DESTINO REVELADO")).toBeInTheDocument();
      expect(unshorten).toHaveBeenLastCalledWith("https://www.example.com/pagina?x=1", expect.any(AbortSignal));
      expect(screen.queryByText(/falta só uma verificação/i)).not.toBeInTheDocument();
      expect(await screen.findByText("Perigoso")).toBeInTheDocument();
      expect(scan).toHaveBeenCalledTimes(1);
      expect(scan).toHaveBeenCalledWith(resolved.finalUrl, expect.any(AbortSignal));
    });

    it("colar um link no campo já revela e analisa, sem clicar no botão", async () => {
      unshorten.mockRejectedValueOnce(gated()).mockResolvedValueOnce(resolved);
      scan.mockResolvedValue({
        url: resolved.finalUrl,
        verdict: "clean",
        stats,
        permalink: "https://www.virustotal.com/gui/url/x",
      });
      render(<RevealDestinationPanel />);
      await reveal(gate);

      const paste = await screen.findByLabelText(/cole o destino revelado/i);
      await userEvent.click(paste);
      await userEvent.paste("https://www.example.com/pagina?x=1");

      expect(await screen.findByText("Seguro")).toBeInTheDocument();
      expect(unshorten).toHaveBeenLastCalledWith("https://www.example.com/pagina?x=1", expect.any(AbortSignal));
    });

    it("colar texto que não é link só preenche o campo", async () => {
      unshorten.mockRejectedValueOnce(gated());
      render(<RevealDestinationPanel />);
      await reveal(gate);

      const paste = await screen.findByLabelText(/cole o destino revelado/i);
      await userEvent.click(paste);
      await userEvent.paste("não é link");

      expect(paste).toHaveValue("não é link");
      expect(unshorten).toHaveBeenCalledTimes(1);
    });

    it("mostra a Lumi carregando até o quadro terminar de abrir", async () => {
      unshorten.mockRejectedValue(gated());
      render(<RevealDestinationPanel />);
      await reveal(gate);
      await userEvent.click(await screen.findByRole("button", { name: /resolver aqui na lumi/i }));

      expect(screen.getByText(/preparando a verificação/i)).toBeInTheDocument();
      fireEvent.load(screen.getByTitle(/verificação do bypass\.city/i));
      expect(screen.queryByText(/preparando a verificação/i)).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: /abrir verificação em outra aba/i })).toHaveAttribute("target", "_blank");
    });

    describe("extensão da Lumi", () => {
      afterEach(() => {
        delete document.documentElement.dataset.lumiExtension;
        localStorage.clear();
      });

      it("mostra a notificação sugerindo instalar, e 'Instalar' abre o passo a passo", async () => {
        unshorten.mockRejectedValueOnce(gated());
        render(<RevealDestinationPanel />);
        await reveal(gate);

        const toast = await screen.findByRole("dialog", { name: /instale a extensão da lumi/i }, { timeout: 2000 });
        await userEvent.click(within(toast).getByRole("button", { name: /^instalar/i }));

        expect(screen.queryByRole("dialog", { name: /instale a extensão/i })).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: /instalar a extensão/i })).toBeInTheDocument();
      });

      it("'Agora não' esconde a notificação e lembra a escolha", async () => {
        unshorten.mockRejectedValue(gated());
        const { unmount } = render(<RevealDestinationPanel />);
        await reveal(gate);
        const toast = await screen.findByRole("dialog", { name: /instale a extensão/i }, { timeout: 2000 });
        await userEvent.click(within(toast).getByRole("button", { name: /agora não/i }));
        expect(localStorage.getItem("lumi:ext-toast-dismissed")).toBe("1");
        unmount();

        render(<RevealDestinationPanel />);
        await reveal(gate);
        await screen.findByText(/falta só uma verificação/i);
        await new Promise((resolve) => setTimeout(resolve, 800));
        expect(screen.queryByRole("dialog", { name: /instale a extensão/i })).not.toBeInTheDocument();
      });

      it("não mostra a notificação com a extensão instalada", async () => {
        document.documentElement.dataset.lumiExtension = "1";
        unshorten.mockRejectedValueOnce(gated());
        render(<RevealDestinationPanel />);
        await reveal(gate);
        await screen.findByText(/falta só uma verificação/i);
        await new Promise((resolve) => setTimeout(resolve, 800));
        expect(screen.queryByRole("dialog", { name: /instale a extensão/i })).not.toBeInTheDocument();
      });

      it("sem a extensão, oferece instalar e mostra o passo a passo local", async () => {
        unshorten.mockRejectedValueOnce(gated());
        render(<RevealDestinationPanel />);
        await reveal(gate);

        const install = await screen.findByRole("button", { name: /instalar extensão/i });
        expect(screen.queryByRole("region", { name: /instalar a extensão/i })).not.toBeInTheDocument();
        await userEvent.click(install);

        const help = screen.getByRole("region", { name: /instalar a extensão/i });
        expect(help).toHaveTextContent("chrome://extensions");
        expect(help).toHaveTextContent("Carregar sem compactação");
        expect(screen.getByRole("button", { name: /já instalei, recarregar/i })).toBeInTheDocument();
      });

      it("no Firefox, mostra a instalação temporária pelo about:debugging", async () => {
        const ua = vi
          .spyOn(navigator, "userAgent", "get")
          .mockReturnValue("Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0");
        unshorten.mockRejectedValueOnce(gated());
        render(<RevealDestinationPanel />);
        await reveal(gate);
        await userEvent.click(await screen.findByRole("button", { name: /instalar extensão/i }));

        const help = screen.getByRole("region", { name: /instalar a extensão/i });
        expect(help).toHaveTextContent("about:debugging#/runtime/this-firefox");
        expect(help).toHaveTextContent("Carregar extensão temporária");
        expect(help).toHaveTextContent("extension/manifest.json");
        ua.mockRestore();
      });

      it("responde ao 'pronto' da extensão no quadro apresentando a Lumi", async () => {
        unshorten.mockRejectedValueOnce(gated());
        const frame = await openFrame();
        const post = vi.spyOn(frame.contentWindow!, "postMessage");

        send({ type: "lumi:ready" }, "https://bypass.city", frame.contentWindow);
        expect(post).toHaveBeenCalledWith({ type: "lumi:hello" }, "https://bypass.city");
      });

      it("com a extensão, não oferece instalar", async () => {
        document.documentElement.dataset.lumiExtension = "1";
        unshorten.mockRejectedValueOnce(gated());
        render(<RevealDestinationPanel />);
        await reveal(gate);

        await screen.findByText(/falta só uma verificação/i);
        expect(screen.queryByRole("button", { name: /instalar extensão/i })).not.toBeInTheDocument();
      });

      it("depois de recarregar, retoma o link que estava pendente", async () => {
        sessionStorage.setItem("lumi:pending-gate", gate);
        unshorten.mockRejectedValueOnce(gated());
        render(<RevealDestinationPanel />);

        expect(await screen.findByText(/falta só uma verificação/i)).toBeInTheDocument();
        expect(unshorten).toHaveBeenCalledWith(gate, expect.any(AbortSignal));
        expect(sessionStorage.getItem("lumi:pending-gate")).toBeNull();
        expect(screen.getByLabelText(/link para revelar/i)).toHaveValue(gate);
      });

      async function openFrame() {
        render(<RevealDestinationPanel />);
        await reveal(gate);
        await userEvent.click(await screen.findByRole("button", { name: /resolver aqui na lumi/i }));
        return screen.getByTitle(/verificação do bypass\.city/i) as HTMLIFrameElement;
      }

      const send = (data: unknown, origin: string, source: MessageEventSource | null) =>
        fireEvent(window, new MessageEvent("message", { data, origin, source }));

      it("recebe o link do quadro, fecha e já analisa", async () => {
        document.documentElement.dataset.lumiExtension = "1";
        unshorten.mockRejectedValueOnce(gated()).mockResolvedValueOnce(resolved);
        scan.mockResolvedValue({
          url: resolved.finalUrl,
          verdict: "clean",
          stats,
          permalink: "https://www.virustotal.com/gui/url/x",
        });
        const frame = await openFrame();
        expect(screen.getByText(/extensão da lumi/i)).toBeInTheDocument();

        send(
          { type: "lumi:bypass-result", url: "https://www.example.com/pagina?x=1" },
          "https://bypass.city",
          frame.contentWindow,
        );

        expect(await screen.findByText("Seguro")).toBeInTheDocument();
        expect(unshorten).toHaveBeenLastCalledWith("https://www.example.com/pagina?x=1", expect.any(AbortSignal));
        expect(screen.queryByTitle(/verificação do bypass\.city/i)).not.toBeInTheDocument();
      });

      it("ignora mensagens de outra origem, de outro quadro ou fora do formato", async () => {
        unshorten.mockRejectedValueOnce(gated());
        const frame = await openFrame();
        const ok = { type: "lumi:bypass-result", url: "https://www.example.com/" };

        send(ok, "https://malicioso.com", frame.contentWindow);
        send(ok, "https://bypass.city", window);
        send({ ...ok, url: "javascript:alert(1)" }, "https://bypass.city", frame.contentWindow);
        send({ type: "outra", url: ok.url }, "https://bypass.city", frame.contentWindow);
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(unshorten).toHaveBeenCalledTimes(1);
      });
    });

    describe("leitura automática ao voltar para a Lumi", () => {
      let clipboard = "";
      let permission = "granted";

      beforeEach(() => {
        clipboard = gate; // o usuário copiou o link com anúncio para colar na Lumi
        permission = "granted";
        Object.defineProperty(navigator, "permissions", {
          configurable: true,
          value: { query: async () => ({ state: permission }) },
        });
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { readText: async () => clipboard, writeText: async (text: string) => void (clipboard = text) },
        });
      });

      afterEach(() => {
        Reflect.deleteProperty(navigator, "permissions");
        Reflect.deleteProperty(navigator, "clipboard");
      });

      it("usa o link copiado na verificação e fecha o quadro", async () => {
        unshorten.mockRejectedValueOnce(gated()).mockResolvedValueOnce(resolved);
        scan.mockResolvedValue({
          url: resolved.finalUrl,
          verdict: "clean",
          stats,
          permalink: "https://www.virustotal.com/gui/url/x",
        });
        render(<RevealDestinationPanel />);
        await reveal(gate);
        await userEvent.click(await screen.findByRole("button", { name: /resolver aqui na lumi/i }));

        clipboard = "https://www.example.com/pagina?x=1"; // "Copy Link" dentro do quadro
        fireEvent.focus(window);

        expect(await screen.findByText("Seguro")).toBeInTheDocument();
        expect(unshorten).toHaveBeenLastCalledWith("https://www.example.com/pagina?x=1", expect.any(AbortSignal));
        expect(screen.queryByTitle(/verificação do bypass\.city/i)).not.toBeInTheDocument();
      });

      it("ignora o que já estava copiado antes e texto que não é link", async () => {
        unshorten.mockRejectedValueOnce(gated());
        render(<RevealDestinationPanel />);
        await reveal(gate);
        await screen.findByText(/falta só uma verificação/i);

        fireEvent.focus(window);
        clipboard = "não é link";
        fireEvent.focus(window);
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(unshorten).toHaveBeenCalledTimes(1);
      });

      it("não lê nada sem permissão", async () => {
        permission = "prompt";
        unshorten.mockRejectedValueOnce(gated());
        render(<RevealDestinationPanel />);
        await reveal(gate);
        await screen.findByText(/falta só uma verificação/i);

        clipboard = "https://www.example.com/";
        fireEvent.focus(window);
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(unshorten).toHaveBeenCalledTimes(1);
      });
    });

    it("não abre quadro para endereço que não seja http/https", async () => {
      unshorten.mockRejectedValue(new tools.ToolsError(422, "AD_GATED", "anúncio", "javascript:alert(1)"));
      render(<RevealDestinationPanel />);
      await reveal(gate);
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /resolver aqui na lumi/i })).not.toBeInTheDocument();
    });
  });

  it("mostra erro quando a análise falha", async () => {
    unshorten.mockResolvedValue(resolved);
    scan.mockRejectedValue(
      new tools.ToolsError(503, "SCAN_NOT_CONFIGURED", "A análise de segurança não está configurada."),
    );
    render(<RevealDestinationPanel />);
    await reveal();
    await userEvent.click(await screen.findByRole("button", { name: /analisar com a lumi/i }));
    expect(await screen.findByText(/não está configurada/i)).toBeInTheDocument();
  });
});
