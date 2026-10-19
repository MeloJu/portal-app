import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  changeEmail,
  describeAccountError,
  isCodeAttemptsExceeded,
  isCodeExpired,
  isCodeInvalid,
  isRateLimited,
  isWrongPassword,
  requestCode,
} from "../../api/account";
import CodeModal from "./CodeModal";

export const UNVERIFIED_ACCOUNT_MESSAGE = "Confirme seu e-mail para alterar estes dados";

type Props = {
  currentEmail: string;
  disabled?: boolean;
  onChanged: () => void;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const staysInsideModal = (error: unknown) =>
  isCodeInvalid(error) || isCodeExpired(error) || isCodeAttemptsExceeded(error) || isRateLimited(error);

export default function ChangeEmailFlow({ currentEmail, disabled = false, onChanged }: Props) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [focusPasswordTick, setFocusPasswordTick] = useState(0);

  useEffect(() => {
    if (focusPasswordTick > 0) passwordRef.current?.focus();
  }, [focusPasswordTick]);

  const normalizedEmail = newEmail.trim().toLowerCase();

  const reset = () => {
    setOpen(false);
    setNewEmail("");
    setPassword("");
    setFormError(null);
    setPasswordError(null);
    setCodeSentTo(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (requesting) return;
    setDone(false);
    setPasswordError(null);
    if (!normalizedEmail || !password) {
      setFormError("Informe o novo e-mail e a senha atual.");
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setFormError("Informe um e-mail válido.");
      return;
    }
    if (normalizedEmail === currentEmail.toLowerCase()) {
      setFormError("O novo e-mail precisa ser diferente do atual.");
      return;
    }
    setFormError(null);
    if (codeSentTo === normalizedEmail) {
      setModalOpen(true);
      return;
    }
    setRequesting(true);
    try {
      await requestCode({ purpose: "EMAIL_CHANGE", newEmail: normalizedEmail });
      setCodeSentTo(normalizedEmail);
      setModalOpen(true);
    } catch (failure) {
      setFormError(describeAccountError(failure));
    } finally {
      setRequesting(false);
    }
  };

  const confirmCode = async (code: string) => {
    try {
      await changeEmail({ newEmail: normalizedEmail, code, currentPassword: password });
    } catch (failure) {
      if (isWrongPassword(failure)) {
        setModalOpen(false);
        setPasswordError(describeAccountError(failure));
        setFocusPasswordTick((tick) => tick + 1);
        return;
      }
      if (staysInsideModal(failure)) throw new Error(describeAccountError(failure));
      setModalOpen(false);
      setCodeSentTo(null);
      setFormError(describeAccountError(failure));
      return;
    }
    setModalOpen(false);
    reset();
    setDone(true);
    onChanged();
  };

  const resend = async () => {
    try {
      await requestCode({ purpose: "EMAIL_CHANGE", newEmail: normalizedEmail });
    } catch (failure) {
      throw new Error(describeAccountError(failure));
    }
  };

  return (
    <div className="account-flow">
      {disabled && <p className="account-flow-hint">{UNVERIFIED_ACCOUNT_MESSAGE}</p>}
      {done && (
        <p className="account-flow-success" role="status">
          E-mail alterado com sucesso
        </p>
      )}
      {!open && (
        <button
          className="account-flow-trigger"
          disabled={disabled}
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
          type="button"
        >
          Trocar e-mail
        </button>
      )}
      {open && !disabled && (
        <form className="account-flow-form" noValidate onSubmit={submit}>
          <label>
            <span>Novo e-mail</span>
            <input
              autoComplete="email"
              onChange={(event) => setNewEmail(event.target.value)}
              type="email"
              value={newEmail}
            />
          </label>
          <label>
            <span>Senha atual</span>
            <input
              aria-invalid={passwordError ? true : undefined}
              autoComplete="current-password"
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError(null);
              }}
              ref={passwordRef}
              type="password"
              value={password}
            />
          </label>
          {passwordError && (
            <p className="account-flow-error" role="alert">
              {passwordError}
            </p>
          )}
          {formError && (
            <p className="account-flow-error" role="alert">
              {formError}
            </p>
          )}
          <div className="account-flow-actions">
            <button className="account-flow-submit" disabled={requesting} type="submit">
              {requesting ? "Enviando código..." : "Enviar código"}
            </button>
            <button className="account-flow-cancel" onClick={reset} type="button">
              Cancelar
            </button>
          </div>
        </form>
      )}
      {modalOpen && (
        <CodeModal
          description="Enviamos um código de 6 dígitos para"
          destination={normalizedEmail}
          onClose={() => setModalOpen(false)}
          onResend={resend}
          onSubmit={confirmCode}
          submitLabel="Trocar e-mail"
          title="Confirme o novo e-mail"
        />
      )}
    </div>
  );
}
