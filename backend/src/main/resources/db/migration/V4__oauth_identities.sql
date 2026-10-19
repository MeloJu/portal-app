alter table users add column has_password boolean not null default true;

create table user_identities (
    id               uuid         primary key default gen_random_uuid(),
    user_id          uuid         not null references users (id) on delete cascade,
    provider         varchar(20)  not null,
    provider_user_id varchar(255) not null,
    created_at       timestamptz  not null default now(),
    constraint user_identities_provider_check check (provider in ('GOOGLE', 'GITHUB')),
    constraint user_identities_provider_user_unique unique (provider, provider_user_id)
);

create index user_identities_user_idx on user_identities (user_id);
