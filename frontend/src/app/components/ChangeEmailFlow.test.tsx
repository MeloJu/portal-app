import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChangeEmailFlow from "./ChangeEmailFlow";

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

const reply = ({ status, body, headers }: Reply) =>
  new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status, headers });

const user = { id: "u1", name: "Ana", email: "ana@lumi.dev", emailVerified: true };

function stubApi(routes: { codes?: Reply[]; email?: Reply[] }) {
  const queues = { "/api/account/codes": [...(routes.codes ?? [])], "/api/account/email": [...(routes.email ?? [])] };
  const fetchMock = vi.fn((path: string) => {
    const next = queues[path as keyof typeof queues]?.shift();
    return Promise.resolve(reply(next ?? { status: 500, body: { code: "UNEXPECTED" } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof stubApi>, path: string) =>
  fetchMock.mock.calls.filter(([url]) => url === path);

const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

function setup(props: Partial<React.ComponentProps<typeof ChangeEmailFlow>> = {}) {
  const onChanged = vi.fn();
  render(<ChangeEmailFlow currentEmail={user.email} onChanged={onChanged} {...props} />);
  return { onChanged };
}

async function fillAndSend(newEmail = "novo@lumi.dev", password = "senhaatual1") {
  await userEvent.click(screen.getByRole("button", { name: "Trocar e-mail" }));
  await userEvent.type(screen.getByLabelText("Novo e-mail"), newEmail);
  await userEvent.type(screen.getByLabelText("Senha atual"), password);
  await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
}

async function typeCodeAndConfirm(code = "123456") {
  const dialog = await screen.findByRole("dialog");
  await userEvent.keyboard(code);
  await userEvent.click(within(dialog).getByRole("button", { name: "Trocar e-mail" }));
  return dialog;
}

describe("ChangeEmailFlow", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fluxo feliz: pede o código, confirma e avisa o dashboard", async () => {
    const fetchMock = stubApi({
      codes: [{ status: 204 }],
      email: [{ status: 200, body: { ...user, email: "novo@lumi.dev" } }],
    });
    const { onChanged } = setup();
    await fillAndSend();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/account/codes"]);
    expect(bodyOf(fetchMock.mock.calls[0]!)).toEqual({ purpose: "EMAIL_CHANGE", newEmail: "novo@lumi.dev" });
    expect(await screen.findByText("no***@lumi.dev")).toBeInTheDocument();

    await typeCodeAndConfirm();

    expect(await screen.findByRole("status")).toHaveTextContent("E-mail alterado com sucesso");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/account/codes", "/api/account/email"]);
    expect(bodyOf(fetchMock.mock.calls[1]!)).toEqual({
      newEmail: "novo@lumi.dev",
      code: "123456",
      currentPassword: "senhaatual1",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["CODE_INVALID", 400, "Código incorreto"],
    ["CODE_EXPIRED", 400, "Código expirado, peça outro"],
    ["CODE_ATTEMPTS_EXCEEDED", 429, "Muitas tentativas, peça um novo código"],
  ])("%s mantém o modal aberto com a mensagem certa", async (code, status, message) => {
    stubApi({ codes: [{ status: 204 }], email: [{ status, body: { code, message: "técnica" } }] });
    const { onChanged } = setup();
    await fillAndSend();
    const dialog = await typeCodeAndConfirm();

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("429 de limite na troca mostra o tempo de espera dentro do modal", async () => {
    stubApi({
      codes: [{ status: 204 }],
      email: [{ status: 429, body: { code: "RATE_LIMIT" }, headers: { "Retry-After": "45" } }],
    });
    setup();
    await fillAndSend();
    const dialog = await typeCodeAndConfirm();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Tente de novo em 45 segundos");
  });

  it("senha atual errada fecha o modal, destaca a senha e reaproveita o código", async () => {
    const fetchMock = stubApi({
      codes: [{ status: 204 }],
      email: [
        { status: 403, body: { code: "WRONG_PASSWORD" } },
        { status: 200, body: { ...user, email: "novo@lumi.dev" } },
      ],
    });
    const { onChanged } = setup();
    await fillAndSend();
    await typeCodeAndConfirm();

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Senha atual incorreta");
    const password = screen.getByLabelText("Senha atual");
    expect(password).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(password).toHaveFocus());
    expect(onChanged).not.toHaveBeenCalled();

    await userEvent.clear(password);
    await userEvent.type(password, "senhacerta1");
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    await typeCodeAndConfirm();

    expect(await screen.findByRole("status")).toHaveTextContent("E-mail alterado com sucesso");
    expect(callsTo(fetchMock, "/api/account/codes")).toHaveLength(1);
    expect(bodyOf(callsTo(fetchMock, "/api/account/email")[1]!).currentPassword).toBe("senhacerta1");
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("e-mail em uso ao pedir o código aparece no formulário e não abre o modal", async () => {
    stubApi({ codes: [{ status: 409, body: { code: "EMAIL_TAKEN" } }] });
    setup();
    await fillAndSend();
    expect(await screen.findByRole("alert")).toHaveTextContent("Este e-mail já está em uso");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("e-mail em uso ao confirmar fecha o modal e exige novo código depois", async () => {
    const fetchMock = stubApi({
      codes: [{ status: 204 }, { status: 204 }],
      email: [{ status: 409, body: { code: "EMAIL_TAKEN" } }],
    });
    setup();
    await fillAndSend();
    await typeCodeAndConfirm();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Este e-mail já está em uso");

    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByRole("dialog");
    expect(callsTo(fetchMock, "/api/account/codes")).toHaveLength(2);
  });

  it("429 ao pedir o código mostra o tempo do Retry-After", async () => {
    stubApi({ codes: [{ status: 429, body: { code: "RATE_LIMIT" }, headers: { "Retry-After": "120" } }] });
    setup();
    await fillAndSend();
    expect(await screen.findByRole("alert")).toHaveTextContent("Tente de novo em 2 minutos");
  });

  it("429 sem Retry-After usa texto genérico", async () => {
    stubApi({ codes: [{ status: 429, body: { code: "RATE_LIMIT" } }] });
    setup();
    await fillAndSend();
    expect(await screen.findByRole("alert")).toHaveTextContent("Tente de novo em instantes");
  });

  it("valida no front: e-mail igual ao atual, inválido e campos vazios", async () => {
    const fetchMock = stubApi({});
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Trocar e-mail" }));
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o novo e-mail e a senha atual");

    await userEvent.type(screen.getByLabelText("Senha atual"), "senhaatual1");
    await userEvent.type(screen.getByLabelText("Novo e-mail"), "invalido");
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um e-mail válido");

    await userEvent.clear(screen.getByLabelText("Novo e-mail"));
    await userEvent.type(screen.getByLabelText("Novo e-mail"), "ANA@lumi.dev");
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(screen.getByRole("alert")).toHaveTextContent("diferente do atual");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reenviar chama o pedido de código de novo", async () => {
    vi.useFakeTimers();
    const fetchMock = stubApi({ codes: [{ status: 204 }, { status: 204 }] });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Trocar e-mail" }));
    fireEvent.change(screen.getByLabelText("Novo e-mail"), { target: { value: "novo@lumi.dev" } });
    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "senhaatual1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    for (let second = 0; second < 60; second += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reenviar código" }));
    });

    expect(callsTo(fetchMock, "/api/account/codes")).toHaveLength(2);
    expect(bodyOf(callsTo(fetchMock, "/api/account/codes")[1]!)).toEqual({
      purpose: "EMAIL_CHANGE",
      newEmail: "novo@lumi.dev",
    });
    expect(screen.getByText("Código reenviado")).toBeInTheDocument();
  });

  it("desabilitado quando o e-mail não está confirmado", () => {
    setup({ disabled: true });
    expect(screen.getByRole("button", { name: "Trocar e-mail" })).toBeDisabled();
    expect(screen.getByText("Confirme seu e-mail para alterar estes dados")).toBeInTheDocument();
  });
});
