import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/links";
import CreatePortalForm from "./CreatePortalForm";

vi.mock("../../api/links", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/links")>()),
  createLink: vi.fn(),
}));
const createLink = vi.mocked(api.createLink);

const link: api.Link = {
  code: "meu-link",
  shortUrl: "https://lumi.example/meu-link",
  targetUrl: "https://exemplo.com/muito/longo",
  title: null,
  state: "ACTIVE",
  travelCount: 0,
  expiresAt: null,
  maxTravels: null,
  createdAt: "2026-10-16T12:00:00Z",
};

async function fill(url: string, alias = "") {
  if (url) await userEvent.type(screen.getByPlaceholderText(/cole seu link longo/i), url);
  if (alias) await userEvent.type(screen.getByPlaceholderText("personalizar"), alias);
  await userEvent.click(screen.getByRole("button", { name: /criar portal/i }));
}

describe("CreatePortalForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria o portal na API com o alias normalizado e mostra a shortUrl", async () => {
    createLink.mockResolvedValue(link);
    render(<CreatePortalForm minOpeningMs={0} />);
    await fill("https://exemplo.com/muito/longo", "Meu Link");
    expect(createLink).toHaveBeenCalledWith("https://exemplo.com/muito/longo", "meu-link");
    expect(await screen.findByText("lumi.example/meu-link")).toBeInTheDocument();
  });

  it.each([
    ["Promoção de Verão", "promocao-de-verao"],
    ["  --Café!!  ", "cafe"],
    ["a  b", "a-b"],
  ])("normaliza o alias %j para %j", async (typed, alias) => {
    createLink.mockResolvedValue(link);
    render(<CreatePortalForm minOpeningMs={0} />);
    await fill("exemplo.com", typed);
    expect(createLink).toHaveBeenCalledWith("exemplo.com", alias);
  });

  it("alias que vira vazio ou curto depois de normalizar é barrado", async () => {
    render(<CreatePortalForm minOpeningMs={0} />);
    await fill("exemplo.com", "çã");
    expect(createLink).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/de 3 a 32/i);
    await userEvent.clear(screen.getByPlaceholderText("personalizar"));
    await fill("", "!!!");
    expect(createLink).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/de 3 a 32/i);
  });

  it("sem alias deixa a API gerar o código", async () => {
    createLink.mockResolvedValue(link);
    render(<CreatePortalForm minOpeningMs={0} />);
    await fill("exemplo.com");
    expect(createLink).toHaveBeenCalledWith("exemplo.com", null);
  });

  it("copiar usa a shortUrl da API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    createLink.mockResolvedValue(link);
    render(<CreatePortalForm minOpeningMs={0} />);
    await fill("https://exemplo.com/muito/longo");
    await userEvent.click(await screen.findByRole("button", { name: /copiar/i }));
    expect(writeText).toHaveBeenCalledWith("https://lumi.example/meu-link");
    expect(await screen.findByRole("button", { name: /copiado/i })).toBeInTheDocument();
  });

  it("visualizar abre a shortUrl", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    createLink.mockResolvedValue(link);
    render(<CreatePortalForm minOpeningMs={0} />);
    await fill("https://exemplo.com/muito/longo");
    await userEvent.click(await screen.findByRole("button", { name: /visualizar/i }));
    expect(open).toHaveBeenCalledWith("https://lumi.example/meu-link", "_blank", "noopener,noreferrer");
    open.mockRestore();
  });

  it("não chama a API sem URL", async () => {
    render(<CreatePortalForm minOpeningMs={0} />);
    await fill("");
    expect(createLink).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("barra alias curto antes da API", async () => {
    render(<CreatePortalForm minOpeningMs={0} />);
    await fill("exemplo.com", "ab");
    expect(createLink).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/de 3 a 32/i);
  });

  it.each([
    [400, "INVALID_URL", "Só aceitamos endereços http ou https"],
    [400, "SELF_LOOP", "O destino não pode apontar para a própria Lumi"],
    [400, "RESERVED_ALIAS", "Esse nome de portal é reservado"],
    [409, "ALIAS_TAKEN", "Esse nome de portal já foi pego"],
  ])("mostra o erro %i %s na tela", async (status, code, message) => {
    createLink.mockRejectedValue(new api.LinkError(status, code, message));
    render(<CreatePortalForm minOpeningMs={0} />);
    await fill("exemplo.com", "meu-link");
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(/portal aberto com sucesso/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar portal/i })).toBeEnabled();
  });

  it("limpa o erro ao criar com sucesso depois", async () => {
    createLink.mockRejectedValueOnce(new api.LinkError(409, "ALIAS_TAKEN", "Esse nome de portal já foi pego"));
    createLink.mockResolvedValueOnce(link);
    render(<CreatePortalForm minOpeningMs={0} />);
    await fill("exemplo.com", "meu-link");
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: /criar portal/i }));
    expect(await screen.findByText(/portal aberto com sucesso/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
