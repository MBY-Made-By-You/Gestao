/**
 * Utilitários de imagem executados no navegador antes do upload:
 * validação, leitura de dimensões e compressão (WebP) para economizar
 * Storage e acelerar o carregamento das miniaturas no Kanban.
 */

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

/** Limite do bucket (task-attachments) — igual ao CHECK do banco. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Limite do arquivo original (antes da compressão). */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

export type ImageValidationError = { code: "type" | "size" | "empty"; message: string };

export function isAcceptedImageType(type: string): type is AcceptedImageType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

export function validateImageFile(file: Pick<File, "name" | "size" | "type">): ImageValidationError | null {
  if (!file.size) return { code: "empty", message: `"${file.name}" está vazio.` };
  if (!isAcceptedImageType(file.type)) {
    return { code: "type", message: `"${file.name}" não é uma imagem suportada (PNG, JPG, WebP, GIF ou AVIF).` };
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return { code: "size", message: `"${file.name}" passa de 25 MB.` };
  }
  return null;
}

/** "Foto Reunião (1).JPG" -> "foto-reuniao-1.jpg" */
export function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  const clean = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const safeBase = clean(base).slice(0, 60) || "imagem";
  const safeExt = clean(ext).slice(0, 5);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

export function extensionForType(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    default:
      return "bin";
  }
}

/** Troca a extensão do nome quando a compressão muda o formato. */
export function renameForType(name: string, type: string): string {
  const sanitized = sanitizeFileName(name);
  const dot = sanitized.lastIndexOf(".");
  const base = dot > 0 ? sanitized.slice(0, dot) : sanitized;
  return `${base}.${extensionForType(type)}`;
}

/** Caminho no bucket: {projectId}/{taskId}/{uuid}-{arquivo} (exigido pela RLS). */
export function buildAttachmentPath(projectId: string, taskId: string, fileName: string, id: string): string {
  return `${projectId}/${taskId}/${id}-${sanitizeFileName(fileName)}`;
}

export async function readImageDimensions(blob: Blob): Promise<{ width: number; height: number } | null> {
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(blob);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    }
  } catch {
    // cai no fallback abaixo
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export type PreparedImage = {
  blob: Blob;
  fileName: string;
  type: string;
  width: number | null;
  height: number | null;
  compressed: boolean;
};

/** Dimensões que cabem em `max` mantendo a proporção. */
export function fitWithin(width: number, height: number, max: number) {
  if (width <= max && height <= max) return { width, height };
  const scale = max / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Redimensiona (lado maior ≤ maxDimension) e converte para WebP. GIFs (podem
 * ser animados) e arquivos pequenos são enviados como estão. Se o resultado
 * ficar maior que o original, mantém o original.
 */
export async function prepareImageForUpload(
  file: File,
  { maxDimension = 2048, quality = 0.85, skipBelowBytes = 400 * 1024 } = {},
): Promise<PreparedImage> {
  const original: PreparedImage = {
    blob: file,
    fileName: sanitizeFileName(file.name),
    type: file.type,
    width: null,
    height: null,
    compressed: false,
  };

  const dims = await readImageDimensions(file);
  original.width = dims?.width ?? null;
  original.height = dims?.height ?? null;

  const isAnimatedCandidate = file.type === "image/gif";
  const fitsAlready = dims ? dims.width <= maxDimension && dims.height <= maxDimension : true;
  if (isAnimatedCandidate || (fitsAlready && file.size <= skipBelowBytes) || !dims || typeof document === "undefined") {
    return original;
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const target = fitWithin(bitmap.width, bitmap.height, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return original;
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.type !== "image/webp") return original;
    if (blob.size >= file.size && file.size <= MAX_UPLOAD_BYTES) return original;

    return {
      blob,
      fileName: renameForType(file.name, "image/webp"),
      type: "image/webp",
      width: target.width,
      height: target.height,
      compressed: true,
    };
  } catch {
    return original;
  }
}
