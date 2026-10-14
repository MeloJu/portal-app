import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import lumiGuardian from "../assets/lumi-guardian.png";
import lumiLogo from "../assets/lumi-logo-v2.png";
import lumiPortalBackground from "../assets/lumi-portal-bg.png";

type IconProps = {
  children: ReactNode;
  size?: number;
};

function Icon({ children, size = 20 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  );
}

const icons = {
  portal: (
    <Icon size={24}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4V1.8M20 12h2.2M12 20v2.2M4 12H1.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </Icon>
  ),
  home: (
    <Icon>
      <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
  link: (
    <Icon>
      <path d="m10 13.8 4-4m-7.7 7.9-1 .9a3.5 3.5 0 0 1-5-5l3.4-3.4a3.5 3.5 0 0 1 5 0m8.9-3.9 1-.9a3.5 3.5 0 1 1 5 5l-3.4 3.4a3.5 3.5 0 0 1-5 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" transform="translate(-1.5)" />
    </Icon>
  ),
  unlink: (
    <Icon>
      <path d="m9.5 14.5-1 1a3.5 3.5 0 0 1-5-5l2-2a3.5 3.5 0 0 1 5 0M14.5 9.5l1-1a3.5 3.5 0 0 1 5 5l-2 2a3.5 3.5 0 0 1-5 0M8 3v3M3 8h3M16 18v3M18 16h3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
  chart: (
    <Icon>
      <path d="M4 20V10m6 10V4m6 16v-7m5 7H2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
  shield: (
    <Icon>
      <path d="M12 22s8-3.7 8-10V5l-8-3-8 3v7c0 6.3 8 10 8 10Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m8.8 12 2.1 2.1 4.5-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
    </Icon>
  ),
  trophy: (
    <Icon>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4ZM10 13v3m4-3v3M8 20h8m-7-4h6v4H9v-4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
  plus: (
    <Icon size={18}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </Icon>
  ),
  spark: (
    <Icon size={18}>
      <path d="m12 2 1.2 5.8L19 9l-5.8 1.2L12 16l-1.2-5.8L5 9l5.8-1.2L12 2Z" fill="currentColor" />
      <path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" fill="currentColor" />
    </Icon>
  ),
  copy: (
    <Icon size={17}>
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.8" width="12" x="8" y="8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.8" />
    </Icon>
  ),
  arrow: (
    <Icon size={17}>
      <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
};

const navItems = [
  ["Visão geral", icons.home],
  ["Meus portais", icons.link],
  ["Fechar portal", icons.unlink],
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

const chartBars = [34, 48, 42, 66, 58, 78, 54, 72, 84, 62, 94, 76];

const pageHeadings: Record<string, [string, string]> = {
  "Visão geral": ["CENTRAL DE COMANDO", "Olá, Ana. Pronta para decolar?"],
  "Meus portais": ["BIBLIOTECA DE DESTINOS", "Seus portais digitais"],
  "Fechar portal": ["ROTA DE RETORNO", "Revele o destino original"],
  Viagens: ["MAPA DE NAVEGAÇÃO", "Cada clique conta uma história"],
  Proteção: ["ESCUDO DA LUMI", "Rotas seguras, sempre"],
  Conquistas: ["DIÁRIO DE CONQUISTAS", "Cada viagem merece ser celebrada"],
  Configurações: ["AJUSTES DA ESTAÇÃO", "Seu universo, do seu jeito"],
};

const portalCards = [
  { name: "Campanha Nebulosa", slug: "l2.to/nebulosa", destination: "lumi.studio/campanha", trips: "1.248", status: "Ativo", tone: "violet" },
  { name: "Portfólio 2025", slug: "l2.to/ana-design", destination: "anadesign.com.br", trips: "842", status: "Ativo", tone: "cyan" },
  { name: "Evento Orbit", slug: "l2.to/orbit-live", destination: "youtube.com/orbit", trips: "396", status: "Agendado", tone: "blue" },
  { name: "Clube Supernova", slug: "l2.to/supernova", destination: "comunidade.lumi.co", trips: "2.104", status: "Ativo", tone: "pink" },
  { name: "Guia de Marca", slug: "l2.to/brand-kit", destination: "figma.com/lumi-kit", trips: "219", status: "Pausado", tone: "amber" },
  { name: "Newsletter Lunar", slug: "l2.to/carta-lunar", destination: "lumi.substack.com", trips: "684", status: "Ativo", tone: "indigo" },
];

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
  const cursorRef = useRef<HTMLDivElement>(null);
  const ambientRef = useRef<{
    context: AudioContext;
    master: GainNode;
    sources: AudioScheduledSourceNode[];
  } | null>(null);
  const ambientTimerRef = useRef(0);
  const [active, setActive] = useState("Visão geral");
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [created, setCreated] = useState("");
  const [copied, setCopied] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoShield, setAutoShield] = useState(true);
  const [portalFilter, setPortalFilter] = useState("Todos");
  const [ambientOn, setAmbientOn] = useState(false);
  const [closeUrl, setCloseUrl] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [closeReady, setCloseReady] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const savedTheme = window.localStorage.getItem("lumi-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor || !window.matchMedia("(pointer: fine)").matches) return;

    let clickTimer = 0;

    function moveCursor(event: PointerEvent) {
      if (!cursor) return;
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
      cursor.classList.add("visible");

      const target = event.target as Element | null;
      cursor.classList.toggle("interactive", Boolean(target?.closest("button, a")));
      cursor.classList.toggle("over-text", Boolean(target?.closest("input, textarea, select")));
    }

    function animateClick() {
      if (!cursor) return;
      window.clearTimeout(clickTimer);
      cursor.classList.remove("clicking");
      void cursor.offsetWidth;
      cursor.classList.add("clicking");
      clickTimer = window.setTimeout(() => cursor.classList.remove("clicking"), 520);
    }

    function hideCursor() {
      cursor?.classList.remove("visible");
    }

    window.addEventListener("pointermove", moveCursor);
    window.addEventListener("pointerdown", animateClick);
    document.documentElement.addEventListener("mouseleave", hideCursor);

    return () => {
      window.clearTimeout(clickTimer);
      window.removeEventListener("pointermove", moveCursor);
      window.removeEventListener("pointerdown", animateClick);
      document.documentElement.removeEventListener("mouseleave", hideCursor);
    };
  }, []);

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

  function createLink(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    const safeSlug =
      slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") ||
      `portal-${Math.floor(100 + Math.random() * 900)}`;
    setCreated("");
    setIsOpening(true);
    window.setTimeout(() => {
      setCreated(`l2.to/${safeSlug}`);
      setIsOpening(false);
    }, 1400);
  }

  function copyLink(value: string) {
    navigator.clipboard?.writeText(`https://${value}`);
    setCopied(value);
    window.setTimeout(() => setCopied(""), 1600);
  }

  function previewPortal(shortLink: string) {
    const slug = shortLink.replace(/^https?:\/\//, "").split("/").filter(Boolean).pop();
    if (!slug) return;
    window.open(`/r/${encodeURIComponent(slug)}`, "_blank", "noopener,noreferrer");
  }

  function closePortal(event: FormEvent) {
    event.preventDefault();
    if (!closeUrl.trim() || isClosing) return;
    setCloseReady(false);
    setIsClosing(true);
    window.setTimeout(() => {
      setIsClosing(false);
      setCloseReady(true);
    }, 1300);
  }

  const normalizedCloseUrl = closeUrl.trim().match(/^https?:\/\//i)
    ? closeUrl.trim()
    : `https://${closeUrl.trim()}`;
  const bypassCityUrl = `https://bypass.city/bypass?bypass=${encodeURIComponent(normalizedCloseUrl)}`;

  const [pageEyebrow, pageTitle] = pageHeadings[active] ?? pageHeadings["Visão geral"];

  return (
    <div className="app-shell">
      <div className="custom-portal-cursor" ref={cursorRef} aria-hidden="true">
        <span className="cursor-orbit orbit-alpha"><i /></span>
        <span className="cursor-orbit orbit-beta"><i /></span>
        <span className="cursor-center" />
        <span className="cursor-spark spark-one" />
        <span className="cursor-spark spark-two" />
        <span className="cursor-spark spark-three" />
      </div>
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
            <div className="avatar">AM</div>
            <div>
              <strong>Ana Martins</strong>
              <span>Plano Explorador</span>
            </div>
            <button
              aria-label="Sair da conta"
              onClick={() => {
                window.localStorage.removeItem("lumi-session");
                navigate("/login");
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
            <button className="icon-button" aria-label="Notificações" type="button">
              <Icon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></Icon>
              <i />
            </button>
          </div>
        </header>

        {active === "Visão geral" && (<>
        <section className={`creator-card ${isOpening ? "portal-active" : ""}`} aria-busy={isOpening}>
          <img
            className="creator-background"
            src={lumiPortalBackground}
            alt=""
            aria-hidden="true"
          />
          <div className="creator-overlay" />
          <div className="creator-copy">
            <span className="pill">{icons.spark} ABRIR NOVO PORTAL</span>
            <h2>Para onde vamos agora?</h2>
            <p>Cole seu link. A Lumi cuida do caminho.</p>
          </div>
          <form className="link-form" onSubmit={createLink}>
            <label className="url-field">
              <span>{icons.link}</span>
              <input
                inputMode="url"
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Cole seu link longo aqui..."
                type="text"
                value={url}
              />
            </label>
            <label className="slug-field">
              <span>l2.to/</span>
              <input
                onChange={(event) => setSlug(event.target.value)}
                placeholder="personalizar"
                type="text"
                value={slug}
              />
            </label>
            <button className="primary-button" disabled={isOpening} type="submit">
              {isOpening ? "Abrindo portal..." : "Criar portal"} {!isOpening && icons.arrow}
            </button>
          </form>
          {isOpening && (
            <div className="portal-opening" role="status" aria-live="polite">
              <div className="opening-vortex" aria-hidden="true">
                <div className="portal-energy"><i /><i /><i /><i /></div>
                <div className="portal-ripples"><i /><i /><i /></div>
                <span className="vortex-ring ring-outer" />
                <span className="vortex-ring ring-middle" />
                <span className="vortex-ring ring-inner" />
                <span className="vortex-core">
                  <img src={lumiLogo} alt="" />
                </span>
                <div className="portal-particles">
                  <i /><i /><i /><i /><i /><i />
                </div>
              </div>
              <div className="opening-copy">
                <strong>Portal em formação</strong>
                <span>Lumi está traçando a rota mais segura</span>
              </div>
            </div>
          )}
          {created && (
            <div className="created-link" role="status">
              <span>Portal aberto com sucesso</span>
              <strong>{created}</strong>
              <button onClick={() => copyLink(created)} type="button">
                {icons.copy} {copied === created ? "Copiado" : "Copiar"}
              </button>
              <button onClick={() => previewPortal(created)} type="button">
                Visualizar {icons.arrow}
              </button>
            </div>
          )}
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-icon violet">{icons.link}</div>
            <div>
              <span>Portais ativos</span>
              <strong>24</strong>
              <small><b>+3</b> este mês</small>
            </div>
            <div className="mini-stars"><i /><i /><i /></div>
          </article>
          <article className="stat-card">
            <div className="stat-icon cyan">{icons.chart}</div>
            <div>
              <span>Viagens realizadas</span>
              <strong>8.429</strong>
              <small><b>+18,4%</b> vs. mês passado</small>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-icon blue">{icons.shield}</div>
            <div>
              <span>Ameaças bloqueadas</span>
              <strong>137</strong>
              <small><b>100%</b> dos portais seguros</small>
            </div>
          </article>
        </section>

        <section className="thematic-grid">
          <article className="portal-station">
            <div className="station-heading">
              <div>
                <span>ESTAÇÃO L²</span>
                <h3>Portais em órbita</h3>
              </div>
              <b><i /> 3 ativos agora</b>
            </div>
            <div className="portal-list">
              <div className="portal-destination">
                <div className="destination-ring violet-portal"><i /><span /></div>
                <div><strong>Nebulosa</strong><span>1.248 viajantes</span></div>
              </div>
              <div className="portal-route"><i /><i /><i /></div>
              <div className="portal-destination">
                <div className="destination-ring cyan-portal"><i /><span /></div>
                <div><strong>Orbit Live</strong><span>396 viajantes</span></div>
              </div>
              <div className="portal-route"><i /><i /><i /></div>
              <div className="portal-destination">
                <div className="destination-ring blue-portal"><i /><span /></div>
                <div><strong>Ana Design</strong><span>842 viajantes</span></div>
              </div>
            </div>
          </article>
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
                      {link.short} {icons.copy}
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

          <article className="panel journey-panel">
            <div className="panel-heading">
              <div>
                <span>ROTAS EM MOVIMENTO</span>
                <h3>Fluxo de viagens</h3>
              </div>
              <button className="period-button" type="button">Últimos 12 dias⌄</button>
            </div>
            <div className="chart-meta">
              <div><strong>2.846</strong><span>viagens no período</span></div>
              <b>+12,8%</b>
            </div>
            <div className="chart">
              <div className="chart-grid"><i /><i /><i /></div>
              <div className="bars">
                {chartBars.map((height, index) => (
                  <span className={index === 10 ? "highlight" : ""} key={index} style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
            <div className="chart-labels"><span>01 Mai</span><span>06 Mai</span><span>12 Mai</span></div>
          </article>
        </section>
        </>)}

        {active === "Meus portais" && (
          <section className="page-content">
            <div className="page-toolbar">
              <div className="filter-tabs">
                {["Todos", "Ativos", "Agendados", "Pausados"].map((filter) => (
                  <button
                    className={portalFilter === filter ? "selected" : ""}
                    key={filter}
                    onClick={() => setPortalFilter(filter)}
                    type="button"
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <button className="page-primary" onClick={() => setActive("Visão geral")} type="button">
                {icons.plus} Novo portal
              </button>
            </div>
            <div className="portal-library">
              {portalCards
                .filter((portal) => portalFilter === "Todos" || `${portal.status}s` === portalFilter)
                .map((portal) => (
                  <article className="library-card" key={portal.slug}>
                    <div className={`library-portal ${portal.tone}`}>
                      <i /><span>{icons.link}</span>
                    </div>
                    <div className="library-card-top">
                      <span className={`portal-status ${portal.status.toLowerCase()}`}><i /> {portal.status}</span>
                      <button aria-label={`Opções de ${portal.name}`} type="button">•••</button>
                    </div>
                    <h2>{portal.name}</h2>
                    <button className="short-link" onClick={() => copyLink(portal.slug)} type="button">
                      {portal.slug} {icons.copy}
                    </button>
                    <div className="destination-line">
                      <span>DESTINO</span>
                      <p>{portal.destination}</p>
                    </div>
                    <div className="library-footer">
                      <div><strong>{portal.trips}</strong><span>viagens</span></div>
                      <button onClick={() => previewPortal(portal.slug)} type="button">
                        Visualizar {icons.arrow}
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        )}

        {active === "Fechar portal" && (
          <section className="page-content close-portal-page">
            <article className={`close-portal-card ${isClosing ? "closing" : ""}`}>
              <div className="close-stars" />
              <div className="close-copy">
                <span className="close-badge">{icons.unlink} FECHAR PORTAL</span>
                <h2>Descubra para onde o portal realmente leva.</h2>
                <p>Cole um link encurtado ou protegido. A Lumi prepara a rota de retorno e envia a análise ao Bypass City.</p>
              </div>
              <div className="collapse-visual" aria-hidden="true">
                <div className="collapse-ring collapse-outer"><i /></div>
                <div className="collapse-ring collapse-middle"><i /></div>
                <div className="collapse-ring collapse-inner"><span>{icons.unlink}</span></div>
                <div className="collapse-rays"><i /><i /><i /><i /></div>
              </div>
              <form className="close-form" onSubmit={closePortal}>
                <label>
                  <span>{icons.link}</span>
                  <input
                    inputMode="url"
                    onChange={(event) => {
                      setCloseUrl(event.target.value);
                      setCloseReady(false);
                    }}
                    placeholder="Cole o link que deseja revelar..."
                    type="text"
                    value={closeUrl}
                  />
                </label>
                <button disabled={isClosing} type="submit">
                  {isClosing ? "Fechando portal..." : "Revelar destino"} {!isClosing && icons.arrow}
                </button>
              </form>
              {isClosing && (
                <div className="closing-status" role="status" aria-live="polite">
                  <span><i /><i /><i /></span>
                  <strong>Invertendo a rota do portal</strong>
                  <small>Preparando o link para análise segura</small>
                </div>
              )}
            </article>

            {closeReady && (
              <article className="close-result" role="status">
                <div className="result-symbol">{icons.portal}</div>
                <div>
                  <span>ROTA PREPARADA</span>
                  <h3>O destino está pronto para ser revelado</h3>
                  <p>O Bypass City concluirá a análise e exibirá o endereço original. Pode ser necessário resolver uma verificação de segurança.</p>
                </div>
                <a href={bypassCityUrl} rel="noopener noreferrer" target="_blank">
                  Continuar no Bypass City {icons.arrow}
                </a>
              </article>
            )}

            <div className="close-info-grid">
              <article><span>01</span><div><strong>Cole o portal</strong><p>Links de serviços compatíveis com o Bypass City.</p></div></article>
              <article><span>02</span><div><strong>Inverta a rota</strong><p>A Lumi prepara o endereço para a análise externa.</p></div></article>
              <article><span>03</span><div><strong>Encontre o destino</strong><p>O endereço original é revelado pelo serviço parceiro.</p></div></article>
            </div>
            <p className="partner-note">
              Processamento externo fornecido por <a href="https://bypass.city/" rel="noopener noreferrer" target="_blank">bypass.city</a>. Use apenas em links que você tem permissão para acessar.
            </p>
          </section>
        )}

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
                <div className="settings-heading"><div><span>PERFIL DA EXPLORADORA</span><h2>Informações pessoais</h2></div><div className="settings-avatar">AM</div></div>
                <div className="settings-fields">
                  <label><span>Nome</span><input defaultValue="Ana Martins" /></label>
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
