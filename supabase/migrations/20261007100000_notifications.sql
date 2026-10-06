-- =============================================================================
-- MBY Gestão — 09. Notificações (no app e push no navegador/PWA)
--
-- * notifications: caixa de entrada de cada pessoa, preenchida só por gatilhos.
-- * push_subscriptions: navegadores/PWAs que aceitaram receber push.
-- * Cada notificação nova dispara (via pg_net) um POST para /api/push do app,
--   que entrega o Web Push. URL do app e segredo ficam no Vault:
--     select vault.create_secret('https://<app>', 'app_url');
--     select vault.create_secret('<segredo>', 'push_webhook_secret');
--   Sem pg_net/Vault (ex.: banco local), as notificações continuam no app.
-- * Lembretes diários (prazo hoje, eventos do dia) via pg_cron, se disponível.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
end;
$$;

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  type        text not null check (type in ('task_assigned', 'event_invite', 'minutes', 'xp', 'project_added', 'due_today', 'event_today', 'test')),
  title       text not null check (char_length(title) <= 200),
  body        text check (char_length(body) <= 500),
  url         text check (url like '/%'),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
comment on table public.notifications is 'Notificações de cada pessoa (escritas por gatilhos).';
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_actor_id_idx on public.notifications (actor_id);

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%'),
  p256dh      text not null,
  auth        text not null,
  user_agent  text check (char_length(user_agent) <= 400),
  created_at  timestamptz not null default now()
);
comment on table public.push_subscriptions is 'Inscrições de Web Push (um registro por navegador/dispositivo).';
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- -----------------------------------------------------------------------------
-- Criação de notificações
-- -----------------------------------------------------------------------------
-- Não notifica a própria pessoa pelo que ela mesma fez.
create or replace function private.notify(
  p_user_id uuid, p_type text, p_title text, p_body text, p_url text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if p_user_id is null or p_user_id is not distinct from v_actor then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, type, title, body, url)
  values (p_user_id, v_actor, p_type, left(p_title, 200), left(p_body, 500), p_url);
end;
$$;
revoke all on function private.notify(uuid, text, text, text, text) from public;

-- Primeiro nome de quem fez a ação ("Ana"), ou "Alguém".
create or replace function private.actor_first_name()
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    nullif(split_part((select p.full_name from public.profiles p where p.id = (select auth.uid())), ' ', 1), ''),
    'Alguém'
  );
$$;

-- Data/hora do evento no fuso do app ("08/10 às 14:00" ou "08/10").
create or replace function private.event_when(p_starts_at timestamptz, p_all_day boolean)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_all_day then to_char(p_starts_at at time zone 'America/Sao_Paulo', 'DD/MM')
    else to_char(p_starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
  end;
$$;

create or replace function private.notify_task_assigned()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_task record;
begin
  select t.id, t.title, t.project_id, p.name as project_name
    into v_task
    from public.tasks t join public.projects p on p.id = t.project_id
   where t.id = new.task_id;
  if found then
    perform private.notify(
      new.user_id, 'task_assigned',
      private.actor_first_name() || ' te colocou como responsável',
      v_task.title || ' · ' || v_task.project_name,
      '/projects/' || v_task.project_id || '/board?task=' || v_task.id
    );
  end if;
  return null;
end;
$$;
create trigger task_assignees_notify
  after insert on public.task_assignees
  for each row execute function private.notify_task_assigned();

create or replace function private.notify_event_invite()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_event record;
begin
  select e.id, e.title, e.type, e.starts_at, e.all_day into v_event from public.events e where e.id = new.event_id;
  if found then
    perform private.notify(
      new.user_id, 'event_invite',
      private.actor_first_name() || ' te convidou: ' || v_event.title,
      case v_event.type when 'meeting' then 'Reunião' when 'milestone' then 'Marco' else 'Evento' end
        || ' em ' || private.event_when(v_event.starts_at, v_event.all_day),
      '/calendar?date=' || to_char(v_event.starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') || '&evento=' || v_event.id
    );
  end if;
  return null;
end;
$$;
create trigger event_attendees_notify
  after insert on public.event_attendees
  for each row execute function private.notify_event_invite();

create or replace function private.notify_minutes()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_event record;
begin
  select e.id, e.title, e.starts_at into v_event from public.events e where e.id = new.event_id;
  if found then
    perform private.notify(
      a.user_id, 'minutes',
      'Ata registrada: ' || v_event.title,
      private.actor_first_name() || ' registrou o que foi discutido e decidido.',
      '/calendar?date=' || to_char(v_event.starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
        || '&evento=' || v_event.id || '&aba=ata'
    )
    from public.event_attendees a
    where a.event_id = new.event_id;
  end if;
  return null;
end;
$$;
create trigger event_minutes_notify
  after insert on public.event_minutes
  for each row execute function private.notify_minutes();

create or replace function private.notify_xp()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_title text;
begin
  select t.title into v_title from public.tasks t where t.id = new.task_id;
  perform private.notify(
    new.user_id, 'xp',
    '+' || new.points || ' XP' || case when new.on_time then ' (no prazo!)' else '' end,
    'Tarefa concluída: ' || coalesce(v_title, 'tarefa'),
    '/team/' || new.user_id
  );
  return null;
end;
$$;
create trigger xp_events_notify
  after insert on public.xp_events
  for each row execute function private.notify_xp();

create or replace function private.notify_project_added()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  select p.name into v_name from public.projects p where p.id = new.project_id;
  perform private.notify(
    new.user_id, 'project_added',
    'Você entrou no projeto ' || coalesce(v_name, ''),
    private.actor_first_name() || ' te adicionou à equipe do projeto.',
    '/projects/' || new.project_id
  );
  return null;
end;
$$;
create trigger project_members_notify
  after insert on public.project_members
  for each row execute function private.notify_project_added();

-- Lembretes do dia (rodado pelo pg_cron de manhã): prazos de hoje e eventos de hoje.
create or replace function private.notify_daily_reminders()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  insert into public.notifications (user_id, type, title, body, url)
  select a.user_id, 'due_today', 'Prazo hoje: ' || left(t.title, 180), p.name,
         '/projects/' || t.project_id || '/board?task=' || t.id
    from public.tasks t
    join public.task_assignees a on a.task_id = t.id
    join public.projects p on p.id = t.project_id
   where t.due_date = v_today and t.completed_at is null and t.column_id is not null;

  insert into public.notifications (user_id, type, title, body, url)
  select a.user_id, 'event_today', 'Hoje: ' || left(e.title, 180),
         case when e.all_day then 'Dia inteiro'
              else 'Às ' || to_char(e.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI') end
           || coalesce(' · ' || e.location, ''),
         '/calendar?date=' || v_today || '&evento=' || e.id
    from public.events e
    join public.event_attendees a on a.event_id = e.id
   where (e.starts_at at time zone 'America/Sao_Paulo')::date = v_today;
end;
$$;
revoke all on function private.notify_daily_reminders() from public;

-- -----------------------------------------------------------------------------
-- Entrega por push: cada notificação vira um POST para /api/push do app
-- -----------------------------------------------------------------------------
create or replace function private.vault_secret(p_name text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_value text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_value using p_name;
  return v_value;
end;
$$;
revoke all on function private.vault_secret(text) from public;

create or replace function private.dispatch_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
  v_subs   jsonb;
begin
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return null;
  end if;
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    into v_subs
    from public.push_subscriptions s
   where s.user_id = new.user_id;
  if v_subs is null then
    return null;
  end if;
  v_url := private.vault_secret('app_url');
  v_secret := private.vault_secret('push_webhook_secret');
  if v_url is null or v_secret is null then
    return null;
  end if;

  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
    using
      rtrim(v_url, '/') || '/api/push',
      jsonb_build_object(
        'notification', jsonb_build_object(
          'id', new.id, 'type', new.type, 'title', new.title, 'body', new.body, 'url', new.url
        ),
        'subscriptions', v_subs
      ),
      jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret);
  return null;
exception when others then
  -- Push é "melhor esforço": nunca impede a notificação de ser gravada.
  raise warning 'dispatch_push: %', sqlerrm;
  return null;
end;
$$;
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function private.dispatch_push();

-- -----------------------------------------------------------------------------
-- RPCs usadas pelo app
-- -----------------------------------------------------------------------------
-- Registra (ou transfere para quem está logado) a inscrição deste navegador.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_user, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 400))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- Notificação de teste para a própria pessoa.
create or replace function public.send_test_notification()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.notifications (user_id, actor_id, type, title, body, url)
  values ((select auth.uid()), null, 'test', 'Notificações ativadas',
          'É assim que os avisos do MBY Gestão vão aparecer.', '/dashboard');
end;
$$;
revoke all on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;

-- Chamado pelo /api/push para remover inscrições expiradas (protegido pelo segredo).
create or replace function public.prune_push_subscriptions(p_secret text, p_endpoints text[])
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_expected text := private.vault_secret('push_webhook_secret');
  v_count integer;
begin
  if v_expected is null or p_secret is distinct from v_expected then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.push_subscriptions s where s.endpoint = any (p_endpoints);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.prune_push_subscriptions(text, text[]) from public;
grant execute on function public.prune_push_subscriptions(text, text[]) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Segurança
-- -----------------------------------------------------------------------------
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, delete on public.push_subscriptions to authenticated;
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Realtime e agendamento
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  -- Todo dia às 07:50 (Brasília) = 10:50 UTC.
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('mby-daily-reminders', '50 10 * * *', 'select private.notify_daily_reminders()');
  end if;
end;
$$;
