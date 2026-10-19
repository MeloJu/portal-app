import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as auth from "../../api/auth";
import UnverifiedBanner from "./UnverifiedBanner";

vi.mock("../../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/auth")>()),
  resendVerification: vi.fn(),
}));
const resendVerification = vi.mocked(auth.resendVerification);

function setup() {
  const onRevalidate = vi.fn();
  render(<UnverifiedBanner email="ana@lumi.dev" onRevalidate={onRevalidate} />);
  return { onRevalidate };
}

const resendButton = () => screen.getByRole("button", { name: /reenviar e-mail/i });
const click = (button: HTMLElement) => act(async () => fireEvent.click(button));

describe("UnverifiedBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resendVerification.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("explica o que fazer e para qual e-mail o link foi enviado", () => {
    setup();
    expect(
      screen.getByText(
        "Confirme seu e-mail para criar portais. Enviamos um link para ana@lumi.dev. Se ele expirou, peça outro.",
      ),
    ).toBeInTheDocument();
    expect(resendButton()).toBeEnabled();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("reenvia, avisa no status e segura o botão por 60 segundos", async () => {
    resendVerification.mockResolvedValue();
    setup();
    await click(resendButton());

    expect(resendVerification).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("E-mail reenviado");
    expect(resendButton()).toBeDisabled();
    expect(resendButton()).toHaveTextContent("60s");

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(resendButton()).toHaveTextContent("30s");
    expect(resendButton()).toBeDisabled();

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(resendButton()).toBeEnabled();
    expect(resendButton()).not.toHaveTextContent("s)");
  });

  it("429 usa o Retry-After devolvido como cooldown e mostra o erro em alert", async () => {
    resendVerification.mockRejectedValue(new auth.AuthError(429, "RATE_LIMIT", "x", 90));
    setup();
    await click(resendButton());

    expect(screen.getByRole("alert")).toHaveTextContent(/aguarde/i);
    expect(resendButton()).toBeDisabled();
    expect(resendButton()).toHaveTextContent("90s");
    expect(screen.getByRole("status")).not.toHaveTextContent("E-mail reenviado");
  });

  it("429 sem Retry-After cai no cooldown de 60 segundos", async () => {
    resendVerification.mockRejectedValue(new auth.AuthError(429, "RATE_LIMIT", "x"));
    setup();
    await click(resendButton());
    expect(resendButton()).toHaveTextContent("60s");
  });

  it("409 ALREADY_VERIFIED revalida o usuário sem mostrar erro", async () => {
    resendVerification.mockRejectedValue(new auth.AuthError(409, "ALREADY_VERIFIED", "x"));
    const { onRevalidate } = setup();
    await click(resendButton());

    expect(onRevalidate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("401 no reenvio revalida para o loader mandar ao login, sem mostrar erro", async () => {
    resendVerification.mockRejectedValue(new auth.AuthError(401, "UNAUTHORIZED", "Sessão expirada"));
    const { onRevalidate } = setup();
    await click(resendButton());

    expect(onRevalidate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("depois do reenvio fala do novo link com a validade de 30 minutos", async () => {
    resendVerification.mockResolvedValue();
    setup();
    expect(screen.queryByText(/30 minutos/)).not.toBeInTheDocument();
    await click(resendButton());
    expect(screen.getByRole("status")).toHaveTextContent("Enviamos um novo link, válido por 30 minutos");
  });

  it("outro erro aparece em alert e não trava o botão", async () => {
    resendVerification.mockRejectedValue(new auth.AuthError(500, "INTERNAL_ERROR", "Falha ao enviar"));
    setup();
    await click(resendButton());
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao enviar");
    expect(resendButton()).toBeEnabled();
  });

  it("Já verifiquei revalida o usuário", async () => {
    const { onRevalidate } = setup();
    await click(screen.getByRole("button", { name: /já verifiquei/i }));
    expect(onRevalidate).toHaveBeenCalledTimes(1);
    expect(resendVerification).not.toHaveBeenCalled();
  });
});
