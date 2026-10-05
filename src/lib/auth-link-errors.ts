/**
 * Mensagens para links de e-mail do Supabase Auth que falharam (confirmação,
 * convite, recuperação). Aceita o `error_code` do Supabase ou a mensagem de erro.
 */
export function describeAuthLinkError(codeOrMessage: string): string {
  const value = codeOrMessage.toLowerCase();
  if (value.includes("otp_expired") || value.includes("expired") || value.includes("invalid or has expired")) {
    return "Este link expirou ou já foi usado. Se você já confirmou o e-mail, é só entrar com seu e-mail e senha.";
  }
  if (value.includes("code verifier") || value.includes("flow state") || value.includes("pkce")) {
    return "O link foi aberto em outro navegador ou aparelho. Seu e-mail pode já estar confirmado: entre com seu e-mail e senha.";
  }
  if (value.includes("access_denied")) {
    return "O acesso pelo link foi negado. Tente entrar com seu e-mail e senha.";
  }
  return "Não foi possível validar o link do e-mail. Tente entrar com seu e-mail e senha.";
}
