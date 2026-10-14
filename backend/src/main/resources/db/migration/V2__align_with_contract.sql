alter table users rename column display_name to name;
update users set name = split_part(email, '@', 1) where name is null;
alter table users alter column name set not null;
alter table users alter column name type varchar(120);

alter table links rename column active to paused;
alter table links alter column paused drop default;
update links set paused = not paused;
alter table links alter column paused set default false;

alter table links add column closed_at timestamptz;
alter table links add column max_travels integer;
alter table links add column travel_count integer not null default 0;

alter table links add constraint links_max_travels_positive check (max_travels is null or max_travels >= 1);
alter table links add constraint links_travel_count_not_negative check (travel_count >= 0);

alter table links drop constraint links_code_format;
alter table links add constraint links_code_format check (code ~ '^[A-Za-z0-9-]{3,32}$');

create index links_owner_paused_idx on links (owner_id, paused);

alter table travels add column bot boolean not null default false;

create index travels_link_bot_idx on travels (link_id, bot);

alter table security_events rename to blocked_events;
alter table blocked_events rename column kind to reason;
alter table blocked_events drop constraint security_events_kind;

update blocked_events set reason = 'INVALID_URL' where reason = 'INVALID_SCHEME';
update blocked_events set reason = 'RATE_LIMIT' where reason = 'LOGIN_THROTTLED';
delete from blocked_events where reason not in
    ('INVALID_URL', 'SELF_LOOP', 'RESERVED_ALIAS', 'PAUSED', 'CLOSED', 'RATE_LIMIT');

alter table blocked_events add constraint blocked_events_reason check (
    reason in ('INVALID_URL', 'SELF_LOOP', 'RESERVED_ALIAS', 'PAUSED', 'CLOSED', 'RATE_LIMIT')
);

alter index security_events_occurred_idx rename to blocked_events_occurred_idx;
alter index security_events_user_occurred_idx rename to blocked_events_user_occurred_idx;
