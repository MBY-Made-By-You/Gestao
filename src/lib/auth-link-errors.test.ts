import { describe, expect, it } from "vitest";

import { describeAuthLinkError } from "@/lib/auth-link-errors";

describe("describeAuthLinkError", () => {
  it("explica link expirado ou já usado", () => {
    expect(describeAuthLinkError("otp_expired")).toMatch(/expirou ou já foi usado/);
    expect(describeAuthLinkError("Email link is invalid or has expired")).toMatch(/expirou/);
  });

  it("explica link aberto em outro navegador (PKCE)", () => {
    expect(describeAuthLinkError("invalid request: both auth code and code verifier should be non-empty")).toMatch(
      /outro navegador/,
    );
  });

  it("tem mensagem padrão", () => {
    expect(describeAuthLinkError("algo inesperado")).toMatch(/Não foi possível validar/);
  });
});
