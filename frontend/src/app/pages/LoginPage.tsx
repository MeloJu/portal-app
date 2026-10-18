import { FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { AuthError, login, register } from "../../api/auth";
import lumiLogo from "../../assets/lumi-logo-v2.png";
import lumiPortalBackground from "../../assets/lumi-portal-bg.png";

type Mode = "login" | "register";

/** Os mesmos limites da API (Bean Validation do cadastro). */
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

const copy: Record<Mode, { eyebrow: string; title: string; text: string; submit: string; loading: string }> = {
  login: {
    eyebrow: "BEM-VINDA DE VOLTA",
    title: "Entre na sua estação",
    text: "Continue de onde parou e acompanhe seus portais.",
    submit: "Entrar na estação",
    loading: "Abrindo estação...",
  },
  register: {
    eyebrow: "NOVA ESTAÇÃO",
    title: "Crie sua estação",
    text: "Em segundos você abre seu primeiro portal, e a Lumi cuida de cada viagem.",
    submit: "Criar minha estação",
    loading: "Construindo estação...",
  },
};

/** Valida antes de chamar a API: as mensagens de validação dela são técnicas e em inglês. */
function validate(mode: Mode, name: string, email: string, password: string): string {
  if (mode === "login") {
    return !email.trim() || !password.trim() ? "Preencha seu e-mail e sua senha para embarcar." : "";
  }
  if (!name.trim() || !email.trim() || !password) return "Preencha nome, e-mail e senha para criar sua estação.";
  if (password.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (password.length > MAX_PASSWORD) return `A senha pode ter no máximo ${MAX_PASSWORD} caracteres.`;
  return "";
}

function errorMessage(mode: Mode, err: unknown): string {
  if (!(err instanceof AuthError)) return "Algo deu errado. Tente novamente.";
  if (mode === "login" && err.isInvalidCredentials) return "E-mail ou senha não conferem. Confira e tente de novo.";
  // A validação da API vem em inglês ("email: must be a well-formed email address").
  if (err.code === "VALIDATION_ERROR") return "Confira os dados: o e-mail precisa ser válido.";
  return err.message;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const text = copy[mode];

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validate(mode, name, email, password);
    if (problem) {
      setError(problem);
      return;
    }

    setError("");
    setLoading(true);
    try {
      if (mode === "register") await register(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(errorMessage(mode, err));
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <img className="login-background" src={lumiPortalBackground} alt="" aria-hidden="true" />
        <div className="login-visual-overlay" />
        <div className="login-visual-copy">
          <span>ESTAÇÃO L²</span>
          <h1>
            Pequenos links.
            <br />
            Infinitos destinos.
          </h1>
          <p>A Lumi está esperando para proteger seus portais e acompanhar cada viagem.</p>
          <div className="login-status">
            <i /> Todos os sistemas operacionais
          </div>
        </div>
        <div className="login-orbit orbit-login-one" />
        <div className="login-orbit orbit-login-two" />
      </section>

      <section className="login-panel">
        <div className="login-box">
          <img className="login-logo" src={lumiLogo} alt="Lumi Links" />
          <div className="login-heading">
            <span>{text.eyebrow}</span>
            <h2>{text.title}</h2>
            <p>{text.text}</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            {mode === "register" && (
              <label>
                <span>Nome</span>
                <div>
                  <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
                    <path
                      d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.7"
                    />
                  </svg>
                  <input
                    autoComplete="name"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Como podemos te chamar?"
                    type="text"
                    value={name}
                  />
                </div>
              </label>
            )}
            <label>
              <span>E-mail</span>
              <div>
                <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                  <path
                    d="M3 6.5 12 13l9-6.5M5 20h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                </svg>
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@estacao.com"
                  type="email"
                  value={email}
                />
              </div>
            </label>
            <label>
              <span>Senha</span>
              <div>
                <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                  <rect height="11" rx="2" stroke="currentColor" strokeWidth="1.7" width="16" x="4" y="10" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                </svg>
                <input
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === "register" ? `Pelo menos ${MIN_PASSWORD} caracteres` : "Digite sua senha"}
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button onClick={() => setShowPassword(!showPassword)} type="button">
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>
            {mode === "login" && (
              <div className="login-options">
                <label>
                  <input type="checkbox" /> <span>Lembrar de mim</span>
                </label>
                <button type="button">Esqueci minha senha</button>
              </div>
            )}
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button className="login-submit" disabled={loading} type="submit">
              {loading ? text.loading : text.submit}
              {!loading && <span>→</span>}
            </button>
          </form>

          <div className="login-divider">
            <span>ou continue com</span>
          </div>
          <div className="social-login">
            <button type="button">
              <b>G</b> Google
            </button>
            <button type="button">
              <b>GH</b> GitHub
            </button>
          </div>
          <p className="signup-copy">
            {mode === "login" ? (
              <>
                Ainda não tem uma estação?{" "}
                <button onClick={() => switchMode("register")} type="button">
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem uma estação?{" "}
                <button onClick={() => switchMode("login")} type="button">
                  Já tenho conta
                </button>
              </>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
