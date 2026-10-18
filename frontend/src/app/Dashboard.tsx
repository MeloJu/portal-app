import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import { logout, type User } from "../api/auth";
import lumiGuardian from "../assets/lumi-guardian.png";
import lumiLogo from "../assets/lumi-logo-v2.png";
import AchievementsSection from "./components/AchievementsSection";
import CreatePortalForm from "./components/CreatePortalForm";
import PortalsSection from "./components/PortalsSection";
import RecentPortals from "./components/RecentPortals";
import { OrbitStation, StatsGrid, TravelFlowPanel } from "./components/OverviewPanels";
import ProtectionSection from "./components/ProtectionSection";
import RevealDestinationPanel from "./components/RevealDestinationPanel";
import TravelsSection from "./components/TravelsSection";
import { Icon, icons } from "./icons";
import { useOverview } from "./useOverview";

const navItems = [
  ["Visão geral", icons.home],
  ["Meus portais", icons.link],
  ["Revelar destino", icons.unlink],
  ["Viagens", icons.chart],
  ["Proteção", icons.shield],
  ["Conquistas", icons.trophy],
  ["Configurações", icons.settings],
] as const;

const pageHeadings: Record<string, [string, string]> = {
  "Visão geral": ["CENTRAL DE COMANDO", "Pronta para decolar?"],
  "Meus portais": ["BIBLIOTECA DE DESTINOS", "Seus portais digitais"],
  "Revelar destino": ["ROTA DE RETORNO", "Revele o destino original"],
  Viagens: ["MAPA DE NAVEGAÇÃO", "Cada clique conta uma história"],
  Proteção: ["ESCUDO DA LUMI", "Rotas seguras, sempre"],
  Conquistas: ["DIÁRIO DE CONQUISTAS", "Cada viagem merece ser celebrada"],
  Configurações: ["AJUSTES DA ESTAÇÃO", "Seu universo, do seu jeito"],
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [overviewVersion, setOverviewVersion] = useState(0);
  const overview = useOverview(5000, 12, overviewVersion);
  const user = useRouteLoaderData("dashboard") as User | undefined;
  const userName = user?.name ?? "Exploradora";
  const firstName = userName.split(/\s+/).find(Boolean) ?? userName;
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
  const ambientRef = useRef<{
    context: AudioContext;
    master: GainNode;
    sources: AudioScheduledSourceNode[];
  } | null>(null);
  const ambientTimerRef = useRef(0);
  const [active, setActive] = useState("Visão geral");
  const [notificationsActive, setNotificationsActive] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoShield, setAutoShield] = useState(true);
  const [ambientOn, setAmbientOn] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const savedTheme = window.localStorage.getItem("lumi-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    return () => {
      window.clearTimeout(ambientTimerRef.current);
      ambientRef.current?.context.close();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("lumi-theme", theme);
  }, [theme]);

  async function toggleAmbient() {
    window.clearTimeout(ambientTimerRef.current);

    if (!ambientRef.current) {
      const context = new AudioContext();
      const master = context.createGain();
      const filter = context.createBiquadFilter();
      const firstTone = context.createOscillator();
      const secondTone = context.createOscillator();
      const firstGain = context.createGain();
      const secondGain = context.createGain();
      const lfo = context.createOscillator();
      const lfoDepth = context.createGain();

      firstTone.type = "sine";
      firstTone.frequency.value = 110;
      firstGain.gain.value = 0.7;
      secondTone.type = "triangle";
      secondTone.frequency.value = 164.81;
      secondGain.gain.value = 0.14;
      filter.type = "lowpass";
      filter.frequency.value = 520;
      filter.Q.value = 0.8;
      master.gain.value = 0.0001;
      lfo.type = "sine";
      lfo.frequency.value = 0.075;
      lfoDepth.gain.value = 55;

      firstTone.connect(firstGain).connect(filter);
      secondTone.connect(secondGain).connect(filter);
      filter.connect(master).connect(context.destination);
      lfo.connect(lfoDepth).connect(filter.frequency);

      firstTone.start();
      secondTone.start();
      lfo.start();
      ambientRef.current = {
        context,
        master,
        sources: [firstTone, secondTone, lfo],
      };
    }

    const { context, master } = ambientRef.current;
    const now = context.currentTime;

    if (ambientOn) {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      setAmbientOn(false);
      ambientTimerRef.current = window.setTimeout(() => context.suspend(), 500);
      return;
    }

    await context.resume();
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.018, context.currentTime + 0.8);
    setAmbientOn(true);
  }

  const [pageEyebrow, pageHeading] = pageHeadings[active] ?? pageHeadings["Visão geral"];
  const pageTitle = active === "Visão geral" ? `Olá, ${firstName}. ${pageHeading}` : pageHeading;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={lumiLogo} alt="Lumi Links — Pequenos links, infinitos destinos" />
        </div>

        <nav className="nav-list" aria-label="Navegação principal">
          <p className="nav-label">Navegação</p>
          {navItems.map(([label, icon]) => (
            <button
              className={`nav-item ${active === label ? "active" : ""}`}
              key={label}
              onClick={() => setActive(label)}
              type="button"
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="guardian-card">
            <img src={lumiGuardian} alt="" aria-hidden="true" />
            <div className="guardian-shade" />
            <div className="mini-orbit"><span /></div>
            <div className="guardian-copy">
              <p>Lumi está de vigia</p>
              <small>Seus portais estão protegidos</small>
            </div>
          </div>
          <div className="profile">
            <div className="avatar">{initials}</div>
            <div>
              <strong>{userName}</strong>
              <span>Plano Explorador</span>
            </div>
            <button
              aria-label="Sair da conta"
              onClick={() => {
                // Mesmo se a API falhar, sai da tela: o cookie expira sozinho.
                void logout()
                  .catch(() => {})
                  .finally(() => navigate("/login", { replace: true }));
              }}
              title="Sair"
              type="button"
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{pageEyebrow}</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="top-actions">
            <span className="status"><i /> Todos os sistemas online</span>
            <button
              aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              aria-pressed={theme === "dark"}
              className="theme-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              type="button"
            >
              {theme === "dark" ? (
                <Icon>
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                </Icon>
              ) : (
                <Icon>
                  <path d="M20.5 15.4A8 8 0 0 1 8.6 3.5 8.5 8.5 0 1 0 20.5 15.4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                </Icon>
              )}
            </button>
            <button
              aria-label={ambientOn ? "Desativar som ambiente" : "Ativar som ambiente"}
              aria-pressed={ambientOn}
              className={`ambient-button ${ambientOn ? "active" : ""}`}
              onClick={toggleAmbient}
              title={ambientOn ? "Desativar som ambiente" : "Ativar som ambiente"}
              type="button"
            >
              <Icon>
                <path d="M4 10v4h3l4 3V7l-4 3H4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                <path d="M15 9.2a4 4 0 0 1 0 5.6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
              </Icon>
              <span className="sound-waves"><i /><i /><i /></span>
            </button>
            <button
              aria-label="Notificações"
              aria-pressed={notificationsActive}
              className={`icon-button ${notificationsActive ? "active" : ""}`}
              onClick={() => setNotificationsActive(!notificationsActive)}
              type="button"
            >
              <Icon>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                {notificationsActive && (
                  <>
                    <g transform="translate(-3 -3)" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={1.8}>
                      <path d="M4.5 5.3C2.8 6.9 2 9 2 11.4" />
                      <path d="M6.7 7.1c-1 1.1-1.5 2.3-1.5 3.7" />
                    </g>
                    <g transform="translate(3 -3)" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={1.8}>
                      <path d="M19.5 5.3C21.2 6.9 22 9 22 11.4" />
                      <path d="M17.3 7.1c1 1.1 1.5 2.3 1.5 3.7" />
                    </g>
                  </>
                )}
                
              </Icon>
            </button>
          </div>
        </header>

        {active === "Visão geral" && (<>
        <CreatePortalForm onCreated={() => setOverviewVersion((version) => version + 1)} />

        <StatsGrid overview={overview} />

        <section className="thematic-grid">
          <OrbitStation overview={overview} />
        </section>

        <section className="content-grid">
          <RecentPortals version={overviewVersion} onSeeAll={() => setActive("Meus portais")} />

          <TravelFlowPanel overview={overview} />
        </section>
        </>)}

        {active === "Meus portais" && <PortalsSection />}

        {active === "Revelar destino" && <RevealDestinationPanel />}

        {active === "Viagens" && <TravelsSection />}

        {active === "Proteção" && <ProtectionSection />}

        {active === "Conquistas" && <AchievementsSection />}

        {active === "Configurações" && (
          <section className="page-content settings-layout">
            <aside className="settings-menu">
              <button className="selected" type="button">{icons.settings} Perfil e estação</button>
              <button type="button">{icons.link} Domínios</button>
              <button type="button">{icons.shield} Segurança</button>
              <button type="button">{icons.chart} Plano e uso</button>
            </aside>
            <div className="settings-panels">
              <article className="settings-panel">
                <div className="settings-heading"><div><span>PERFIL DA EXPLORADORA</span><h2>Informações pessoais</h2></div><div className="settings-avatar">{initials}</div></div>
                <div className="settings-fields">
                  <label><span>Nome</span><input defaultValue={userName} /></label>
                  <label><span>E-mail</span><input defaultValue={user?.email ?? ""} type="email" /></label>
                  <label><span>Nome da estação</span><input defaultValue={`Estação de ${firstName}`} /></label>
                  <label><span>Idioma</span><select defaultValue="pt-BR"><option value="pt-BR">Português (Brasil)</option><option value="en">English</option></select></label>
                </div>
                <button className="save-button" type="button">Salvar alterações</button>
              </article>
              <article className="settings-panel preferences-panel">
                <div><span>PREFERÊNCIAS DE BORDO</span><h2>Automação e alertas</h2></div>
                <div className="preference-row">
                  <div><strong>Alertas de viagem</strong><p>Receba um resumo quando um portal ganhar tração.</p></div>
                  <button aria-pressed={notifications} className={`toggle ${notifications ? "on" : ""}`} onClick={() => setNotifications(!notifications)} type="button"><i /></button>
                </div>
                <div className="preference-row">
                  <div><strong>Escudo automático</strong><p>Bloqueie tráfego suspeito sem precisar aprovar.</p></div>
                  <button aria-pressed={autoShield} className={`toggle ${autoShield ? "on" : ""}`} onClick={() => setAutoShield(!autoShield)} type="button"><i /></button>
                </div>
              </article>
            </div>
          </section>
        )}

        <footer>
          <span>L²</span>
          <p>Cada clique é uma nova viagem.</p>
          <small>Lumi Links · Todos os sistemas operacionais</small>
        </footer>
      </main>
    </div>
  );
}
