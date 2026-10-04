"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/constants";
import type { AppRole } from "@/lib/types";
import { inviteMember, updateMemberRole } from "@/server/actions/team";

export function RoleSelect({ userId, role, disabled }: { userId: string; role: AppRole; disabled?: boolean }) {
  const [value, setValue] = useState(role);
  const [pending, startTransition] = useTransition();

  function change(next: AppRole) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updateMemberRole(userId, next);
      if (!result.ok) {
        setValue(previous);
        toast.error(result.error);
      } else toast.success(`Perfil alterado para ${ROLE_LABEL[next]}`);
    });
  }

  return (
    <Select value={value} onValueChange={(v) => change(v as AppRole)} disabled={disabled || pending}>
      <SelectTrigger size="sm" className="w-36" aria-label="Perfil de acesso">
        {pending ? <Loader2 className="animate-spin" /> : null}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
          <SelectItem key={r} value={r}>
            <span className="flex flex-col">
              <span className="font-semibold">{ROLE_LABEL[r]}</span>
              <span className="text-[11px] text-muted-foreground">{ROLE_DESCRIPTION[r]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function InviteButton({ inviteEnabled, signupUrl }: { inviteEnabled: boolean; signupUrl: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("member");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await inviteMember(email, name, role);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Convite enviado");
      setOpen(false);
      setEmail("");
      setName("");
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus /> Adicionar pessoa
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {inviteEnabled ? (
            <form onSubmit={submit} className="space-y-5">
              <DialogHeader>
                <DialogTitle>Convidar para a equipe</DialogTitle>
                <DialogDescription>A pessoa recebe um e-mail para definir a senha e entrar.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="invite-name">Nome</Label>
                <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">E-mail</Label>
                <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Perfil de acesso</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]} — {ROLE_DESCRIPTION[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <Mail />}
                  Enviar convite
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-5">
              <DialogHeader>
                <DialogTitle>Adicionar pessoa à equipe</DialogTitle>
                <DialogDescription>
                  Compartilhe o link de cadastro. Novas contas entram como <strong>Visualizador</strong> — depois é só
                  promover para Membro ou Admin aqui na página da equipe.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                <Input readOnly value={signupUrl} aria-label="Link de cadastro" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(signupUrl);
                    toast.success("Link copiado");
                  }}
                >
                  <Copy /> Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Para enviar convites por e-mail direto daqui, configure <code>SUPABASE_SERVICE_ROLE_KEY</code> nas
                variáveis de ambiente do servidor.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
