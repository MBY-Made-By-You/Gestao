"use client";

import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, RotateCw, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/**
 * Recorte da foto de perfil: arrastar para posicionar, zoom (roda do mouse,
 * pinça ou controle deslizante) e girar. Gera um quadrado WebP de 512 px.
 */
export function AvatarCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // Cada arquivo novo começa centralizado e sem zoom.
  const [shownFile, setShownFile] = useState<File | null>(null);
  if (file !== shownFile) {
    setShownFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setArea(null);
  }

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL temporária ligada ao ciclo de vida do arquivo
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function confirm() {
    if (!imageUrl || !area) return;
    setSaving(true);
    try {
      const blob = await cropToBlob(imageUrl, area, rotation);
      await onConfirm(blob);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar foto de perfil</DialogTitle>
          <DialogDescription>Arraste para posicionar e use o zoom para enquadrar o rosto.</DialogDescription>
        </DialogHeader>

        <div className="relative h-72 overflow-hidden rounded-xl bg-[#05070b] sm:h-80">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              zoomSpeed={0.15}
              aspect={1}
              cropShape="round"
              showGrid={false}
              objectFit="cover"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <ZoomOut className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Slider
            value={[zoom]}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            onValueChange={([value]) => setZoom(value)}
            aria-label="Zoom"
          />
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            aria-label="Girar 90°"
            title="Girar 90°"
          >
            <RotateCw />
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void confirm()} disabled={saving || !area}>
            {saving && <Loader2 className="animate-spin" />}
            Salvar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    image.src = src;
  });
}

/**
 * Recorta a área escolhida (coordenadas em pixels da imagem já girada, como o
 * react-easy-crop informa) e redimensiona para OUTPUT_SIZE × OUTPUT_SIZE.
 */
async function cropToBlob(src: string, area: Area, rotation: number): Promise<Blob> {
  const image = await loadImage(src);
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotatedWidth = image.naturalWidth * cos + image.naturalHeight * sin;
  const rotatedHeight = image.naturalWidth * sin + image.naturalHeight * cos;

  // 1) desenha a imagem girada inteira
  const rotated = document.createElement("canvas");
  rotated.width = Math.round(rotatedWidth);
  rotated.height = Math.round(rotatedHeight);
  const rctx = rotated.getContext("2d");
  if (!rctx) throw new Error("Seu navegador não permitiu processar a imagem.");
  rctx.translate(rotated.width / 2, rotated.height / 2);
  rctx.rotate(radians);
  rctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  // 2) recorta a área e reduz para o tamanho final
  const output = document.createElement("canvas");
  output.width = OUTPUT_SIZE;
  output.height = OUTPUT_SIZE;
  const ctx = output.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não permitiu processar a imagem.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/webp", 0.9));
  if (blob && blob.type === "image/webp") return blob;
  // Safari antigo não gera WebP: usa JPEG.
  const jpeg = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/jpeg", 0.9));
  if (!jpeg) throw new Error("Não foi possível gerar a foto recortada.");
  return jpeg;
}
