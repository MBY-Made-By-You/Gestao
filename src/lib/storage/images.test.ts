import { describe, expect, it } from "vitest";

import {
  MAX_SOURCE_BYTES,
  buildAttachmentPath,
  fitWithin,
  renameForType,
  sanitizeFileName,
  validateImageFile,
} from "./images";

describe("validateImageFile", () => {
  it("aceita imagens suportadas", () => {
    expect(validateImageFile({ name: "a.png", size: 10, type: "image/png" })).toBeNull();
  });
  it("rejeita outros tipos", () => {
    expect(validateImageFile({ name: "a.pdf", size: 10, type: "application/pdf" })?.code).toBe("type");
  });
  it("rejeita arquivos vazios ou grandes demais", () => {
    expect(validateImageFile({ name: "a.png", size: 0, type: "image/png" })?.code).toBe("empty");
    expect(validateImageFile({ name: "a.png", size: MAX_SOURCE_BYTES + 1, type: "image/png" })?.code).toBe("size");
  });
});

describe("nomes e caminhos", () => {
  it("remove acentos e caracteres especiais", () => {
    expect(sanitizeFileName("Foto Reunião (1).JPG")).toBe("foto-reuniao-1.jpg");
    expect(sanitizeFileName("...")).toBe("imagem");
  });
  it("troca a extensão após conversão", () => {
    expect(renameForType("Protótipo final.png", "image/webp")).toBe("prototipo-final.webp");
  });
  it("monta o caminho exigido pela política do Storage", () => {
    expect(buildAttachmentPath("p1", "t1", "Print 01.png", "abc")).toBe("p1/t1/abc-print-01.png");
  });
});

describe("fitWithin", () => {
  it("mantém a proporção ao reduzir", () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });
});
