import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CodeModal from "./CodeModal";

const digitInput = (position: number) => screen.getByLabelText(`Dígito ${position} de 6`) as HTMLInputElement;
const filledCode = () => Array.from({ length: 6 }, (_, i) => digitInput(i + 1).value).join("");

function setup(overrides: Partial<React.ComponentProps<typeof CodeModal>> = {}) {
  const props = {
    title: "Confirme seu e-mail",
    description: "Enviamos um código para",
    destination: "maria@exemplo.com",
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onResend: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<CodeModal {...props} />);
  return props;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("CodeModal", () => {
  it("expõe um diálogo acessível com foco inicial no primeiro dígito", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Confirme seu e-mail" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/Enviamos um código para/);
    expect(digitInput(1)).toHaveFocus();
    expect(digitInput(1)).toHaveAttribute("autocomplete", "one-time-code");
    expect(screen.getByText("ma***@exemplo.com")).toBeInTheDocument();
  });

  it("avança o foco ao digitar e volta com Backspace", async () => {
    setup();
    await userEvent.keyboard("12");
    expect(digitInput(3)).toHaveFocus();
    await userEvent.keyboard("{Backspace}");
    expect(digitInput(2)).toHaveFocus();
    expect(digitInput(2)).toHaveValue("");
    expect(digitInput(1)).toHaveValue("1");
  });

  it("aceita só números", async () => {
    setup();
    await userEvent.keyboard("a1-b2");
    expect(filledCode()).toBe("12");
    expect(digitInput(3)).toHaveFocus();
  });

  it.each(["123 456", "123-456", " 12 3-45 6 "])("preenche tudo ao colar %j", async (pasted) => {
    setup();
    await userEvent.click(digitInput(4));
    await userEvent.paste(pasted);
    expect(filledCode()).toBe("123456");
    expect(digitInput(6)).toHaveFocus();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
  });

  it("navega com as setas", async () => {
    setup();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(digitInput(3)).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(digitInput(2)).toHaveFocus();
  });

  it("habilita confirmar só com o código completo e envia com Enter", async () => {
    const { onSubmit } = setup();
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    await userEvent.keyboard("12345");
    expect(confirm).toBeDisabled();
    await userEvent.keyboard("6");
    expect(confirm).toBeEnabled();
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("123456");
  });

  it("mostra Confirmando... durante o envio", async () => {
    let finish: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    setup({ onSubmit });
    await userEvent.paste("123456");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByRole("button", { name: "Confirmando..." })).toBeDisabled();
    await act(async () => finish());
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it("mostra o erro, limpa os campos e foca o primeiro", async () => {
    setup({ onSubmit: vi.fn().mockRejectedValue(new Error("Código inválido ou expirado.")) });
    await userEvent.click(digitInput(1));
    await userEvent.paste("123456");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Código inválido ou expirado.");
    expect(filledCode()).toBe("");
    expect(digitInput(1)).toHaveFocus();
  });

  it("conta o cooldown e reenvia o código", async () => {
    vi.useFakeTimers();
    const { onResend } = setup({ resendCooldownSeconds: 3 });
    const resend = () => screen.getByRole("button", { name: /reenviar/i });
    expect(resend()).toBeDisabled();
    expect(resend()).toHaveTextContent("Reenviar em 3s");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(resend()).toHaveTextContent("Reenviar em 2s");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(resend()).toBeEnabled();
    expect(resend()).toHaveTextContent("Reenviar código");

    await act(async () => {
      fireEvent.click(resend());
    });
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Código reenviado");
    expect(resend()).toBeDisabled();
    expect(resend()).toHaveTextContent("Reenviar em 3s");
  });

  it("fecha com Esc e com o botão", async () => {
    const { onClose } = setup();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("mantém o foco preso dentro do modal", async () => {
    setup();
    const close = screen.getByRole("button", { name: "Fechar" });
    const lastInput = digitInput(6);
    lastInput.focus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(lastInput).toHaveFocus();
  });

  it("devolve o foco a quem abriu o modal", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const props = {
      title: "t",
      description: "d",
      onSubmit: vi.fn(),
      onResend: vi.fn(),
      onClose: vi.fn(),
    };
    const { unmount } = render(<CodeModal {...props} />);
    expect(digitInput(1)).toHaveFocus();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
