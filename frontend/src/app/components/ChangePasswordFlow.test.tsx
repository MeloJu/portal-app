import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChangePasswordFlow from "./ChangePasswordFlow";

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

const reply = ({ status, body, headers }: Reply) =>
  new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status, headers });

const user = { id: "u1", name: "Ana", email: "ana@lumi.dev", emailVerified: true };

function stubApi(routes: { codes?: Reply[]; password?: Reply[] }) {
  const queues = {
    "/api/account/codes": [...(routes.codes ?? [])],
    "/api/account/password": [...(routes.password ?? [])],
  };
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

function setup(props: Partial<React.ComponentProps<typeof ChangePasswordFlow>> = {}) {
  const onChanged = vi.fn();
  render(<ChangePasswordFlow currentEmail={user.email} onChanged={onChanged} {...props} />);
  return { onChanged };
}

async function fillAndSend(current = "senhaatual1", next = "novasenha123", confirmation = next) {
  await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }));
  await userEvent.type(screen.getByLabelText("Senha atual"), current);
  await userEvent.type(screen.getByLabelText("Nova senha"), next);
  await userEvent.type(screen.getByLabelText("Confirme a nova senha"), confirmation);
  await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
}

async function typeCodeAndConfirm(code = "654321") {
  const dialog = await screen.findByRole("dialog");
  await userEvent.keyboard(code);
  await userEvent.click(within(dialog).getByRole("button", { name: "Trocar senha" }));
  return dialog;
}

describe("ChangePasswordFlow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fluxo feliz: pede o código ao e-mail atual, confirma e avisa o dashboard", async () => {
    const fetchMock = stubApi({ codes: [{ status: 204 }], password: [{ status: 200, body: user }] });
    const { onChanged } = setup();
    await fillAndSend();

    expect(bodyOf(fetchMock.mock.calls[0]!)).toEqual({ purpose: "PASSWORD_CHANGE" });
    expect(await screen.findByText("an***@lumi.dev")).toBeInTheDocument();
    await typeCodeAndConfirm();

    expect(await screen.findByRole("status")).toHaveTextContent("Senha alterada com sucesso");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/account/codes", "/api/account/password"]);
    expect(bodyOf(fetchMock.mock.calls[1]!)).toEqual({
      code: "654321",
      currentPassword: "senhaatual1",
      newPassword: "novasenha123",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["CODE_INVALID", 400, "Código incorreto"],
    ["CODE_EXPIRED", 400, "Código expirado, peça outro"],
    ["CODE_ATTEMPTS_EXCEEDED", 429, "Muitas tentativas, peça um novo código"],
  ])("%s mantém o modal aberto com a mensagem certa", async (code, status, message) => {
    stubApi({ codes: [{ status: 204 }], password: [{ status, body: { code, message: "técnica" } }] });
    const { onChanged } = setup();
    await fillAndSend();
    const dialog = await typeCodeAndConfirm();

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(message);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("senha atual errada fecha o modal, destaca o campo e reaproveita o código", async () => {
    const fetchMock = stubApi({
      codes: [{ status: 204 }],
      password: [
        { status: 403, body: { code: "WRONG_PASSWORD" } },
        { status: 200, body: user },
      ],
    });
    const { onChanged } = setup();
    await fillAndSend();
    await typeCodeAndConfirm();

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Senha atual incorreta");
    const current = screen.getByLabelText("Senha atual");
    expect(current).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(current).toHaveFocus());

    await userEvent.clear(current);
    await userEvent.type(current, "senhacerta1");
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    await typeCodeAndConfirm();

    expect(await screen.findByRole("status")).toHaveTextContent("Senha alterada com sucesso");
    expect(callsTo(fetchMock, "/api/account/codes")).toHaveLength(1);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("429 ao pedir o código mostra o tempo do Retry-After", async () => {
    stubApi({ codes: [{ status: 429, body: { code: "RATE_LIMIT" }, headers: { "Retry-After": "30" } }] });
    setup();
    await fillAndSend();
    expect(await screen.findByRole("alert")).toHaveTextContent("Tente de novo em 30 segundos");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("e-mail não confirmado vindo do back aparece no formulário", async () => {
    stubApi({ codes: [{ status: 403, body: { code: "EMAIL_NOT_VERIFIED" } }] });
    setup();
    await fillAndSend();
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirme seu e-mail para alterar estes dados");
  });

  it("valida no front: curta, longa demais em bytes, confirmação e igual à atual", async () => {
    const fetchMock = stubApi({});
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }));
    const submit = () => userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Preencha a senha atual");

    set("Senha atual", "senhaatual1");
    set("Nova senha", "curta");
    set("Confirme a nova senha", "curta");
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("pelo menos 8 caracteres");

    const accented = "é".repeat(40);
    expect(accented.length).toBe(40);
    set("Nova senha", accented);
    set("Confirme a nova senha", accented);
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("no máximo 72 bytes");

    set("Nova senha", "novasenha123");
    set("Confirme a nova senha", "outra-coisa-123");
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("A confirmação não é igual");

    set("Nova senha", "senhaatual1");
    set("Confirme a nova senha", "senhaatual1");
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("diferente da atual");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aceita senha de exatamente 72 bytes", async () => {
    const fetchMock = stubApi({ codes: [{ status: 204 }] });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }));
    const exact = "é".repeat(36);
    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "senhaatual1" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: exact } });
    fireEvent.change(screen.getByLabelText("Confirme a nova senha"), { target: { value: exact } });
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByRole("dialog");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reenviar chama o pedido de código de novo", async () => {
    vi.useFakeTimers();
    const fetchMock = stubApi({ codes: [{ status: 204 }, { status: 204 }] });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Trocar senha" }));
    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "senhaatual1" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "novasenha123" } });
    fireEvent.change(screen.getByLabelText("Confirme a nova senha"), { target: { value: "novasenha123" } });
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
    expect(screen.getByText("Código reenviado")).toBeInTheDocument();
  });

  it("desabilitado quando o e-mail não está confirmado", () => {
    setup({ disabled: true });
    expect(screen.getByRole("button", { name: "Trocar senha" })).toBeDisabled();
    expect(screen.getByText("Confirme seu e-mail para alterar estes dados")).toBeInTheDocument();
  });
});
