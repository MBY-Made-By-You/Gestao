"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Download,
  ImageIcon,
  Loader2,
  Maximize2,
  MoreHorizontal,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";

import { AttachmentDropzone } from "@/components/tasks/attachments/attachment-dropzone";
import { ImageLightbox, downloadUrl } from "@/components/tasks/attachments/image-lightbox";
import { useTaskAttachments, type UploadItem } from "@/components/tasks/attachments/use-task-attachments";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/misc";
import { formatBytes, plural } from "@/lib/format";
import type { AttachmentWithUrl } from "@/lib/storage/attachments";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<UploadItem["status"], string> = {
  queued: "Na fila…",
  processing: "Otimizando…",
  uploading: "Enviando",
  saving: "Salvando…",
  error: "Falhou",
};

/**
 * Seção de anexos da tarefa: envio de imagens (referência ou comprovação),
 * galeria com miniaturas e visualizador em tela cheia.
 */
export function TaskAttachments({
  taskId,
  projectId,
  userId,
  canEdit,
  onCountDelta,
}: {
  taskId: string;
  projectId: string;
  userId: string;
  canEdit: boolean;
  onCountDelta?: (delta: number) => void;
}) {
  const { attachments, uploads, loadState, addFiles, cancelUpload, retryUpload, removeAttachment, setKind, reload } =
    useTaskAttachments({ taskId, projectId, userId, onCountDelta });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const proofCount = attachments.filter((a) => a.kind === "proof").length;

  return (
    <section className="space-y-3" aria-labelledby="attachments-title">
      <div className="flex items-center gap-2">
        <h3 id="attachments-title" className="flex items-center gap-2 text-sm font-bold">
          <ImageIcon className="size-4 text-brand" /> Anexos
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
          {attachments.length}
        </span>
        {proofCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-bold text-success">
            <BadgeCheck className="size-3" /> {plural(proofCount, "comprovação", "comprovações")}
          </span>
        )}
      </div>

      <AttachmentDropzone onFiles={addFiles} disabled={!canEdit} />

      {loadState === "loading" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      )}

      {loadState === "error" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <span className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" /> Não foi possível carregar os anexos.
          </span>
          <Button size="sm" variant="outline" onClick={reload}>
            <RotateCw /> Tentar de novo
          </Button>
        </div>
      )}

      {(uploads.length > 0 || attachments.length > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {uploads.map((upload) => (
            <UploadTile key={upload.id} upload={upload} onCancel={cancelUpload} onRetry={retryUpload} />
          ))}
          {attachments.map((attachment, index) => (
            <AttachmentTile
              key={attachment.id}
              attachment={attachment}
              canEdit={canEdit}
              onOpen={() => setLightboxIndex(index)}
              onRemove={() => void removeAttachment(attachment)}
              onToggleKind={() => void setKind(attachment, attachment.kind === "proof" ? "reference" : "proof")}
            />
          ))}
        </ul>
      )}

      {loadState === "ready" && attachments.length === 0 && uploads.length === 0 && !canEdit && (
        <p className="text-sm text-muted-foreground">Nenhuma imagem anexada.</p>
      )}

      <ImageLightbox
        items={attachments}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </section>
  );
}

function UploadTile({
  upload,
  onCancel,
  onRetry,
}: {
  upload: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const failed = upload.status === "error";
  const percent = Math.round(upload.progress * 100);
  return (
    <li className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted" aria-live="polite">
      {/* Pré-visualização local (object URL) enquanto envia. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={upload.previewUrl}
        alt={upload.file.name}
        className={cn("size-full object-cover transition", failed ? "opacity-30 grayscale" : "opacity-50 blur-[1px]")}
      />
      <div className="absolute inset-0 flex flex-col justify-end gap-1.5 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2.5 text-white">
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          {failed ? <AlertTriangle className="size-3.5 text-red-300" /> : <Loader2 className="size-3.5 animate-spin" />}
          <span className="truncate">
            {STATUS_LABEL[upload.status]}
            {upload.status === "uploading" ? ` ${percent}%` : ""}
          </span>
        </div>
        {failed ? (
          <p className="line-clamp-2 text-[11px] text-red-100">{upload.error}</p>
        ) : (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-white/25"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Enviando ${upload.file.name}`}
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-200"
              style={{ width: `${upload.status === "uploading" ? percent : upload.status === "saving" ? 100 : 6}%` }}
            />
          </div>
        )}
      </div>
      <div className="absolute top-1.5 right-1.5 flex gap-1">
        {failed && (
          <button
            type="button"
            onClick={() => onRetry(upload.id)}
            className="grid size-7 place-items-center rounded-lg bg-black/60 text-white backdrop-blur hover:bg-black/80"
            aria-label="Tentar novamente"
          >
            <RotateCw className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onCancel(upload.id)}
          className="grid size-7 place-items-center rounded-lg bg-black/60 text-white backdrop-blur hover:bg-black/80"
          aria-label={failed ? "Descartar" : "Cancelar envio"}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function AttachmentTile({
  attachment,
  canEdit,
  onOpen,
  onRemove,
  onToggleKind,
}: {
  attachment: AttachmentWithUrl;
  canEdit: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onToggleKind: () => void;
}) {
  const isProof = attachment.kind === "proof";
  return (
    <li className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
      <button type="button" onClick={onOpen} className="block size-full" aria-label={`Abrir ${attachment.file_name}`}>
        {attachment.url ? (
          // URL assinada de bucket privado — servida direto pelo Storage.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.url}
            alt={attachment.file_name}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            <ImageIcon className="size-6" />
          </span>
        )}
      </button>

      <span
        className={cn(
          "pointer-events-none absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold shadow-sm",
          isProof ? "bg-success text-white" : "bg-card/90 text-foreground backdrop-blur",
        )}
      >
        {isProof && <BadgeCheck className="size-3" />}
        {isProof ? "Comprovação" : "Referência"}
      </span>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <p className="truncate text-[11px] font-semibold">{attachment.file_name}</p>
        <p className="text-[10px] text-white/70">{formatBytes(attachment.size_bytes)}</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-lg bg-black/55 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            aria-label={`Ações para ${attachment.file_name}`}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onOpen}>
            <Maximize2 /> Ver em tela cheia
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={downloadUrl(attachment)}>
              <Download /> Baixar
            </a>
          </DropdownMenuItem>
          {canEdit && (
            <>
              <DropdownMenuItem onSelect={onToggleKind}>
                <BadgeCheck /> {isProof ? "Marcar como referência" : "Marcar como comprovação"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                <Trash2 /> Excluir imagem
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
