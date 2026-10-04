"use client";

import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { AttachmentWithUrl } from "@/lib/storage/attachments";

export function downloadUrl(attachment: AttachmentWithUrl) {
  if (!attachment.url) return undefined;
  const separator = attachment.url.includes("?") ? "&" : "?";
  return `${attachment.url}${separator}download=${encodeURIComponent(attachment.file_name)}`;
}

/** Visualizador em tela cheia com navegação por setas do teclado. */
export function ImageLightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: AttachmentWithUrl[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const current = index !== null ? items[index] : null;
  const go = useCallback(
    (delta: number) => {
      if (index === null || items.length < 2) return;
      onIndexChange((index + delta + items.length) % items.length);
    },
    [index, items.length, onIndexChange],
  );

  useEffect(() => {
    if (index === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  return (
    <Dialog open={current !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[92dvh] max-w-[min(1200px,96vw)] flex-col gap-0 overflow-hidden border-white/10 bg-[#05070b]/95 p-0 text-white sm:max-w-[min(1200px,96vw)]"
      >
        {current && (
          <>
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-sm font-bold text-white">{current.file_name}</DialogTitle>
                <DialogDescription className="text-xs text-white/60">
                  {current.kind === "proof" ? "Comprovação de conclusão" : "Referência visual"} ·{" "}
                  {current.width && current.height ? `${current.width}×${current.height} · ` : ""}
                  {formatBytes(current.size_bytes)} · {formatDateTime(current.created_at)}
                </DialogDescription>
              </div>
              <span className="text-xs text-white/60 tabular-nums">
                {(index ?? 0) + 1}/{items.length}
              </span>
              <a
                href={downloadUrl(current)}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/10"
                aria-label="Baixar imagem"
              >
                <Download className="size-4" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="grid size-9 place-items-center rounded-lg hover:bg-white/10"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
              {current.url ? (
                // URL assinada de bucket privado (expira) — sem otimização do next/image.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.url}
                  alt={current.file_name}
                  className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                />
              ) : (
                <p className="text-sm text-white/60">Não foi possível carregar a imagem.</p>
              )}
              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20"
                    aria-label="Imagem anterior"
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20"
                    aria-label="Próxima imagem"
                  >
                    <ChevronRight />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
