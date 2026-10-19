import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as dashboard from "../api/dashboard";
import Dashboard from "./Dashboard";

vi.mock("../api/dashboard", () => ({ getOverview: vi.fn() }));
vi.mocked(dashboard.getOverview).mockResolvedValue({
  summary: { activeLinks: 0, totalTravels: 0, travelsChangePct: 0, blockedThreats: 0 },
  travels: [],
  topLinks: [],
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let currentUser: { id: string; name: string; email: string; emailVerified: boolean; hasPassword: boolean };
let loaderCalls: number;

function renderSettings() {
  const router = createMemoryRouter(
    [
      {
        id: "dashboard",
        path: "/dashboard",
        loader: () => {
          loaderCalls += 1;
          return { ...currentUser };
        },
        Component: Dashboard,
      },
    ],
    { initialEntries: ["/dashboard"] },
  );
  render(<RouterProvider router={router} />);
}

async function openSettings() {
  await userEvent.click(
    within(await screen.findByRole("navigation", { name: /navegação principal/i })).getByRole("button", {
      name: /configurações/i,
    }),
  );
}

describe("Dashboard > Configurações", () => {
  beforeEach(() => {
    loaderCalls = 0;
    currentUser = { id: "u1", name: "Ana Martins", email: "ana@lumi.dev", emailVerified: true, hasPassword: true };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/account/codes") return Promise.resolve(new Response(null, { status: 204 }));
        if (url === "/api/account/email") {
          currentUser = { ...currentUser, email: "novo@lumi.dev" };
          return Promise.resolve(json(currentUser));
        }
        if (url === "/api/account/password") return Promise.resolve(json(currentUser));
        if (url.startsWith("/api/protection/summary")) {
          return Promise.resolve(json({ blockedThreats: 0, verifiedDestinations: 0, byReason: {} }));
        }
        if (url.startsWith("/api/protection/events")) return Promise.resolve(json([]));
        return Promise.resolve(json({ items: [], page: 0, totalItems: 0 }));
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("o e-mail vira somente leitura e ganha o botão Trocar e-mail", async () => {
    renderSettings();
    await openSettings();
    const email = screen.getByDisplayValue("ana@lumi.dev");
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Trocar e-mail" })).toBeEnabled();
  });

  it("Segurança mostra o painel com Trocar senha", async () => {
    renderSettings();
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: /segurança/i }));
    expect(screen.getByRole("heading", { name: "Senha de acesso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar senha" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Trocar e-mail" })).not.toBeInTheDocument();
  });

  it("conta sem senha esconde Trocar senha e Trocar e-mail com texto explicativo", async () => {
    currentUser = { ...currentUser, hasPassword: false };
    renderSettings();
    await openSettings();
    expect(screen.queryByRole("button", { name: "Trocar e-mail" })).not.toBeInTheDocument();
    expect(screen.getByText(/contas com Google ou GitHub não têm/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /segurança/i }));
    expect(screen.queryByRole("button", { name: "Trocar senha" })).not.toBeInTheDocument();
    expect(screen.getByText(/não tem senha para trocar/i)).toBeInTheDocument();
  });

  it("conta não verificada desabilita as duas trocas com o aviso", async () => {
    currentUser = { ...currentUser, emailVerified: false };
    renderSettings();
    await openSettings();
    expect(screen.getByRole("button", { name: "Trocar e-mail" })).toBeDisabled();
    expect(screen.getByText("Confirme seu e-mail para alterar estes dados")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /segurança/i }));
    expect(screen.getByRole("button", { name: "Trocar senha" })).toBeDisabled();
    expect(screen.getByText("Confirme seu e-mail para alterar estes dados")).toBeInTheDocument();
  });

  it("trocar o e-mail revalida o usuário e mostra o endereço novo", async () => {
    renderSettings();
    await openSettings();
    const loadsBefore = loaderCalls;
    await userEvent.click(screen.getByRole("button", { name: "Trocar e-mail" }));
    await userEvent.type(screen.getByLabelText("Novo e-mail"), "novo@lumi.dev");
    await userEvent.type(screen.getByLabelText("Senha atual"), "senhaatual1");
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.keyboard("123456");
    await userEvent.click(within(dialog).getByRole("button", { name: "Trocar e-mail" }));

    expect(await screen.findByText("E-mail alterado com sucesso")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByDisplayValue("novo@lumi.dev")).toBeInTheDocument());
    expect(loaderCalls).toBeGreaterThan(loadsBefore);
  });

  it("trocar a senha revalida o usuário", async () => {
    renderSettings();
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: /segurança/i }));
    const loadsBefore = loaderCalls;
    await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }));
    await userEvent.type(screen.getByLabelText("Senha atual"), "senhaatual1");
    await userEvent.type(screen.getByLabelText("Nova senha"), "novasenha123");
    await userEvent.type(screen.getByLabelText("Confirme a nova senha"), "novasenha123");
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.keyboard("123456");
    await userEvent.click(within(dialog).getByRole("button", { name: "Trocar senha" }));

    expect(await screen.findByText("Senha alterada com sucesso")).toBeInTheDocument();
    await waitFor(() => expect(loaderCalls).toBeGreaterThan(loadsBefore));
  });
});
