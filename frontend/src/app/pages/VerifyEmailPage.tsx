import { useEffect, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { AuthError, resendVerification } from "../../api/auth";
import lumiLogo from "../../assets/lumi-logo-v2.png";

export type VerifyEmailStatus = "verified" | "expired" | "invalid";
export type VerifyEmailData = { status: VerifyEmailStatus; loggedIn: boolean };

const copy: Record<VerifyEmailStatus, { eyebrow: string; title: string; text: string }> = {
  verified: {
    eyebrow: "TUDO CERTO",
    title: "E-mail confirmado!",
    text: "Sua estação está liberada. É só embarcar.",
  },
  expired: {
    eyebrow: "LINK EXPIRADO",
    title: "Este link expirou",
    text: "Por segurança, o link de confirmação vale por pouco tempo. Peça outro para continuar.",
  },
  invalid: {
    eyebrow: "LINK INVÁLIDO",
    title: "Link inválido ou já usado",
    text: "Se você já confirmou, é só entrar.",
  },
};

function resendErrorMessage(err: unknown): string {
  if (err instanceof AuthError && err.code === "ALREADY_VERIFIED") return "Seu e-mail já está confirmado.";
  if (err instanceof AuthError && err.code === "RATE_LIMIT") {
    return "Você pediu links demais. Aguarde um pouco e tente de novo.";
  }
  if (err instanceof AuthError) return err.message;
  return "Algo deu errado. Tente novamente.";
}

function ResendLink() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function resend() {
    setError("");
    setSending(true);
    try {
      await resendVerification();
      setSent(true);
    } catch (err) {
      setError(resendErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {sent && (
        <p className="verify-email-notice" role="status">
          Enviamos um novo link para o seu e-mail.
        </p>
      )}
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
      <button className="login-submit" disabled={sending || sent} onClick={resend} type="button">
        {sending ? "Enviando..." : "Enviar novo link"}
      </button>
    </>
  );
}

export default function VerifyEmailPage() {
  const { status, loggedIn } = useLoaderData() as VerifyEmailData;
  const text = copy[status];
  const home = loggedIn ? "/dashboard" : "/login";

  useEffect(() => {
    window.history.replaceState(window.history.state, "", "/verificar-email");
  }, []);

  return (
    <main className="login-page verify-email-page">
      <meta name="referrer" content="no-referrer" />
      <section className="login-panel">
        <div className="login-box">
          <img className="login-logo" src={lumiLogo} alt="Lumi Links" />
          <div className="login-heading">
            <span>{text.eyebrow}</span>
            <h1>{text.title}</h1>
            <p>{text.text}</p>
          </div>
          <div className="verify-email-actions">
            {status === "verified" && (
              <Link className="login-submit" to={home}>
                Ir para minha estação
              </Link>
            )}
            {status === "expired" && loggedIn && <ResendLink />}
            {status === "expired" && !loggedIn && (
              <Link className="login-submit" to="/login">
                Entrar para pedir outro link
              </Link>
            )}
            {status === "invalid" && (
              <Link className="login-submit" to={home}>
                {loggedIn ? "Ir para minha estação" : "Entrar"}
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
