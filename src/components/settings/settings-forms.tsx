"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, KeyRound, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prepareImageForUpload, validateImageFile } from "@/lib/storage/images";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { errorMessage } from "@/lib/utils";
import { updateOwnProfile } from "@/server/actions/team";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name);
  const [jobTitle, setJobTitle] = useState(profile.job_title ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    const invalid = validateImageFile(file);
    if (invalid || file.type === "image/gif" || file.type === "image/avif") {
      toast.error(invalid?.message ?? "Use PNG, JPG ou WebP para a foto.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const prepared = await prepareImageForUpload(file, { maxDimension: 512, quality: 0.86, skipBelowBytes: 0 });
      const ext = prepared.type === "image/webp" ? "webp" : prepared.type === "image/png" ? "png" : "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, prepared.blob, {
        contentType: prepared.type,
        cacheControl: "31536000",
      });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);

      // Remove fotos antigas da pasta do usuário.
      const { data: existing } = await supabase.storage.from("avatars").list(profile.id);
      const old = (existing ?? []).map((f) => `${profile.id}/${f.name}`).filter((p) => p !== path);
      if (old.length) await supabase.storage.from("avatars").remove(old);

      const result = await updateOwnProfile({ full_name: fullName, job_title: jobTitle || null, avatar_url: data.publicUrl });
      if (!result.ok) throw new Error(result.error);
      setAvatarUrl(data.publicUrl);
      toast.success("Foto atualizada");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível enviar a foto."));
    } finally {
      setUploading(false);
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateOwnProfile({ full_name: fullName, job_title: jobTitle.trim() || null, avatar_url: avatarUrl });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Perfil salvo");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative">
          <UserAvatar name={fullName} src={avatarUrl} className="size-20 text-xl" />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full bg-brand text-white shadow ring-4 ring-card transition hover:scale-105"
            aria-label="Trocar foto"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadAvatar(file);
              e.target.value = "";
            }}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Foto de perfil</p>
          <p>PNG, JPG ou WebP — redimensionada para 512px.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Nome completo</Label>
          <Input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-title">Cargo / função</Label>
          <Input
            id="profile-title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Ex.: Dev Front-end"
            maxLength={80}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-email">E-mail</Label>
        <Input id="profile-email" value={profile.email ?? ""} disabled />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        Salvar perfil
      </Button>
    </form>
  );
}

export function PasswordForm({ highlight }: { highlight?: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) return void toast.error("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return void toast.error("As senhas não conferem.");
    startTransition(async () => {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) toast.error(errorMessage(error));
      else {
        toast.success("Senha atualizada");
        setPassword("");
        setConfirm("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {highlight && (
        <p className="rounded-xl border border-brand/30 bg-brand-soft p-3 text-sm">
          Bem-vindo(a)! Defina uma senha para entrar das próximas vezes.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmar senha</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </div>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        Atualizar senha
      </Button>
    </form>
  );
}
