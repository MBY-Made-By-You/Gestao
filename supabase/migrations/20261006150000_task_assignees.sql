-- =============================================================================
-- MBY Gestão — 08. Vários responsáveis por tarefa
-- tasks.assignee_id dá lugar à tabela N:N task_assignees. Ao concluir a tarefa,
-- CADA responsável ganha o XP cheio dela (+50% se no prazo).
-- =============================================================================

create table public.task_assignees (
  task_id      uuid not null references public.tasks (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  primary key (task_id, user_id)
);
comment on table public.task_assignees is 'Responsáveis de cada tarefa (N:N); todos recebem o XP da tarefa.';
create index task_assignees_user_id_idx on public.task_assignees (user_id);

-- Um evento de XP por pessoa (antes: um por tarefa).
alter table public.xp_events drop constraint xp_events_task_reason_key;
alter table public.xp_events add constraint xp_events_task_user_reason_key unique (task_id, user_id, reason);

-- Responsáveis atuais viram a primeira linha de task_assignees (o XP já dado é mantido).
insert into public.task_assignees (task_id, user_id, assigned_at)
select t.id, t.assignee_id, t.updated_at from public.tasks t where t.assignee_id is not null;

-- Métricas da equipe passam a contar as tarefas em que a pessoa é responsável.
create or replace view public.member_stats
with (security_invoker = on) as
select
  pr.id as user_id,
  coalesce(xp.total_xp, 0)::integer as xp,
  coalesce(tk.completed, 0)::integer as tasks_completed,
  coalesce(tk.completed_on_time, 0)::integer as tasks_on_time,
  coalesce(tk.completed_with_due, 0)::integer as tasks_completed_with_due,
  coalesce(tk.open_tasks, 0)::integer as open_tasks,
  coalesce(tk.completed_last_30d, 0)::integer as tasks_completed_last_30d
from public.profiles pr
left join lateral (
  select sum(x.points) as total_xp from public.xp_events x where x.user_id = pr.id
) xp on true
left join lateral (
  select
    count(*) filter (where t.completed_at is not null) as completed,
    count(*) filter (
      where t.completed_at is not null and t.due_date is not null
        and (t.completed_at at time zone 'America/Sao_Paulo')::date <= t.due_date
    ) as completed_on_time,
    count(*) filter (where t.completed_at is not null and t.due_date is not null) as completed_with_due,
    count(*) filter (where t.completed_at is null and t.column_id is not null) as open_tasks,
    count(*) filter (where t.completed_at >= now() - interval '30 days') as completed_last_30d
  from public.task_assignees a
  join public.tasks t on t.id = a.task_id
  where a.user_id = pr.id
) tk on true;

alter table public.tasks drop column assignee_id;

-- -----------------------------------------------------------------------------
-- Gamificação: XP para cada responsável
-- -----------------------------------------------------------------------------
-- Concede o XP da tarefa concluída a um responsável (idempotente).
create or replace function private.grant_task_xp(p_task_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.xp_events (user_id, task_id, points, reason, on_time)
  select
    p_user_id,
    t.id,
    t.xp_reward + case when v.on_time then ceil(t.xp_reward * 0.5)::integer else 0 end,
    'task_completed',
    v.on_time
  from public.tasks t
  cross join lateral (
    select t.due_date is not null
           and (t.completed_at at time zone 'America/Sao_Paulo')::date <= t.due_date as on_time
  ) v
  where t.id = p_task_id and t.completed_at is not null
  on conflict (task_id, user_id, reason) do nothing;
end;
$$;
revoke all on function private.grant_task_xp(uuid, uuid) from public;

-- Concluir a tarefa dá XP a todos os responsáveis; reabrir estorna.
create or replace function private.tasks_award_xp()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_was_done boolean := tg_op = 'UPDATE' and old.completed_at is not null;
  v_is_done  boolean := new.completed_at is not null;
begin
  if v_is_done and not v_was_done then
    perform private.grant_task_xp(new.id, a.user_id)
       from public.task_assignees a
      where a.task_id = new.id;
  elsif v_was_done and not v_is_done then
    delete from public.xp_events x where x.task_id = new.id and x.reason = 'task_completed';
  end if;
  return null;
end;
$$;

-- Entrou/saiu um responsável: ajusta o XP se a tarefa já está concluída e
-- "toca" a tarefa para o Realtime avisar o quadro.
create or replace function private.task_assignees_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.grant_task_xp(new.task_id, new.user_id);
    update public.tasks t set updated_at = now() where t.id = new.task_id;
  else
    delete from public.xp_events x
     where x.task_id = old.task_id and x.user_id = old.user_id and x.reason = 'task_completed';
    update public.tasks t set updated_at = now() where t.id = old.task_id;
  end if;
  return null;
end;
$$;

create trigger task_assignees_after_change
  after insert or delete on public.task_assignees
  for each row execute function private.task_assignees_after_change();

-- -----------------------------------------------------------------------------
-- Segurança (mesmo modelo de task_tags)
-- -----------------------------------------------------------------------------
grant select, insert, delete on public.task_assignees to authenticated;
alter table public.task_assignees enable row level security;

-- Visível quando a tarefa é visível (a RLS de tasks se aplica na subconsulta).
create policy task_assignees_select on public.task_assignees
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_assignees_insert on public.task_assignees
  for insert to authenticated
  with check ((select private.is_staff()) and exists (select 1 from public.tasks t where t.id = task_id));
create policy task_assignees_delete on public.task_assignees
  for delete to authenticated using ((select private.is_staff()));
