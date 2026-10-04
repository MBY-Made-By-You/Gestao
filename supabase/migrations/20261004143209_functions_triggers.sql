-- =============================================================================
-- MBY Gestão — 02. Funções auxiliares, gatilhos e RPCs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funções auxiliares de autorização (usadas pelas políticas RLS).
-- SECURITY DEFINER + search_path vazio: leem profiles/project_members sem
-- recursão de RLS e não ficam expostas na API (schema private).
-- -----------------------------------------------------------------------------
create or replace function private.my_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function private.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.role in ('admin', 'member') from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function private.my_project_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.project_id from public.project_members m where m.user_id = (select auth.uid());
$$;

create or replace function private.can_view_project(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_project_id is not null and (
    private.is_staff()
    or exists (
      select 1 from public.project_members m
      where m.project_id = p_project_id and m.user_id = (select auth.uid())
    )
  );
$$;

create or replace function private.task_in_project(p_task_id uuid, p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.tasks t where t.id = p_task_id and t.project_id = p_project_id);
$$;

-- Converte texto em uuid sem lançar erro (para caminhos do Storage).
create or replace function private.uuid_or_null(p_value text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

-- "Hoje" no fuso da equipe (prazos são datas locais).
create or replace function private.local_today()
returns date
language sql stable set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_set_updated_at before update on public.projects
  for each row execute function private.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function private.set_updated_at();
create trigger resources_set_updated_at before update on public.resources
  for each row execute function private.set_updated_at();
create trigger events_set_updated_at before update on public.events
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Cadastro: cria o perfil ao registrar um usuário no Supabase Auth.
-- O PRIMEIRO usuário vira admin; os demais entram como viewer (menor
-- privilégio) até um admin promovê-los.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.app_role := 'viewer';
begin
  if not exists (select 1 from public.profiles) then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, full_name, email, avatar_url, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), ''),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url',
    v_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Mantém o e-mail do perfil sincronizado com o Auth.
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    perform set_config('app.sync_auth_email', 'on', true);
    update public.profiles set email = new.email where id = new.id;
    perform set_config('app.sync_auth_email', 'off', true);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- Protege campos sensíveis do perfil: só admin muda papéis e sempre deve
-- existir ao menos um admin. Acesso direto ao banco (sem JWT) é permitido.
create or replace function private.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  new.id := old.id;
  new.created_at := old.created_at;
  if coalesce(current_setting('app.sync_auth_email', true), 'off') <> 'on' then
    new.email := old.email;
  end if;

  if new.role is distinct from old.role then
    if v_uid is not null and not private.is_admin() then
      raise exception 'Apenas administradores podem alterar perfis de acesso.'
        using errcode = '42501';
    end if;
    if old.role = 'admin' and not exists (
      select 1 from public.profiles p where p.role = 'admin' and p.id <> old.id
    ) then
      raise exception 'A equipe precisa de pelo menos um administrador.'
        using errcode = 'P0001';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();

-- -----------------------------------------------------------------------------
-- Projetos: colunas padrão do Kanban + criador como membro
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_project()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.board_columns (project_id, name, color, position, is_done) values
    (new.id, 'A Fazer',      '#94A3B8', 1024, false),
    (new.id, 'Em Andamento', '#0399FB', 2048, false),
    (new.id, 'Revisão',      '#8B5CF6', 3072, false),
    (new.id, 'Concluído',    '#22C55E', 4096, true);

  if new.owner_id is not null then
    insert into public.project_members (project_id, user_id)
    values (new.id, new.owner_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row execute function private.handle_new_project();

-- -----------------------------------------------------------------------------
-- Tarefas: posição inicial, completed_at derivado da coluna e updated_at
-- -----------------------------------------------------------------------------
create or replace function private.tasks_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_done boolean;
begin
  -- Posição padrão: final da coluna (ou do backlog).
  if new.position is null then
    select coalesce(max(t.position), 0) + 1024
      into new.position
      from public.tasks t
     where t.project_id = new.project_id
       and t.column_id is not distinct from new.column_id;
  end if;

  -- completed_at segue a coluna: coluna "concluída" => data de conclusão.
  if tg_op = 'INSERT' or new.column_id is distinct from old.column_id then
    select c.is_done into v_done from public.board_columns c where c.id = new.column_id;
    if coalesce(v_done, false) then
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completed_at := null;
    end if;
  elsif coalesce(current_setting('app.column_done_sync', true), 'off') <> 'on' then
    -- completed_at não é editável manualmente; só a coluna define a conclusão.
    new.completed_at := old.completed_at;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

-- Quando uma coluna muda de "concluída" para "aberta" (ou vice-versa),
-- atualiza a data de conclusão das tarefas que estão nela.
create or replace function private.board_columns_after_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_done is distinct from old.is_done then
    perform set_config('app.column_done_sync', 'on', true);
    update public.tasks t
       set completed_at = case when new.is_done then coalesce(t.completed_at, now()) else null end
     where t.column_id = new.id;
    perform set_config('app.column_done_sync', 'off', true);
  end if;
  return new;
end;
$$;

create trigger board_columns_after_update
  after update of is_done on public.board_columns
  for each row execute function private.board_columns_after_update();

-- -----------------------------------------------------------------------------
-- Gamificação: XP ao concluir tarefas (+50% se entregue no prazo)
-- -----------------------------------------------------------------------------
create or replace function private.tasks_award_xp()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_was_done boolean := tg_op = 'UPDATE' and old.completed_at is not null;
  v_is_done  boolean := new.completed_at is not null;
  v_on_time  boolean;
begin
  if v_is_done and new.assignee_id is not null
     and (not v_was_done or new.assignee_id is distinct from old.assignee_id) then
    delete from public.xp_events x where x.task_id = new.id and x.reason = 'task_completed';
    v_on_time := new.due_date is not null
                 and (new.completed_at at time zone 'America/Sao_Paulo')::date <= new.due_date;
    insert into public.xp_events (user_id, task_id, points, reason, on_time)
    values (
      new.assignee_id,
      new.id,
      new.xp_reward + case when v_on_time then ceil(new.xp_reward * 0.5)::integer else 0 end,
      'task_completed',
      v_on_time
    );
  elsif v_was_done and (not v_is_done or new.assignee_id is null) then
    -- Tarefa reaberta (ou sem responsável): o XP é estornado.
    delete from public.xp_events x where x.task_id = new.id and x.reason = 'task_completed';
  end if;
  return null;
end;
$$;

-- Sem "update of <colunas>": completed_at costuma ser alterado pelo gatilho
-- BEFORE (ao mover a tarefa de coluna), e gatilhos por coluna não enxergam isso.
create trigger tasks_award_xp
  after insert or update on public.tasks
  for each row execute function private.tasks_award_xp();

-- -----------------------------------------------------------------------------
-- Estoque de insumos: saldo e custo médio ponderado mantidos por gatilho
-- -----------------------------------------------------------------------------
create or replace function private.resource_movements_apply()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_resource public.resources%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into v_resource from public.resources r where r.id = new.resource_id for update;

    if new.type = 'in' then
      update public.resources r
         set unit_cost = case
               when r.quantity + new.quantity > 0
                 then round(((r.quantity * r.unit_cost) + (new.quantity * new.unit_cost)) / (r.quantity + new.quantity), 4)
               else new.unit_cost
             end,
             quantity = r.quantity + new.quantity
       where r.id = new.resource_id;
    else
      if v_resource.quantity < new.quantity then
        raise exception 'Estoque insuficiente de "%": disponível % %, solicitado % %.',
          v_resource.name, trim_scale(v_resource.quantity), v_resource.unit,
          trim_scale(new.quantity), v_resource.unit
          using errcode = 'P0001';
      end if;
      update public.resources r
         set quantity = r.quantity - new.quantity
       where r.id = new.resource_id;
    end if;
    return new;
  end if;

  -- DELETE: estorna o efeito da movimentação.
  select * into v_resource from public.resources r where r.id = old.resource_id for update;
  if not found then
    return old; -- recurso sendo excluído em cascata
  end if;
  if old.type = 'in' then
    if v_resource.quantity < old.quantity then
      raise exception 'Não é possível estornar a entrada: parte do estoque de "%" já foi consumida.', v_resource.name
        using errcode = 'P0001';
    end if;
    update public.resources r set quantity = r.quantity - old.quantity where r.id = old.resource_id;
  else
    update public.resources r set quantity = r.quantity + old.quantity where r.id = old.resource_id;
  end if;
  return old;
end;
$$;

-- Saídas usam o custo médio atual do insumo.
create or replace function private.resource_movements_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.type = 'out' then
    select r.unit_cost into new.unit_cost from public.resources r where r.id = new.resource_id;
  end if;
  return new;
end;
$$;

create trigger resource_movements_before_insert
  before insert on public.resource_movements
  for each row execute function private.resource_movements_before_insert();

create trigger resource_movements_apply
  after insert or delete on public.resource_movements
  for each row execute function private.resource_movements_apply();

-- -----------------------------------------------------------------------------
-- RPCs públicas (SECURITY INVOKER: respeitam RLS do chamador)
-- -----------------------------------------------------------------------------

-- Renumera as posições de uma coluna (ou do backlog do projeto) quando o
-- espaço entre posições fracionárias fica pequeno demais.
create or replace function public.rebalance_task_positions(p_project_id uuid, p_column_id uuid default null)
returns void
language sql security invoker set search_path = ''
as $$
  update public.tasks t
     set position = s.rn * 1024
    from (
      select x.id, row_number() over (order by x.position, x.created_at) as rn
        from public.tasks x
       where x.project_id = p_project_id
         and x.column_id is not distinct from p_column_id
    ) s
   where t.id = s.id;
$$;
