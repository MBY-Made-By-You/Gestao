"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACCEPT_ATTRIBUTE } from "@/lib/storage/images";
import type { AttachmentKind } from "@/lib/types";
import { cn } from "@/lib/utils";

function imageFilesFrom(list: DataTransferItemList | null | undefined, files: FileList | null | undefined): File[] {
  const result: File[] = [];
  if (files?.length) {
    for (const file of Array.from(files)) if (file.type.startsWith("image/")) result.push(file);
  }
  if (!result.length && list) {
    for (const item of Array.from(list)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file && file.type.startsWith("image/")) result.push(file);
      }
    }
  }
  return result;
}

/**
 * Área de envio: arrastar e soltar, colar do clipboard (Ctrl+V), escolher
 * arquivos ou tirar foto (celular). O tipo escolhido vale para os próximos envios.
 */
export function AttachmentDropzone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[], kind: AttachmentKind) => void;
  disabled?: boolean;
}) {
  const [kind, setKind] = useState<AttachmentKind>("reference");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const kindRef = useRef(kind);

  useEffect(() => {
    kindRef.current = kind;
  }, [kind]);

  // Colar imagens (prints de tela) em qualquer lugar enquanto a tarefa está aberta.
  useEffect(() => {
    if (disabled) return;
    function onPaste(event: ClipboardEvent) {
      const files = imageFilesFrom(event.clipboardData?.items, event.clipboardData?.files);
      if (!files.length) return;
      event.preventDefault();
      onFiles(files, kindRef.current);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled, onFiles]);

  if (disabled) return null;

  return (
    <div className="space-y-3">
      <ToggleGroup
        type="single"
        value={kind}
        onValueChange={(value) => value && setKind(value as AttachmentKind)}
        aria-label="Tipo do anexo"
        className="w-full"
      >
        <ToggleGroupItem value="reference" className="flex-1">
          Referência visual
        </ToggleGroupItem>
        <ToggleGroupItem value="proof" className="flex-1">
          Comprovação de conclusão
        </ToggleGroupItem>
      </ToggleGroup>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          const files = imageFilesFrom(e.dataTransfer.items, e.dataTransfer.files);
          if (files.length) onFiles(files, kind);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 py-6 text-center transition-colors",
          dragging && "border-brand bg-brand-soft/60",
        )}
      >
        <span
          className={cn(
            "grid size-11 place-items-center rounded-2xl bg-card text-brand shadow-sm ring-1 ring-border transition-transform",
            dragging && "scale-110",
          )}
        >
          <UploadCloud className="size-5" />
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">
            {dragging ? "Solte as imagens aqui" : "Arraste imagens, cole com Ctrl+V ou"}
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WebP, GIF ou AVIF · otimizadas automaticamente (até 10 MB)
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
            <ImagePlus /> Escolher imagens
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="sm:hidden"
            onClick={() => cameraInput.current?.click()}
          >
            <Camera /> Tirar foto
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onFiles(Array.from(e.target.files), kind);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onFiles(Array.from(e.target.files), kind);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
