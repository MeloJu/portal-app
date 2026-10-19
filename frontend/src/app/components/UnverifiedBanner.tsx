import { useEffect, useState } from "react";
import { AuthError, resendVerification } from "../../api/auth";

const DEFAULT_COOLDOWN_SECONDS = 60;

type Props = {
  email: string;
  onRevalidate: () => void;
};

export default function UnverifiedBanner({ email, onRevalidate }: Props) {
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const coolingDown = cooldown > 0;

  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [coolingDown]);

  async function resend() {
    setSending(true);
    setError("");
    setSent(false);
    try {
      await resendVerification();
      setSent(true);
      setCooldown(DEFAULT_COOLDOWN_SECONDS);
    } catch (err) {
      if (err instanceof AuthError && (err.isEmailAlreadyVerified || err.status === 401)) {
        onRevalidate();
      } else if (err instanceof AuthError && err.isRateLimited) {
        setCooldown(err.retryAfterSeconds ?? DEFAULT_COOLDOWN_SECONDS);
        setError("Muitos pedidos de reenvio. Aguarde um pouco para tentar de novo.");
      } else {
        setError(err instanceof AuthError ? err.message : "Algo deu errado. Tente novamente.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="unverified-banner" aria-label="Confirmação de e-mail">
      <p>Confirme seu e-mail para criar portais. Enviamos um link para {email}. Se ele expirou, peça outro.</p>
      <div className="unverified-banner-actions">
        <button disabled={sending || coolingDown} onClick={resend} type="button">
          {coolingDown ? `Reenviar e-mail (${cooldown}s)` : "Reenviar e-mail"}
        </button>
        <button onClick={onRevalidate} type="button">
          Já verifiquei
        </button>
      </div>
      <p className="unverified-banner-feedback" role="status" aria-live="polite">
        {sent ? "E-mail reenviado. Enviamos um novo link, válido por 30 minutos." : ""}
      </p>
      {error && (
        <p className="unverified-banner-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
