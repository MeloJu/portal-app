import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/travel";
import TravelPage from "./TravelPage";

vi.mock("../../api/travel", () => ({ travel: vi.fn() }));
const travel = vi.mocked(api.travel);

function renderCode(code: string, strict = false) {
  const router = createMemoryRouter(
    [{ path: "/:code", loader: ({ params }) => api.travel(params.code!), Component: TravelPage }],
    { initialEntries: [`/${code}`] },
  );
  const tree = <RouterProvider router={router} />;
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

const ok = (targetUrl: string, title: string | null = "Campanha Nebulosa") =>
  ({ status: "ok", targetUrl, title, travelCount: 5 }) as const;

describe("TravelPage", () => {
  beforeEach(() => travel.mockReset());

  it("exibe o destino da API e exige confirmação para prosseguir", async () => {
    travel.mockResolvedValue(ok("https://www.example.com/campanha"));
    renderCode("nebulosa");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("example.com");
    expect(screen.getByText("Campanha Nebulosa")).toBeInTheDocument();
    expect(screen.getByText(/conexão https identificada/i)).toBeInTheDocument();
    const proceed = screen.getByRole("link", { name: /sim, prosseguir/i });
    expect(proceed).toHaveAttribute("href", "https://www.example.com/campanha");
    expect(proceed).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("button", { name: /não, voltar/i })).toBeInTheDocument();
  });

  it("avisa quando o destino é http, sem HTTPS", async () => {
    travel.mockResolvedValue(ok("http://example.com/x", null));
    renderCode("abc");
    expect(await screen.findByText(/sem https/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sim, prosseguir/i })).toHaveAttribute("href", "http://example.com/x");
  });

  it.each(["javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://example.com/a", "não é url"])(
    "não oferece link para destino fora de http/https: %s",
    async (target) => {
      travel.mockResolvedValue(ok(target));
      renderCode("abc");
      expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/não é seguro/i);
      expect(screen.queryByRole("link", { name: /prosseguir/i })).not.toBeInTheDocument();
      expect(document.querySelector("a[href^='javascript'], a[href^='data']")).toBeNull();
    },
  );

  it.each([
    [{ status: "not_found" }, /portal não existe/i],
    [{ status: "paused" }, /pausado/i],
    [{ status: "closed" }, /fechado/i],
    [{ status: "error" }, /não conseguimos/i],
  ] as const)("mostra a tela do estado %o", async (outcome, heading) => {
    travel.mockResolvedValue(outcome);
    renderCode("abc");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(heading);
    expect(screen.queryByRole("link", { name: /prosseguir/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /crie seus próprios portais/i })).toBeInTheDocument();
  });

  it("no 429 mostra quanto esperar", async () => {
    travel.mockResolvedValue({ status: "rate_limited", retryAfter: 42 });
    renderCode("abc");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/muitas viagens/i);
    expect(screen.getByText(/42 segundos/i)).toBeInTheDocument();
  });

  it("no 429 sem Retry-After pede para tentar de novo em instantes", async () => {
    travel.mockResolvedValue({ status: "rate_limited", retryAfter: null });
    renderCode("abc");
    expect(await screen.findByText(/em instantes/i)).toBeInTheDocument();
  });

  it("conta uma única Viagem mesmo no StrictMode", async () => {
    travel.mockResolvedValue(ok("https://example.com"));
    renderCode("abc", true);
    await screen.findByRole("link", { name: /sim, prosseguir/i });
    expect(travel).toHaveBeenCalledTimes(1);
  });
});
