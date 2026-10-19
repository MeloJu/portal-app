import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent } from "react";

type Props = {
  title: string;
  description: string;
  destination?: string;
  length?: number;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onClose: () => void;
  resendCooldownSeconds?: number;
  submitLabel?: string;
};

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const maskEmail = (email: string) => {
  const at = email.indexOf("@");
  if (at < 1) return email;
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export default function CodeModal({
  title,
  description,
  destination,
  length = 6,
  onSubmit,
  onResend,
  onClose,
  resendCooldownSeconds = 60,
  submitLabel = "Confirmar",
}: Props) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const dialogRef = useRef<HTMLElement>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(resendCooldownSeconds);

  const code = digits.join("");
  const complete = code.length === length;

  const focusInput = useCallback((index: number) => {
    const input = inputRefs.current[index];
    input?.focus();
    input?.select();
  }, []);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRefs.current[0]?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleChange = (index: number, value: string) => {
    if (value === "") {
      setDigits((current) => current.map((digit, i) => (i === index ? "" : digit)));
      return;
    }
    const typed = onlyDigits(value).slice(-1);
    if (!typed) return;
    setDigits((current) => current.map((digit, i) => (i === index ? typed : digit)));
    setError(null);
    if (index < length - 1) focusInput(index + 1);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = onlyDigits(event.clipboardData.getData("text")).slice(0, length);
    if (!pasted) return;
    const next = Array(length).fill("") as string[];
    pasted.split("").forEach((char, position) => {
      next[position] = char;
    });
    setDigits(next);
    setError(null);
    focusInput(pasted.length - 1);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && digits[index] === "" && index > 0) {
      event.preventDefault();
      setDigits((current) => current.map((digit, i) => (i === index - 1 ? "" : digit)));
      focusInput(index - 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  };

  const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!complete || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await onSubmit(code);
    } catch (failure) {
      setError(errorMessage(failure, "Não foi possível confirmar o código. Tente novamente."));
      setDigits(Array(length).fill(""));
      focusInput(0);
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await onResend();
      setCooldown(resendCooldownSeconds);
      setNotice("Código reenviado");
    } catch (failure) {
      setError(errorMessage(failure, "Não foi possível reenviar o código. Tente novamente."));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="portal-detail-backdrop" onClick={onClose}>
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="portal-detail code-modal"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapFocus}
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <div>
            <span>CÓDIGO DE VERIFICAÇÃO</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button aria-label="Fechar" onClick={onClose} type="button">
            ×
          </button>
        </header>

        <p className="code-modal-description" id={descriptionId}>
          {description}
          {destination && (
            <>
              {" "}
              <strong>{maskEmail(destination)}</strong>
            </>
          )}
        </p>

        <form onSubmit={submit}>
          <div aria-label="Código de verificação" className="code-modal-inputs" role="group">
            {digits.map((digit, index) => (
              <input
                aria-label={`Dígito ${index + 1} de ${length}`}
                autoComplete={index === 0 ? "one-time-code" : "off"}
                inputMode="numeric"
                key={index}
                maxLength={1}
                onChange={(event) => handleChange(index, event.target.value)}
                onFocus={(event) => event.target.select()}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                readOnly={submitting}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                type="text"
                value={digit}
              />
            ))}
          </div>

          {error && (
            <p className="code-modal-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="code-modal-notice" role="status">
              {notice}
            </p>
          )}

          <button className="code-modal-submit" disabled={!complete || submitting} type="submit">
            {submitting ? "Confirmando..." : submitLabel}
          </button>
        </form>

        <button className="code-modal-resend" disabled={cooldown > 0 || resending} onClick={resend} type="button">
          {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
        </button>
      </section>
    </div>
  );
}
