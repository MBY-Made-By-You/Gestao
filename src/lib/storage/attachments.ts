import type { BrowserSupabaseClient } from "@/lib/supabase/client";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { AttachmentKind, TaskAttachment } from "@/lib/types";

export const ATTACHMENTS_BUCKET = "task-attachments";
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly aborted = false,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Upload direto do navegador para o Supabase Storage com progresso real.
 * O supabase-js usa fetch (sem eventos de progresso), então aqui usamos
 * XMLHttpRequest contra a mesma API REST — mesmo formato multipart que o SDK
 * envia — com o JWT do usuário: a RLS de storage.objects decide se pode gravar.
 */
export function uploadWithProgress({
  accessToken,
  bucket,
  path,
  file,
  onProgress,
  signal,
}: {
  accessToken: string;
  bucket: string;
  path: string;
  file: Blob;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeStoragePath(path)}`);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      let message = `Falha no upload (HTTP ${xhr.status}).`;
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        const raw = body.message ?? body.error ?? "";
        if (/row-level security|unauthorized|403/i.test(raw)) message = "Você não tem permissão para anexar imagens nesta tarefa.";
        else if (/payload too large|exceeded the maximum/i.test(raw)) message = "A imagem excede o limite de 10 MB.";
        else if (/mime type/i.test(raw)) message = "Formato de imagem não permitido.";
        else if (raw) message = raw;
      } catch {
        // resposta não-JSON
      }
      reject(new UploadError(message, xhr.status));
    };
    xhr.onerror = () => reject(new UploadError("Erro de rede durante o upload."));
    xhr.onabort = () => reject(new UploadError("Upload cancelado.", undefined, true));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}

export type AttachmentWithUrl = TaskAttachment & { url: string | null };

/** URLs assinadas (bucket privado) para várias imagens de uma vez. */
export async function signAttachmentUrls(
  supabase: BrowserSupabaseClient,
  attachments: TaskAttachment[],
): Promise<AttachmentWithUrl[]> {
  if (!attachments.length) return [];
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrls(
      attachments.map((a) => a.storage_path),
      SIGNED_URL_TTL_SECONDS,
    );
  if (error) throw error;
  const byPath = new Map((data ?? []).map((item) => [item.path, item.signedUrl]));
  return attachments.map((a) => ({ ...a, url: byPath.get(a.storage_path) ?? null }));
}

export async function listTaskAttachments(supabase: BrowserSupabaseClient, taskId: string) {
  const { data, error } = await supabase
    .from("task_attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return signAttachmentUrls(supabase, data ?? []);
}

export async function insertAttachmentRecord(
  supabase: BrowserSupabaseClient,
  record: {
    taskId: string;
    projectId: string;
    path: string;
    fileName: string;
    mimeType: string;
    size: number;
    width: number | null;
    height: number | null;
    kind: AttachmentKind;
    uploadedBy: string;
  },
) {
  const { data, error } = await supabase
    .from("task_attachments")
    .insert({
      task_id: record.taskId,
      project_id: record.projectId,
      storage_path: record.path,
      file_name: record.fileName,
      mime_type: record.mimeType,
      size_bytes: record.size,
      width: record.width,
      height: record.height,
      kind: record.kind,
      uploaded_by: record.uploadedBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Remove o arquivo do Storage e depois o registro (ordem evita órfãos visíveis). */
export async function deleteAttachment(supabase: BrowserSupabaseClient, attachment: TaskAttachment) {
  const { error: storageError } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove([attachment.storage_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("task_attachments").delete().eq("id", attachment.id);
  if (error) throw error;
}

export async function removeStorageObject(supabase: BrowserSupabaseClient, path: string) {
  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
}
