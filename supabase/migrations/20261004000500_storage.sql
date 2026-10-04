-- =============================================================================
-- MBY Gestão — 05. Storage (imagens)
--
--   task-attachments (privado): {project_id}/{task_id}/{arquivo}
--     leitura  -> quem pode ver o projeto (URLs assinadas)
--     escrita  -> equipe interna, somente em tarefas que pertencem ao projeto
--   avatars (público): {user_id}/{arquivo}
--     escrita  -> apenas o próprio usuário, dentro da sua pasta
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('task-attachments', 'task-attachments', false, 10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']),
  ('avatars', 'avatars', true, 2097152,
    array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- CASE garante a ordem de avaliação: o caminho só é interpretado como uuid
-- para objetos do bucket correto.
create policy mby_objects_select on storage.objects
  for select to authenticated
  using (
    case bucket_id
      when 'task-attachments' then
        private.can_view_project(private.uuid_or_null((storage.foldername(name))[1]))
      when 'avatars' then true
      else false
    end
  );

create policy mby_objects_insert on storage.objects
  for insert to authenticated
  with check (
    case bucket_id
      when 'task-attachments' then
        (select private.is_staff())
        and private.task_in_project(
          private.uuid_or_null((storage.foldername(name))[2]),
          private.uuid_or_null((storage.foldername(name))[1])
        )
      when 'avatars' then
        (storage.foldername(name))[1] = (select auth.uid())::text
      else false
    end
  );

create policy mby_objects_update on storage.objects
  for update to authenticated
  using (
    case bucket_id
      when 'avatars' then (storage.foldername(name))[1] = (select auth.uid())::text
      else false
    end
  )
  with check (
    case bucket_id
      when 'avatars' then (storage.foldername(name))[1] = (select auth.uid())::text
      else false
    end
  );

create policy mby_objects_delete on storage.objects
  for delete to authenticated
  using (
    case bucket_id
      when 'task-attachments' then
        (select private.is_staff())
        and private.can_view_project(private.uuid_or_null((storage.foldername(name))[1]))
      when 'avatars' then
        (storage.foldername(name))[1] = (select auth.uid())::text
      else false
    end
  );
