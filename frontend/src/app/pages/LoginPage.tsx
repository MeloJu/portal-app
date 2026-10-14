import { FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import lumiLogo from "../../assets/lumi-logo-v2.png";
import lumiPortalBackground from "../../assets/lumi-portal-bg.png";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function signIn(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Preencha seu e-mail e sua senha para embarcar.");
      return;
    }

    setError("");
    setLoading(true);
    window.setTimeout(() => {
      window.localStorage.setItem("lumi-session", "active");
      navigate("/dashboard");
    }, 850);
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <img className="login-background" src={lumiPortalBackground} alt="" aria-hidden="true" />
        <div className="login-visual-overlay" />
        <div className="login-visual-copy">
          <span>ESTAÇÃO L²</span>
          <h1>Pequenos links.<br />Infinitos destinos.</h1>
          <p>A Lumi está esperando para proteger seus portais e acompanhar cada viagem.</p>
          <div className="login-status"><i /> Todos os sistemas operacionais</div>
        </div>
        <div className="login-orbit orbit-login-one" />
        <div className="login-orbit orbit-login-two" />
      </section>

      <section className="login-panel">
        <div className="login-box">
          <img className="login-logo" src={lumiLogo} alt="Lumi Links" />
          <div className="login-heading">
            <span>BEM-VINDA DE VOLTA</span>
            <h2>Entre na sua estação</h2>
            <p>Continue de onde parou e acompanhe seus portais.</p>
          </div>

          <form className="login-form" onSubmit={signIn}>
            <label>
              <span>E-mail</span>
              <div>
                <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                  <path d="M3 6.5 12 13l9-6.5M5 20h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
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
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button onClick={() => setShowPassword(!showPassword)} type="button">
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>
            <div className="login-options">
              <label><input type="checkbox" /> <span>Lembrar de mim</span></label>
              <button type="button">Esqueci minha senha</button>
            </div>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" disabled={loading} type="submit">
              {loading ? "Abrindo estação..." : "Entrar na estação"}
              {!loading && <span>→</span>}
            </button>
          </form>

          <p className="login-demo">Para testar, use qualquer e-mail e senha.</p>
          <div className="login-divider"><span>ou continue com</span></div>
          <div className="social-login">
            <button type="button"><b>G</b> Google</button>
            <button type="button"><b>GH</b> GitHub</button>
          </div>
          <p className="signup-copy">Ainda não tem uma estação? <button type="button">Criar conta</button></p>
        </div>
      </section>
    </main>
  );
}
