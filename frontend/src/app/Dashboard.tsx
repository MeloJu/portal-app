import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import { logout, type User } from "../api/auth";
import lumiGuardian from "../assets/lumi-guardian.png";
import lumiLogo from "../assets/lumi-logo-v2.png";
import CreatePortalForm from "./components/CreatePortalForm";
import PortalsSection from "./components/PortalsSection";
import { OrbitStation, StatsGrid, TravelFlowPanel } from "./components/OverviewPanels";
import RevealDestinationPanel from "./components/RevealDestinationPanel";
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

const recentLinks = [
  { name: "Campanha Nebulosa", short: "l2.to/nebulosa", clicks: "1.248", color: "violet", change: "+18%" },
  { name: "Portfólio 2025", short: "l2.to/ana-design", clicks: "842", color: "cyan", change: "+7%" },
  { name: "Evento Orbit", short: "l2.to/orbit-live", clicks: "396", color: "blue", change: "+24%" },
];

const pageHeadings: Record<string, [string, string]> = {
  "Visão geral": ["CENTRAL DE COMANDO", "Olá, Ana. Pronta para decolar?"],
  "Meus portais": ["BIBLIOTECA DE DESTINOS", "Seus portais digitais"],
  "Revelar destino": ["ROTA DE RETORNO", "Revele o destino original"],
  Viagens: ["MAPA DE NAVEGAÇÃO", "Cada clique conta uma história"],
  Proteção: ["ESCUDO DA LUMI", "Rotas seguras, sempre"],
  Conquistas: ["DIÁRIO DE CONQUISTAS", "Cada viagem merece ser celebrada"],
  Configurações: ["AJUSTES DA ESTAÇÃO", "Seu universo, do seu jeito"],
};

const achievements = [
  { title: "Primeiro portal", description: "Você abriu seu primeiro portal digital.", progress: 100, unlocked: true, detail: "Desbloqueada em 02 Mai", tone: "violet", icon: icons.portal },
  { title: "Primeiro clique", description: "A primeira viagem atravessou um dos seus links.", progress: 100, unlocked: true, detail: "Desbloqueada em 02 Mai", tone: "cyan", icon: icons.link },
  { title: "Rota popular", description: "Um portal alcançou 100 viagens.", progress: 100, unlocked: true, detail: "Desbloqueada em 05 Mai", tone: "blue", icon: icons.chart },
  { title: "Guardião atento", description: "A Lumi bloqueou sua primeira ameaça.", progress: 100, unlocked: true, detail: "Desbloqueada em 06 Mai", tone: "indigo", icon: icons.shield },
  { title: "Exploradora orbital", description: "Crie 10 portais diferentes.", progress: 70, unlocked: false, detail: "7 de 10 portais", tone: "violet", icon: icons.portal },
  { title: "Mil viajantes", description: "Alcance 1.000 viagens em um único portal.", progress: 84, unlocked: false, detail: "842 de 1.000 viagens", tone: "cyan", icon: icons.chart },
  { title: "Constelação global", description: "Receba cliques de 10 países.", progress: 60, unlocked: false, detail: "6 de 10 países", tone: "blue", icon: icons.link },
  { title: "Mestre dos portais", description: "Mantenha 25 portais ativos ao mesmo tempo.", progress: 96, unlocked: false, detail: "24 de 25 portais", tone: "indigo", icon: icons.trophy },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const overview = useOverview();
  // Usuário vindo do loader da rota /dashboard (o /api/me); sem ele, mantém o nome do protótipo.
  const user = useRouteLoaderData("dashboard") as User | undefined;
  const userName = user?.name ?? "Ana Martins";
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
  const ambientRef = useRef<{
    context: AudioContext;
    master: GainNode;
    sources: AudioScheduledSourceNode[];
  } | null>(null);
  const ambientTimerRef = useRef(0);
  const copiedTimerRef = useRef(0);
  const [active, setActive] = useState("Visão geral");
  const [copied, setCopied] = useState("");
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
      window.clearTimeout(copiedTimerRef.current);
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

  async function copyLink(value: string) {
    if (!navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(`https://${value}`);
    } catch {
      return;
    }

    window.clearTimeout(copiedTimerRef.current);
    setCopied(value);
    copiedTimerRef.current = window.setTimeout(() => setCopied(""), 1600);
  }

  function previewPortal(shortLink: string) {
    const slug = shortLink.replace(/^https?:\/\//, "").split("/").filter(Boolean).pop();
    if (!slug) return;
    window.open(`/${encodeURIComponent(slug)}`, "_blank", "noopener,noreferrer");
  }

  const [pageEyebrow, pageTitle] = pageHeadings[active] ?? pageHeadings["Visão geral"];

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
        <CreatePortalForm />

        <StatsGrid overview={overview} />

        <section className="thematic-grid">
          <OrbitStation overview={overview} />
        </section>

        <section className="content-grid">
          <article className="panel links-panel">
            <div className="panel-heading">
              <div>
                <span>PORTAIS RECENTES</span>
                <h3>Últimos links criados</h3>
              </div>
              <button type="button">Ver todos {icons.arrow}</button>
            </div>
            <div className="links-list">
              {recentLinks.map((link) => (
                <div className="link-row" key={link.short}>
                  <div className={`link-orb ${link.color}`}><i /></div>
                  <div className="link-info">
                    <strong>{link.name}</strong>
                    <button onClick={() => copyLink(link.short)} type="button">
                      {link.short} {copied === link.short ? icons.check : icons.copy}
                    </button>
                  </div>
                  <div className="click-count">
                    <strong>{link.clicks}</strong>
                    <span>viagens</span>
                  </div>
                  <span className="change">{link.change}</span>
                  <button
                    className="row-preview"
                    aria-label={`Visualizar portal ${link.name}`}
                    onClick={() => previewPortal(link.short)}
                    title="Visualizar portal"
                    type="button"
                  >
                    {icons.arrow}
                  </button>
                </div>
              ))}
            </div>
          </article>

          <TravelFlowPanel overview={overview} />
        </section>
        </>)}

        {active === "Meus portais" && <PortalsSection onNewPortal={() => setActive("Visão geral")} />}

        {active === "Revelar destino" && <RevealDestinationPanel />}

        {active === "Viagens" && (
          <section className="page-content">
            <div className="journey-summary">
              <article><span>VIAGENS TOTAIS</span><strong>8.429</strong><b>+18,4% este mês</b></article>
              <article><span>VIAJANTES ÚNICOS</span><strong>6.174</strong><b>73,2% do total</b></article>
              <article><span>TEMPO ATÉ O DESTINO</span><strong>0,28s</strong><b>Rota ultrarrápida</b></article>
              <article><span>PAÍSES ALCANÇADOS</span><strong>24</strong><b>+3 novas órbitas</b></article>
            </div>
            <div className="journey-layout">
              <article className="cosmic-map">
                <div className="map-heading">
                  <div><span>TRÁFEGO AO VIVO</span><h2>Viagens pelo universo</h2></div>
                  <b><i /> 17 agora</b>
                </div>
                <div className="map-space">
                  <div className="map-orbit orbit-a"><i /></div>
                  <div className="map-orbit orbit-b"><i /></div>
                  <div className="map-planet planet-main"><span>L²</span></div>
                  <div className="map-planet planet-one"><i /><small>Brasil</small></div>
                  <div className="map-planet planet-two"><i /><small>Portugal</small></div>
                  <div className="map-planet planet-three"><i /><small>Estados Unidos</small></div>
                  <div className="travel-streak streak-one" />
                  <div className="travel-streak streak-two" />
                  <div className="travel-streak streak-three" />
                </div>
              </article>
              <article className="rank-panel">
                <div className="panel-heading"><div><span>DESTINOS FAVORITOS</span><h3>Rotas mais viajadas</h3></div></div>
                {[
                  ["01", "Campanha Nebulosa", "1.248", 88],
                  ["02", "Portfólio 2025", "842", 66],
                  ["03", "Newsletter Lunar", "684", 51],
                  ["04", "Evento Orbit", "396", 34],
                ].map(([rank, name, trips, width]) => (
                  <div className="rank-row" key={name}>
                    <b>{rank}</b>
                    <div><strong>{name}</strong><i><span style={{ width: `${width}%` }} /></i></div>
                    <span>{trips}</span>
                  </div>
                ))}
              </article>
            </div>
          </section>
        )}

        {active === "Proteção" && (
          <section className="page-content">
            <div className="security-hero">
              <div className="shield-score">
                <div className="shield-rings"><span>{icons.shield}</span></div>
                <div><small>ÍNDICE DE PROTEÇÃO</small><strong>98</strong><b>/100</b></div>
              </div>
              <div className="security-copy">
                <span>LUMI ESTÁ DE VIGIA</span>
                <h2>Todos os portais estão protegidos</h2>
                <p>As rotas são verificadas continuamente contra destinos perigosos, robôs e tentativas de fraude.</p>
              </div>
              <span className="secure-badge"><i /> Escudo ativo</span>
            </div>
            <div className="security-grid">
              <article className="security-card">
                <div className="security-icon">{icons.shield}</div>
                <span>AMEAÇAS BLOQUEADAS</span><strong>137</strong>
                <p>12 tentativas bloqueadas nos últimos 7 dias.</p>
                <div className="security-bars"><i /><i /><i /><i /><i /><i /><i /></div>
              </article>
              <article className="security-card">
                <div className="security-icon cyan">{icons.link}</div>
                <span>DESTINOS VERIFICADOS</span><strong>24/24</strong>
                <p>Nenhum destino suspeito encontrado.</p>
                <div className="verified-line"><i /> Última análise há 3 minutos</div>
              </article>
              <article className="security-card">
                <div className="security-icon violet">{icons.chart}</div>
                <span>TRÁFEGO FILTRADO</span><strong>99,8%</strong>
                <p>Cliques legítimos identificados com precisão.</p>
                <div className="verified-line"><i /> Monitoramento contínuo</div>
              </article>
            </div>
            <article className="threat-log">
              <div className="panel-heading"><div><span>DIÁRIO DE BORDO</span><h3>Atividade de proteção recente</h3></div><button type="button">Ver relatório {icons.arrow}</button></div>
              {[
                ["Bot automatizado bloqueado", "Campanha Nebulosa", "Há 12 min", "Bloqueado"],
                ["Destino verificado com sucesso", "Newsletter Lunar", "Há 38 min", "Seguro"],
                ["Tentativa de acesso suspeita", "Portfólio 2025", "Há 2 h", "Bloqueado"],
              ].map(([event, portal, time, result]) => (
                <div className="threat-row" key={`${event}-${time}`}>
                  <div className={`threat-dot ${result === "Seguro" ? "safe" : ""}`} />
                  <div><strong>{event}</strong><span>{portal}</span></div>
                  <time>{time}</time>
                  <b className={result === "Seguro" ? "safe" : ""}>{result}</b>
                </div>
              ))}
            </article>
          </section>
        )}

        {active === "Conquistas" && (
          <section className="page-content achievements-page">
            <article className="achievements-hero">
              <div className="achievement-emblem">
                <div className="emblem-orbit"><i /></div>
                <span>{icons.trophy}</span>
              </div>
              <div className="achievement-rank">
                <span>NÍVEL DE EXPLORADORA</span>
                <h2>Cartógrafa de Portais</h2>
                <p>Você já desbloqueou 4 de 8 conquistas nesta constelação.</p>
                <div className="rank-progress"><i style={{ width: "50%" }} /></div>
              </div>
              <div className="achievement-score">
                <span>PONTOS ESTELARES</span>
                <strong>1.480</strong>
                <b>+240 esta semana</b>
              </div>
            </article>

            <div className="achievement-summary">
              <article><span>{icons.trophy}</span><div><strong>4</strong><small>Desbloqueadas</small></div></article>
              <article><span>{icons.portal}</span><div><strong>4</strong><small>Em progresso</small></div></article>
              <article><span>{icons.spark}</span><div><strong>50%</strong><small>Da constelação</small></div></article>
            </div>

            <div className="achievements-heading">
              <div><span>CONSTELAÇÃO ATUAL</span><h2>Marcos da sua jornada</h2></div>
              <button type="button">Todas as conquistas {icons.arrow}</button>
            </div>

            <div className="achievements-grid">
              {achievements.map((achievement) => (
                <article className={`achievement-card ${achievement.unlocked ? "unlocked" : "locked"}`} key={achievement.title}>
                  <div className={`achievement-icon ${achievement.tone}`}>
                    <div className="achievement-icon-orbit"><i /></div>
                    <span>{achievement.icon}</span>
                  </div>
                  <div className="achievement-state">
                    {achievement.unlocked ? <span><i /> CONQUISTADA</span> : <span>EM PROGRESSO</span>}
                  </div>
                  <h3>{achievement.title}</h3>
                  <p>{achievement.description}</p>
                  <div className="achievement-progress">
                    <div><i style={{ width: `${achievement.progress}%` }} /></div>
                    <span>{achievement.detail}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

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
                  <label><span>E-mail</span><input defaultValue="ana@lumi.studio" type="email" /></label>
                  <label><span>Nome da estação</span><input defaultValue="Estação da Ana" /></label>
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
