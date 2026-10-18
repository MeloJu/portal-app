-- Esquema inicial do Lumi Links.
-- PKs em uuid v7 geradas pela app (Hibernate @UuidGenerator); o default do banco existe
-- para insercao manual e seeds. gen_random_uuid() e built-in desde o Postgres 13.

create table users (
    id            uuid primary key default gen_random_uuid(),
    email         varchar(254) not null,
    password_hash varchar(72)  not null,
    display_name  varchar(80),
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz  not null default now(),
    constraint users_email_unique unique (email),
    -- e-mail normalizado na gravacao: evita duas contas que diferem so no caixa
    constraint users_email_lowercase check (email = lower(email))
);

create table links (
    id         uuid          primary key default gen_random_uuid(),
    owner_id   uuid          not null references users (id) on delete cascade,
    code       varchar(32)   not null,
    target_url varchar(2048) not null,
    title      varchar(120),
    active     boolean       not null default true,
    expires_at timestamptz,
    created_at timestamptz   not null default now(),
    updated_at timestamptz   not null default now(),
    constraint links_code_unique unique (code),
    constraint links_code_format check (code ~ '^[A-Za-z0-9_-]{3,32}$'),
    -- destino so http/https: a Travessia faz window.location, e um javascript:
    -- viraria XSS no nosso dominio (docs/SECURITY.md, secao 2)
    constraint links_target_url_scheme check (target_url ~* '^https?://')
);

-- Todo acesso e por dono: as consultas filtram (owner_id, code), nunca code sozinho
-- (docs/SECURITY.md, secao 1).
create index links_owner_created_idx on links (owner_id, created_at desc);

-- Uma viagem = um clique no portal. Sem coluna de IP: o IP e usado so em memoria
-- pelo rate limit, nunca gravado (docs/SECURITY.md, secao 11).
create table travels (
    id          uuid          primary key default gen_random_uuid(),
    link_id     uuid          not null references links (id) on delete cascade,
    occurred_at timestamptz   not null default now(),
    referrer    varchar(2048),
    user_agent  varchar(512),
    country     varchar(2)
);

create index travels_link_occurred_idx on travels (link_id, occurred_at desc);

-- Alimenta o painel "Protecao": o que a Lumi barrou e quando.
create table security_events (
    id          uuid        primary key default gen_random_uuid(),
    kind        varchar(32) not null,
    user_id     uuid references users (id) on delete set null,
    link_id     uuid references links (id) on delete set null,
    detail      varchar(255),
    occurred_at timestamptz not null default now(),
    constraint security_events_kind check (
        kind in ('RATE_LIMIT', 'MALICIOUS_TARGET', 'INVALID_SCHEME', 'LOGIN_THROTTLED')
    )
);

create index security_events_occurred_idx on security_events (occurred_at desc);
create index security_events_user_occurred_idx on security_events (user_id, occurred_at desc);
