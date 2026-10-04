-- =============================================================================
-- MBY Gestão — 06. Realtime e dados de referência
-- =============================================================================

-- Kanban colaborativo: alterações em tarefas/colunas chegam em tempo real
-- (o Realtime respeita a RLS de cada assinante).
alter table public.tasks replica identity full;
alter table public.board_columns replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board_columns'
  ) then
    alter publication supabase_realtime add table public.board_columns;
  end if;
end;
$$;

-- Categorias financeiras padrão.
insert into public.finance_categories (name, type, color) values
  ('Venda de produtos',      'income',  '#22C55E'),
  ('Serviços',               'income',  '#0399FB'),
  ('Patrocínio',             'income',  '#8B5CF6'),
  ('Investimento',           'income',  '#14B8A6'),
  ('Outras receitas',        'income',  '#64748B'),
  ('Materiais e insumos',    'expense', '#F97316'),
  ('Software e assinaturas', 'expense', '#0399FB'),
  ('Marketing',              'expense', '#EC4899'),
  ('Transporte',             'expense', '#EAB308'),
  ('Alimentação',            'expense', '#EF4444'),
  ('Infraestrutura',         'expense', '#6366F1'),
  ('Impostos e taxas',       'expense', '#78716C'),
  ('Outras despesas',        'expense', '#64748B')
on conflict (name, type) do nothing;
