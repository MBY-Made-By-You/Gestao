-- =============================================================================
-- MBY Gestão — 03. Views analíticas
-- Todas com security_invoker: respeitam a RLS de quem consulta.
-- =============================================================================

-- Progresso de cada projeto (tarefas e pontos).
create view public.project_progress
with (security_invoker = on) as
select
  p.id as project_id,
  count(t.id)::integer as total_tasks,
  (count(t.id) filter (where t.completed_at is not null))::integer as done_tasks,
  (count(t.id) filter (where t.column_id is null and t.completed_at is null))::integer as backlog_tasks,
  coalesce(sum(t.story_points), 0)::integer as total_points,
  coalesce(sum(t.story_points) filter (where t.completed_at is not null), 0)::integer as done_points,
  (count(t.id) filter (
    where t.completed_at is null and t.due_date < private.local_today()
  ))::integer as overdue_tasks
from public.projects p
left join public.tasks t on t.project_id = p.id
group by p.id;

-- Métricas individuais para a página da equipe (gamificação).
create view public.member_stats
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
  from public.tasks t
  where t.assignee_id = pr.id
) tk on true;

-- Resumo financeiro mensal (histórico de receitas x despesas).
create view public.finance_monthly
with (security_invoker = on) as
select
  date_trunc('month', t.occurred_on)::date as month,
  coalesce(sum(t.amount) filter (where t.type = 'income' and t.status = 'paid'), 0)::numeric(14, 2) as income,
  coalesce(sum(t.amount) filter (where t.type = 'expense' and t.status = 'paid'), 0)::numeric(14, 2) as expense,
  coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end) filter (where t.status = 'paid'), 0)::numeric(14, 2) as balance,
  coalesce(sum(t.amount) filter (where t.type = 'income' and t.status = 'pending'), 0)::numeric(14, 2) as pending_income,
  coalesce(sum(t.amount) filter (where t.type = 'expense' and t.status = 'pending'), 0)::numeric(14, 2) as pending_expense
from public.transactions t
group by 1;

-- Visão financeira por projeto: orçamento, receitas, despesas e custo de
-- materiais consumidos (saídas de insumos).
create view public.project_financials
with (security_invoker = on) as
select
  p.id as project_id,
  p.budget,
  coalesce(tx.income, 0)::numeric(14, 2) as income,
  coalesce(tx.expense, 0)::numeric(14, 2) as expense,
  coalesce(mv.materials_cost, 0)::numeric(14, 2) as materials_cost,
  (coalesce(tx.expense, 0) + coalesce(mv.materials_cost, 0))::numeric(14, 2) as total_cost
from public.projects p
left join lateral (
  select
    sum(t.amount) filter (where t.type = 'income') as income,
    sum(t.amount) filter (where t.type = 'expense') as expense
  from public.transactions t
  where t.project_id = p.id and t.status = 'paid'
) tx on true
left join lateral (
  select sum(m.quantity * m.unit_cost) as materials_cost
  from public.resource_movements m
  where m.project_id = p.id and m.type = 'out'
) mv on true;
