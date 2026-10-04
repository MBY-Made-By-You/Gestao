"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ATTACHMENTS_BUCKET,
  UploadError,
  deleteAttachment,
  insertAttachmentRecord,
  listTaskAttachments,
  removeStorageObject,
  signAttachmentUrls,
  uploadWithProgress,
  type AttachmentWithUrl,
} from "@/lib/storage/attachments";
import { MAX_UPLOAD_BYTES, buildAttachmentPath, prepareImageForUpload, validateImageFile } from "@/lib/storage/images";
import { createClient } from "@/lib/supabase/client";
import type { AttachmentKind } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

export type UploadStatus = "queued" | "processing" | "uploading" | "saving" | "error";

export type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  kind: AttachmentKind;
  status: UploadStatus;
  progress: number;
  error?: string;
};

const MAX_PARALLEL_UPLOADS = 3;

/**
 * Estado e operações dos anexos de uma tarefa.
 *
 * Fluxo de cada imagem:
 *   validar → (fila) → otimizar (redimensiona/WebP) → upload com progresso
 *   → registrar em task_attachments → URL assinada → aparece na galeria.
 * Se o registro no banco falhar, o arquivo enviado é removido (sem órfãos).
 */
export function useTaskAttachments({
  taskId,
  projectId,
  userId,
  onCountDelta,
}: {
  taskId: string;
  projectId: string;
  userId: string;
  onCountDelta?: (delta: number) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  const queue = useRef<UploadItem[]>([]);
  const running = useRef(0);
  const controllers = useRef(new Map<string, AbortController>());
  const previews = useRef(new Map<string, string>()); // uploadId -> objectURL
  const mounted = useRef(true);
  const uploadsRef = useRef<UploadItem[]>([]);
  const onCountDeltaRef = useRef(onCountDelta);

  useEffect(() => {
    onCountDeltaRef.current = onCountDelta;
  }, [onCountDelta]);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  const patchUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
    if (!mounted.current) return;
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const dropUpload = useCallback((id: string) => {
    const previewUrl = previews.current.get(id);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previews.current.delete(id);
    }
    controllers.current.delete(id);
    if (mounted.current) setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const [reloadKey, setReloadKey] = useState(0);

  // Carrega anexos existentes (com URLs assinadas do bucket privado).
  useEffect(() => {
    let cancelled = false;
    listTaskAttachments(supabase, taskId)
      .then((data) => {
        if (cancelled) return;
        setAttachments(data);
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, taskId, reloadKey]);

  // Ao desmontar: cancela envios em andamento e libera as pré-visualizações.
  useEffect(() => {
    mounted.current = true;
    const activeControllers = controllers.current;
    const activePreviews = previews.current;
    return () => {
      mounted.current = false;
      activeControllers.forEach((c) => c.abort());
      activePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const reload = useCallback(() => {
    setLoadState("loading");
    setReloadKey((k) => k + 1);
  }, []);

  const processUpload = useCallback(
    async (item: UploadItem) => {
      const controller = new AbortController();
      controllers.current.set(item.id, controller);
      let uploadedPath: string | null = null;

      try {
        patchUpload(item.id, { status: "processing", progress: 0, error: undefined });
        const prepared = await prepareImageForUpload(item.file);
        if (prepared.blob.size > MAX_UPLOAD_BYTES) {
          throw new UploadError("A imagem continua maior que 10 MB mesmo após a otimização.");
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new UploadError("Sua sessão expirou. Entre novamente.");

        const path = buildAttachmentPath(projectId, taskId, prepared.fileName, crypto.randomUUID());
        patchUpload(item.id, { status: "uploading" });
        await uploadWithProgress({
          accessToken: session.access_token,
          bucket: ATTACHMENTS_BUCKET,
          path,
          file: new File([prepared.blob], prepared.fileName, { type: prepared.type }),
          signal: controller.signal,
          onProgress: (fraction) => patchUpload(item.id, { progress: fraction }),
        });
        uploadedPath = path;

        patchUpload(item.id, { status: "saving", progress: 1 });
        const record = await insertAttachmentRecord(supabase, {
          taskId,
          projectId,
          path,
          fileName: prepared.fileName,
          mimeType: prepared.type,
          size: prepared.blob.size,
          width: prepared.width,
          height: prepared.height,
          kind: item.kind,
          uploadedBy: userId,
        });
        uploadedPath = null;
        const [signed] = await signAttachmentUrls(supabase, [record]);
        if (!mounted.current) return;
        setAttachments((prev) => [signed, ...prev]);
        onCountDeltaRef.current?.(1);
        dropUpload(item.id);
      } catch (error) {
        if (uploadedPath) await removeStorageObject(supabase, uploadedPath).catch(() => undefined);
        if (error instanceof UploadError && error.aborted) {
          dropUpload(item.id);
          return;
        }
        patchUpload(item.id, { status: "error", error: errorMessage(error, "Falha ao enviar a imagem.") });
      } finally {
        controllers.current.delete(item.id);
      }
    },
    [dropUpload, patchUpload, projectId, supabase, taskId, userId],
  );

  const pump = useCallback(() => {
    while (running.current < MAX_PARALLEL_UPLOADS && queue.current.length > 0) {
      const next = queue.current.shift()!;
      running.current += 1;
      void processUpload(next).finally(() => {
        running.current -= 1;
        pump();
      });
    }
  }, [processUpload]);

  const addFiles = useCallback(
    (fileList: FileList | File[], kind: AttachmentKind) => {
      const files = Array.from(fileList);
      const accepted: UploadItem[] = [];
      for (const file of files) {
        const invalid = validateImageFile(file);
        if (invalid) {
          toast.error(invalid.message);
          continue;
        }
        const id = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);
        previews.current.set(id, previewUrl);
        accepted.push({ id, file, previewUrl, kind, status: "queued", progress: 0 });
      }
      if (!accepted.length) return;
      setUploads((prev) => [...accepted, ...prev]);
      queue.current.push(...accepted);
      pump();
    },
    [pump],
  );

  const cancelUpload = useCallback(
    (id: string) => {
      const controller = controllers.current.get(id);
      if (controller) controller.abort();
      else {
        queue.current = queue.current.filter((u) => u.id !== id);
        dropUpload(id);
      }
    },
    [dropUpload],
  );

  const retryUpload = useCallback(
    (id: string) => {
      const item = uploadsRef.current.find((u) => u.id === id);
      if (!item || item.status !== "error") return;
      const reset: UploadItem = { ...item, status: "queued", progress: 0, error: undefined };
      setUploads((prev) => prev.map((u) => (u.id === id ? reset : u)));
      queue.current.push(reset);
      pump();
    },
    [pump],
  );

  const removeAttachment = useCallback(
    async (attachment: AttachmentWithUrl) => {
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      try {
        await deleteAttachment(supabase, attachment);
        onCountDeltaRef.current?.(-1);
        toast.success("Imagem removida");
      } catch (error) {
        setAttachments((prev) =>
          [...prev, attachment].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        );
        toast.error(errorMessage(error, "Não foi possível remover a imagem."));
      }
    },
    [supabase],
  );

  const setKind = useCallback(
    async (attachment: AttachmentWithUrl, kind: AttachmentKind) => {
      setAttachments((prev) => prev.map((a) => (a.id === attachment.id ? { ...a, kind } : a)));
      const { error } = await supabase.from("task_attachments").update({ kind }).eq("id", attachment.id);
      if (error) {
        setAttachments((prev) => prev.map((a) => (a.id === attachment.id ? { ...a, kind: attachment.kind } : a)));
        toast.error(errorMessage(error));
      }
    },
    [supabase],
  );

  return {
    attachments,
    uploads,
    loadState,
    isUploading: uploads.some((u) => u.status !== "error"),
    addFiles,
    cancelUpload,
    retryUpload,
    removeAttachment,
    setKind,
    reload,
  };
}
