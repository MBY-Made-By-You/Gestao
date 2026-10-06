-- =============================================================================
-- MBY Gestão — 07. Atas de eventos e reuniões
-- Uma ata por evento: o que foi discutido, decisões, aprendizados e próximos
-- passos. Visível para a equipe interna e para os participantes do evento.
-- =============================================================================

create table public.event_minutes (
  event_id    uuid primary key references public.events (id) on delete cascade,
  summary     text check (char_length(summary) <= 20000),
  decisions   text check (char_length(decisions) <= 10000),
  learnings   text check (char_length(learnings) <= 10000),
  next_steps  text check (char_length(next_steps) <= 10000),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.event_minutes is 'Ata de um evento/reunião/marco (1:1 com events).';
create index event_minutes_created_by_idx on public.event_minutes (created_by);
create index event_minutes_updated_by_idx on public.event_minutes (updated_by);

-- Quem editou por último e quando (não editável pelo cliente).
create or replace function private.event_minutes_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger event_minutes_touch
  before insert or update on public.event_minutes
  for each row execute function private.event_minutes_touch();

-- -----------------------------------------------------------------------------
-- Segurança
-- -----------------------------------------------------------------------------
-- Participante do evento (sem passar pela RLS de event_attendees).
create or replace function private.is_event_attendee(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.event_attendees a
     where a.event_id = p_event_id and a.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_event_attendee(uuid) from public;
grant execute on function private.is_event_attendee(uuid) to authenticated;

grant select, insert, update, delete on public.event_minutes to authenticated;
revoke truncate, references, trigger on public.event_minutes from authenticated;
alter table public.event_minutes enable row level security;

create policy event_minutes_select on public.event_minutes
  for select to authenticated
  using ((select private.is_staff()) or private.is_event_attendee(event_id));

create policy event_minutes_insert on public.event_minutes
  for insert to authenticated
  with check ((select private.is_staff()) and exists (select 1 from public.events e where e.id = event_id));

create policy event_minutes_update on public.event_minutes
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy event_minutes_delete on public.event_minutes
  for delete to authenticated
  using ((select private.is_staff()));
