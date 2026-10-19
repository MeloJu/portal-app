alter table users add column email_verified_at timestamptz;
update users set email_verified_at = created_at;

create table email_verification_tokens (
    id         uuid        primary key default gen_random_uuid(),
    user_id    uuid        not null references users (id) on delete cascade,
    token_hash char(64)    not null,
    expires_at timestamptz not null,
    used_at    timestamptz,
    created_at timestamptz not null default now(),
    constraint email_verification_tokens_hash_unique unique (token_hash)
);

create index email_verification_tokens_user_idx on email_verification_tokens (user_id);

create table account_codes (
    id         uuid        primary key default gen_random_uuid(),
    user_id    uuid        not null references users (id) on delete cascade,
    purpose    varchar(20) not null,
    code_hash  char(64)    not null,
    new_email  varchar(254),
    attempts   integer     not null default 0,
    expires_at timestamptz not null,
    used_at    timestamptz,
    created_at timestamptz not null default now(),
    constraint account_codes_purpose check (purpose in ('EMAIL_CHANGE', 'PASSWORD_CHANGE'))
);

create index account_codes_user_purpose_created_idx on account_codes (user_id, purpose, created_at desc);
