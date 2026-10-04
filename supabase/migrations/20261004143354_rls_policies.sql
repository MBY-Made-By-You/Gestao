-- =============================================================================
-- MBY Gestão — 04. Row Level Security
--
--   admin  : acesso total (inclui excluir lançamentos e gerenciar papéis)
--   member : equipe interna — cria/edita projetos, tarefas, finanças, eventos
--   viewer : cliente/visualizador — somente leitura dos projetos em que é
--            membro (project_members); sem acesso ao financeiro.
--
-- Uma política por tabela/comando (evita políticas permissivas duplicadas) e
-- chamadas a auth.uid()/helpers envoltas em SELECT (avaliadas 1x por consulta).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke truncate, references, trigger on all tables in schema public from authenticated;
grant execute on function public.rebalance_task_positions(uuid, uuid) to authenticated;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on function
  private.my_role(),
  private.is_admin(),
  private.is_staff(),
  private.my_project_ids(),
  private.can_view_project(uuid),
  private.task_in_project(uuid, uuid),
  private.uuid_or_null(text),
  private.local_today()
to authenticated;

-- Views são somente leitura.
revoke insert, update, delete on public.project_progress, public.member_stats,
  public.finance_monthly, public.project_financials from authenticated;

-- -----------------------------------------------------------------------------
-- Habilita RLS
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.projects            enable row level security;
alter table public.project_members     enable row level security;
alter table public.board_columns       enable row level security;
alter table public.sprints             enable row level security;
alter table public.tasks               enable row level security;
alter table public.tags                enable row level security;
alter table public.task_tags           enable row level security;
alter table public.task_attachments    enable row level security;
alter table public.xp_events           enable row level security;
alter table public.finance_categories  enable row level security;
alter table public.transactions        enable row level security;
alter table public.resources           enable row level security;
alter table public.resource_movements  enable row level security;
alter table public.events              enable row level security;
alter table public.event_attendees     enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- projects / project_members
-- -----------------------------------------------------------------------------
create policy projects_select on public.projects
  for select to authenticated
  using ((select private.is_staff()) or id in (select private.my_project_ids()));

create policy projects_insert on public.projects
  for insert to authenticated
  with check ((select private.is_staff()));

create policy projects_update on public.projects
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy projects_delete on public.projects
  for delete to authenticated
  using (
    (select private.is_admin())
    or ((select private.is_staff()) and owner_id = (select auth.uid()))
  );

create policy project_members_select on public.project_members
  for select to authenticated
  using ((select private.is_staff()) or project_id in (select private.my_project_ids()));

create policy project_members_insert on public.project_members
  for insert to authenticated
  with check ((select private.is_staff()));

create policy project_members_delete on public.project_members
  for delete to authenticated
  using ((select private.is_staff()));

-- -----------------------------------------------------------------------------
-- Kanban: colunas, sprints, tarefas, tags
-- -----------------------------------------------------------------------------
create policy board_columns_select on public.board_columns
  for select to authenticated
  using ((select private.is_staff()) or project_id in (select private.my_project_ids()));
create policy board_columns_insert on public.board_columns
  for insert to authenticated with check ((select private.is_staff()));
create policy board_columns_update on public.board_columns
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy board_columns_delete on public.board_columns
  for delete to authenticated using ((select private.is_staff()));

create policy sprints_select on public.sprints
  for select to authenticated
  using ((select private.is_staff()) or project_id in (select private.my_project_ids()));
create policy sprints_insert on public.sprints
  for insert to authenticated with check ((select private.is_staff()));
create policy sprints_update on public.sprints
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy sprints_delete on public.sprints
  for delete to authenticated using ((select private.is_staff()));

create policy tasks_select on public.tasks
  for select to authenticated
  using ((select private.is_staff()) or project_id in (select private.my_project_ids()));
create policy tasks_insert on public.tasks
  for insert to authenticated with check ((select private.is_staff()));
create policy tasks_update on public.tasks
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy tasks_delete on public.tasks
  for delete to authenticated using ((select private.is_staff()));

create policy tags_select on public.tags
  for select to authenticated
  using ((select private.is_staff()) or project_id in (select private.my_project_ids()));
create policy tags_insert on public.tags
  for insert to authenticated with check ((select private.is_staff()));
create policy tags_update on public.tags
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy tags_delete on public.tags
  for delete to authenticated using ((select private.is_staff()));

-- Visível quando a tarefa é visível (a RLS de tasks se aplica na subconsulta).
create policy task_tags_select on public.task_tags
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
-- A tag precisa ser do mesmo projeto da tarefa.
create policy task_tags_insert on public.task_tags
  for insert to authenticated
  with check (
    (select private.is_staff())
    and exists (
      select 1
        from public.tasks t
        join public.tags g on g.project_id = t.project_id
       where t.id = task_id and g.id = tag_id
    )
  );
create policy task_tags_delete on public.task_tags
  for delete to authenticated using ((select private.is_staff()));

-- -----------------------------------------------------------------------------
-- Anexos
-- -----------------------------------------------------------------------------
create policy task_attachments_select on public.task_attachments
  for select to authenticated
  using ((select private.is_staff()) or project_id in (select private.my_project_ids()));
create policy task_attachments_insert on public.task_attachments
  for insert to authenticated
  with check ((select private.is_staff()) and uploaded_by = (select auth.uid()));
create policy task_attachments_update on public.task_attachments
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy task_attachments_delete on public.task_attachments
  for delete to authenticated using ((select private.is_staff()));

-- -----------------------------------------------------------------------------
-- Gamificação (somente leitura via API; escrita apenas por gatilhos)
-- -----------------------------------------------------------------------------
create policy xp_events_select on public.xp_events
  for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- Financeiro e insumos (apenas equipe interna)
-- -----------------------------------------------------------------------------
create policy finance_categories_select on public.finance_categories
  for select to authenticated using ((select private.is_staff()));
create policy finance_categories_insert on public.finance_categories
  for insert to authenticated with check ((select private.is_staff()));
create policy finance_categories_update on public.finance_categories
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy finance_categories_delete on public.finance_categories
  for delete to authenticated using ((select private.is_admin()));

create policy transactions_select on public.transactions
  for select to authenticated using ((select private.is_staff()));
create policy transactions_insert on public.transactions
  for insert to authenticated with check ((select private.is_staff()));
create policy transactions_update on public.transactions
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy transactions_delete on public.transactions
  for delete to authenticated using ((select private.is_admin()));

create policy resources_select on public.resources
  for select to authenticated using ((select private.is_staff()));
create policy resources_insert on public.resources
  for insert to authenticated with check ((select private.is_staff()));
create policy resources_update on public.resources
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy resources_delete on public.resources
  for delete to authenticated using ((select private.is_admin()));

create policy resource_movements_select on public.resource_movements
  for select to authenticated using ((select private.is_staff()));
create policy resource_movements_insert on public.resource_movements
  for insert to authenticated with check ((select private.is_staff()));
create policy resource_movements_delete on public.resource_movements
  for delete to authenticated using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Calendário
-- -----------------------------------------------------------------------------
create policy event_attendees_select on public.event_attendees
  for select to authenticated
  using ((select private.is_staff()) or user_id = (select auth.uid()));
create policy event_attendees_insert on public.event_attendees
  for insert to authenticated with check ((select private.is_staff()));
create policy event_attendees_delete on public.event_attendees
  for delete to authenticated using ((select private.is_staff()));

create policy events_select on public.events
  for select to authenticated
  using (
    (select private.is_staff())
    or project_id in (select private.my_project_ids())
    or id in (select ea.event_id from public.event_attendees ea where ea.user_id = (select auth.uid()))
  );
create policy events_insert on public.events
  for insert to authenticated with check ((select private.is_staff()));
create policy events_update on public.events
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy events_delete on public.events
  for delete to authenticated using ((select private.is_staff()));
