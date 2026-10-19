import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  changePassword,
  describeAccountError,
  isCodeAttemptsExceeded,
  isCodeExpired,
  isCodeInvalid,
  isRateLimited,
  isWrongPassword,
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  passwordByteLength,
  requestCode,
} from "../../api/account";
import { UNVERIFIED_ACCOUNT_MESSAGE } from "./ChangeEmailFlow";
import CodeModal from "./CodeModal";

type Props = {
  currentEmail: string;
  disabled?: boolean;
  onChanged: () => void;
};

const staysInsideModal = (error: unknown) =>
  isCodeInvalid(error) || isCodeExpired(error) || isCodeAttemptsExceeded(error) || isRateLimited(error);

function validateNewPassword(current: string, next: string, confirmation: string): string | null {
  if (!current || !next || !confirmation) return "Preencha a senha atual, a nova senha e a confirmação.";
  if (next.length < MIN_PASSWORD_LENGTH)
    return `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (passwordByteLength(next) > MAX_PASSWORD_BYTES) {
    return `A nova senha pode ter no máximo ${MAX_PASSWORD_BYTES} bytes (caracteres acentuados ocupam mais de um).`;
  }
  if (next !== confirmation) return "A confirmação não é igual à nova senha.";
  if (next === current) return "A nova senha precisa ser diferente da atual.";
  return null;
}

export default function ChangePasswordFlow({ currentEmail, disabled = false, onChanged }: Props) {
  const currentRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [done, setDone] = useState(false);
  const [focusPasswordTick, setFocusPasswordTick] = useState(0);

  useEffect(() => {
    if (focusPasswordTick > 0) currentRef.current?.focus();
  }, [focusPasswordTick]);

  const reset = () => {
    setOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
    setFormError(null);
    setPasswordError(null);
    setCodeSent(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (requesting) return;
    setDone(false);
    setPasswordError(null);
    const problem = validateNewPassword(currentPassword, newPassword, confirmation);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    if (codeSent) {
      setModalOpen(true);
      return;
    }
    setRequesting(true);
    try {
      await requestCode({ purpose: "PASSWORD_CHANGE" });
      setCodeSent(true);
      setModalOpen(true);
    } catch (failure) {
      setFormError(describeAccountError(failure));
    } finally {
      setRequesting(false);
    }
  };

  const confirmCode = async (code: string) => {
    try {
      await changePassword({ code, currentPassword, newPassword });
    } catch (failure) {
      if (isWrongPassword(failure)) {
        setModalOpen(false);
        setPasswordError(describeAccountError(failure));
        setFocusPasswordTick((tick) => tick + 1);
        return;
      }
      if (staysInsideModal(failure)) throw new Error(describeAccountError(failure));
      setModalOpen(false);
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
      await requestCode({ purpose: "PASSWORD_CHANGE" });
    } catch (failure) {
      throw new Error(describeAccountError(failure));
    }
  };

  return (
    <div className="account-flow">
      {disabled && <p className="account-flow-hint">{UNVERIFIED_ACCOUNT_MESSAGE}</p>}
      {done && (
        <p className="account-flow-success" role="status">
          Senha alterada com sucesso
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
          Trocar senha
        </button>
      )}
      {open && !disabled && (
        <form className="account-flow-form" noValidate onSubmit={submit}>
          <label>
            <span>Senha atual</span>
            <input
              aria-invalid={passwordError ? true : undefined}
              autoComplete="current-password"
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setPasswordError(null);
              }}
              ref={currentRef}
              type="password"
              value={currentPassword}
            />
          </label>
          {passwordError && (
            <p className="account-flow-error" role="alert">
              {passwordError}
            </p>
          )}
          <label>
            <span>Nova senha</span>
            <input
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              value={newPassword}
            />
          </label>
          <label>
            <span>Confirme a nova senha</span>
            <input
              autoComplete="new-password"
              onChange={(event) => setConfirmation(event.target.value)}
              type="password"
              value={confirmation}
            />
          </label>
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
          destination={currentEmail}
          onClose={() => setModalOpen(false)}
          onResend={resend}
          onSubmit={confirmCode}
          submitLabel="Trocar senha"
          title="Confirme a troca de senha"
        />
      )}
    </div>
  );
}
