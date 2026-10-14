import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
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
    scan.mockResolvedValue({ url: resolved.finalUrl, verdict: "malicious", stats: { ...stats, malicious: 5 }, permalink: "https://www.virustotal.com/gui/url/x" });
    render(<RevealDestinationPanel />);
    await reveal();
    await userEvent.click(await screen.findByRole("button", { name: /analisar com a lumi/i }));

    expect(await screen.findByText("Perigoso")).toBeInTheDocument();
    expect(scan).toHaveBeenCalledWith(resolved.finalUrl, expect.any(AbortSignal));
    expect(screen.getByRole("link", { name: /relatório completo/i })).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("repete a análise enquanto o VirusTotal ainda está processando", async () => {
    unshorten.mockResolvedValue(resolved);
    scan
      .mockRejectedValueOnce(new tools.ToolsError(202, "ANALYSIS_PENDING", "em andamento"))
      .mockResolvedValueOnce({ url: resolved.finalUrl, verdict: "clean", stats, permalink: "https://www.virustotal.com/gui/url/x" });
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

      expect(await screen.findByText(/passa por uma página de anúncio/i)).toBeInTheDocument();
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

    it("revela e permite analisar o destino colado pelo usuário", async () => {
      unshorten.mockRejectedValueOnce(gated()).mockResolvedValueOnce(resolved);
      render(<RevealDestinationPanel />);
      await reveal(gate);

      const paste = await screen.findByLabelText(/cole o destino revelado/i);
      expect(screen.getByRole("button", { name: /usar este destino/i })).toBeDisabled();
      await userEvent.type(paste, "https://www.example.com/pagina?x=1");
      await userEvent.click(screen.getByRole("button", { name: /usar este destino/i }));

      expect(await screen.findByText("DESTINO REVELADO")).toBeInTheDocument();
      expect(unshorten).toHaveBeenLastCalledWith("https://www.example.com/pagina?x=1", expect.any(AbortSignal));
      expect(screen.queryByText(/passa por uma página de anúncio/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /analisar com a lumi/i })).toBeInTheDocument();
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
    scan.mockRejectedValue(new tools.ToolsError(503, "SCAN_NOT_CONFIGURED", "A análise de segurança não está configurada."));
    render(<RevealDestinationPanel />);
    await reveal();
    await userEvent.click(await screen.findByRole("button", { name: /analisar com a lumi/i }));
    expect(await screen.findByText(/não está configurada/i)).toBeInTheDocument();
  });
});
