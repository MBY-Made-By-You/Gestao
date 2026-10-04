-- =============================================================================
-- MBY Gestão — 01. Schema principal
-- Tabelas, tipos enumerados, restrições de integridade e índices.
-- =============================================================================

-- Funções auxiliares e de gatilho ficam em um schema NÃO exposto pela API.
create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'member', 'viewer');
create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed', 'archived');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.sprint_status as enum ('planned', 'active', 'completed');
create type public.attachment_kind as enum ('reference', 'proof');
create type public.transaction_type as enum ('income', 'expense');
create type public.transaction_status as enum ('paid', 'pending');
create type public.movement_type as enum ('in', 'out');
create type public.event_type as enum ('event', 'meeting', 'milestone');

-- -----------------------------------------------------------------------------
-- Usuários e equipe
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  email       text,
  avatar_url  text,
  job_title   text check (char_length(job_title) <= 80),
  role        public.app_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Perfil público de cada usuário (1:1 com auth.users) e seu papel de acesso.';
comment on column public.profiles.role is 'admin: acesso total | member: equipe interna | viewer: cliente/visualizador (somente projetos em que é membro).';

-- -----------------------------------------------------------------------------
-- Projetos
-- -----------------------------------------------------------------------------
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 120),
  description  text check (char_length(description) <= 5000),
  client_name  text check (char_length(client_name) <= 120),
  color        text not null default '#0399FB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  status       public.project_status not null default 'active',
  start_date   date,
  due_date     date,
  budget       numeric(14, 2) check (budget >= 0),
  owner_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint projects_dates_check check (due_date is null or start_date is null or due_date >= start_date)
);
create index projects_owner_id_idx on public.projects (owner_id);
create index projects_status_idx on public.projects (status);

create table public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_id_idx on public.project_members (user_id);
comment on table public.project_members is 'Vínculo usuário ↔ projeto. Define o que clientes (viewer) conseguem enxergar.';

-- -----------------------------------------------------------------------------
-- Kanban: colunas personalizáveis por projeto
-- -----------------------------------------------------------------------------
create table public.board_columns (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  color       text not null default '#94A3B8' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position    double precision not null default 0,
  is_done     boolean not null default false,
  wip_limit   integer check (wip_limit is null or wip_limit > 0),
  created_at  timestamptz not null default now(),
  constraint board_columns_id_project_key unique (id, project_id)
);
create index board_columns_project_position_idx on public.board_columns (project_id, position);
comment on column public.board_columns.is_done is 'Tarefas nesta coluna são consideradas concluídas (gera completed_at e XP).';

-- -----------------------------------------------------------------------------
-- Sprints
-- -----------------------------------------------------------------------------
create table public.sprints (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  goal        text check (char_length(goal) <= 500),
  start_date  date not null,
  end_date    date not null,
  status      public.sprint_status not null default 'planned',
  created_at  timestamptz not null default now(),
  constraint sprints_dates_check check (end_date >= start_date),
  constraint sprints_id_project_key unique (id, project_id)
);
create index sprints_project_id_idx on public.sprints (project_id);
-- No máximo uma sprint ativa por projeto.
create unique index sprints_one_active_per_project on public.sprints (project_id) where status = 'active';

-- -----------------------------------------------------------------------------
-- Tarefas
--   column_id NULL  => tarefa está no backlog (fora do quadro).
--   position         => ordenação fracionária dentro da coluna/backlog.
--   xp_reward        => calculado (pontos × peso da prioridade); não editável.
-- -----------------------------------------------------------------------------
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  column_id     uuid,
  sprint_id     uuid,
  title         text not null check (char_length(title) between 1 and 200),
  description   text check (char_length(description) <= 10000),
  assignee_id   uuid references public.profiles (id) on delete set null,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  priority      public.task_priority not null default 'medium',
  due_date      date,
  story_points  smallint not null default 1 check (story_points between 0 and 21),
  xp_reward     integer generated always as (
                  story_points * case priority
                    when 'low' then 5
                    when 'medium' then 10
                    when 'high' then 15
                    else 20
                  end
                ) stored,
  position      double precision not null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint tasks_id_project_key unique (id, project_id),
  -- A coluna/sprint precisa pertencer ao MESMO projeto da tarefa.
  -- Ao excluir a coluna, apenas column_id vira NULL (tarefa volta ao backlog).
  constraint tasks_column_fkey foreign key (column_id, project_id)
    references public.board_columns (id, project_id) on delete set null (column_id),
  constraint tasks_sprint_fkey foreign key (sprint_id, project_id)
    references public.sprints (id, project_id) on delete set null (sprint_id)
);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_column_fkey_idx on public.tasks (column_id, project_id);
create index tasks_column_position_idx on public.tasks (column_id, position);
create index tasks_sprint_fkey_idx on public.tasks (sprint_id, project_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_created_by_idx on public.tasks (created_by);
create index tasks_due_date_open_idx on public.tasks (due_date) where completed_at is null;

-- -----------------------------------------------------------------------------
-- Etiquetas (tags)
-- -----------------------------------------------------------------------------
create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  color       text not null default '#0399FB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  constraint tags_project_name_key unique (project_id, name)
);

create table public.task_tags (
  task_id  uuid not null references public.tasks (id) on delete cascade,
  tag_id   uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);
create index task_tags_tag_id_idx on public.task_tags (tag_id);

-- -----------------------------------------------------------------------------
-- Anexos (imagens) — o arquivo vive no Storage, aqui ficam os metadados.
-- Caminho no bucket: {project_id}/{task_id}/{arquivo}
-- -----------------------------------------------------------------------------
create table public.task_attachments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null,
  project_id    uuid not null,
  storage_path  text not null unique,
  file_name     text not null check (char_length(file_name) between 1 and 255),
  mime_type     text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif')),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  width         integer check (width > 0),
  height        integer check (height > 0),
  kind          public.attachment_kind not null default 'reference',
  uploaded_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint task_attachments_task_fkey foreign key (task_id, project_id)
    references public.tasks (id, project_id) on delete cascade,
  constraint task_attachments_path_check
    check (storage_path like project_id::text || '/' || task_id::text || '/%')
);
create index task_attachments_task_fkey_idx on public.task_attachments (task_id, project_id);
create index task_attachments_uploaded_by_idx on public.task_attachments (uploaded_by);

-- -----------------------------------------------------------------------------
-- Gamificação: livro-razão de XP (alimentado apenas por gatilhos)
-- -----------------------------------------------------------------------------
create table public.xp_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  task_id     uuid references public.tasks (id) on delete cascade,
  points      integer not null,
  reason      text not null default 'task_completed',
  on_time     boolean,
  created_at  timestamptz not null default now(),
  constraint xp_events_task_reason_key unique (task_id, reason)
);
create index xp_events_user_id_idx on public.xp_events (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Financeiro
-- -----------------------------------------------------------------------------
create table public.finance_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  type        public.transaction_type not null,
  color       text not null default '#0399FB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  constraint finance_categories_name_type_key unique (name, type),
  constraint finance_categories_id_type_key unique (id, type)
);

create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  type         public.transaction_type not null,
  description  text not null check (char_length(description) between 1 and 200),
  amount       numeric(14, 2) not null check (amount > 0),
  occurred_on  date not null default current_date,
  status       public.transaction_status not null default 'paid',
  project_id   uuid references public.projects (id) on delete set null,
  category_id  uuid,
  notes        text check (char_length(notes) <= 2000),
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- A categoria precisa ser do mesmo tipo (receita/despesa) do lançamento.
  constraint transactions_category_fkey foreign key (category_id, type)
    references public.finance_categories (id, type) on delete set null (category_id)
);
comment on column public.transactions.project_id is 'NULL = custo/receita geral da equipe.';
create index transactions_occurred_on_idx on public.transactions (occurred_on desc);
create index transactions_project_id_idx on public.transactions (project_id);
create index transactions_category_fkey_idx on public.transactions (category_id, type);
create index transactions_created_by_idx on public.transactions (created_by);

-- Insumos / recursos físicos (estoque com custo médio ponderado)
create table public.resources (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 120),
  sku           text unique check (char_length(sku) <= 60),
  unit          text not null default 'un' check (char_length(unit) between 1 and 12),
  unit_cost     numeric(14, 4) not null default 0 check (unit_cost >= 0),
  quantity      numeric(14, 3) not null default 0 check (quantity >= 0),
  min_quantity  numeric(14, 3) not null default 0 check (min_quantity >= 0),
  supplier      text check (char_length(supplier) <= 120),
  notes         text check (char_length(notes) <= 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.resources.quantity is 'Saldo em estoque — mantido automaticamente pelas movimentações.';

create table public.resource_movements (
  id              uuid primary key default gen_random_uuid(),
  resource_id     uuid not null references public.resources (id) on delete cascade,
  project_id      uuid references public.projects (id) on delete set null,
  type            public.movement_type not null,
  quantity        numeric(14, 3) not null check (quantity > 0),
  unit_cost       numeric(14, 4) not null default 0 check (unit_cost >= 0),
  occurred_on     date not null default current_date,
  note            text check (char_length(note) <= 500),
  transaction_id  uuid references public.transactions (id) on delete set null,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
comment on table public.resource_movements is 'Entradas (compras) e saídas (consumo em projetos). Imutável: corrija excluindo e relançando.';
create index resource_movements_resource_id_idx on public.resource_movements (resource_id, occurred_on desc);
create index resource_movements_project_id_idx on public.resource_movements (project_id);
create index resource_movements_transaction_id_idx on public.resource_movements (transaction_id);
create index resource_movements_created_by_idx on public.resource_movements (created_by);

-- -----------------------------------------------------------------------------
-- Calendário: eventos, reuniões e marcos (milestones)
-- -----------------------------------------------------------------------------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 160),
  description  text check (char_length(description) <= 5000),
  type         public.event_type not null default 'event',
  project_id   uuid references public.projects (id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  all_day      boolean not null default false,
  location     text check (char_length(location) <= 300),
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint events_dates_check check (ends_at is null or ends_at >= starts_at)
);
create index events_starts_at_idx on public.events (starts_at);
create index events_project_id_idx on public.events (project_id);
create index events_created_by_idx on public.events (created_by);

create table public.event_attendees (
  event_id  uuid not null references public.events (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  primary key (event_id, user_id)
);
create index event_attendees_user_id_idx on public.event_attendees (user_id);
