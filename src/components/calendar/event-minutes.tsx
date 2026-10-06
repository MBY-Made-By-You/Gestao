"use client";

import { useEffect, useState, useTransition } from "react";
import { BookOpenCheck, Copy, Gavel, ListChecks, Loader2, MessagesSquare, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { saveEventMinutes } from "@/server/actions/events";

type MinutesFields = { summary: string; decisions: string; learnings: string; next_steps: string };

const EMPTY: MinutesFields = { summary: "", decisions: "", learnings: "", next_steps: "" };

export const MINUTES_SECTIONS = [
  {
    key: "summary",
    label: "O que foi discutido",
    icon: MessagesSquare,
    placeholder: "Pauta, pontos levantados, quem disse o quê…",
    max: 20000,
    rows: 6,
  },
  { key: "decisions", label: "Decisões", icon: Gavel, placeholder: "O que ficou decidido.", max: 10000, rows: 3 },
  {
    key: "learnings",
    label: "Aprendizados",
    icon: BookOpenCheck,
    placeholder: "O que a equipe aprendeu, dicas do orientador, erros a evitar…",
    max: 10000,
    rows: 3,
  },
  {
    key: "next_steps",
    label: "Próximos passos",
    icon: ListChecks,
    placeholder: "Quem faz o quê e até quando.",
    max: 10000,
    rows: 3,
  },
] as const;

/** Texto corrido da ata, para colar no WhatsApp, e-mail etc. */
export function minutesToText(title: string, when: string, fields: Partial<Record<keyof MinutesFields, string | null>>) {
  const parts = [`Ata — ${title}`, when];
  for (const section of MINUTES_SECTIONS) {
    const value = fields[section.key]?.trim();
    if (value) parts.push(`\n${section.label}:\n${value}`);
  }
  return parts.join("\n");
}

export async function copyMinutes(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Ata copiada");
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

/** Ata de um evento: o que foi discutido, decisões, aprendizados e próximos passos. */
export function EventMinutesPanel({
  eventId,
  eventTitle,
  eventWhen,
  canEdit,
}: {
  eventId: string;
  eventTitle: string;
  eventWhen: string;
  canEdit: boolean;
}) {
  const [fields, setFields] = useState<MinutesFields>(EMPTY);
  const [saved, setSaved] = useState<MinutesFields>(EMPTY);
  const [meta, setMeta] = useState<{ updatedAt: string; editor: string | null } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("event_minutes")
      .select("summary, decisions, learnings, next_steps, updated_at, editor:profiles!event_minutes_updated_by_fkey(full_name)")
      .eq("event_id", eventId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setState("error");
        const loaded: MinutesFields = {
          summary: data?.summary ?? "",
          decisions: data?.decisions ?? "",
          learnings: data?.learnings ?? "",
          next_steps: data?.next_steps ?? "",
        };
        setFields(loaded);
        setSaved(loaded);
        setMeta(data ? { updatedAt: data.updated_at, editor: data.editor?.full_name ?? null } : null);
        setState("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const dirty = MINUTES_SECTIONS.some((s) => fields[s.key] !== saved[s.key]);
  const isEmpty = MINUTES_SECTIONS.every((s) => !saved[s.key].trim());

  function save() {
    startTransition(async () => {
      const result = await saveEventMinutes(eventId, fields);
      if (!result.ok) return void toast.error(result.error);
      setSaved(fields);
      setMeta({ updatedAt: new Date().toISOString(), editor: "você" });
      toast.success("Ata salva");
    });
  }

  if (state === "loading") {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando ata…
      </p>
    );
  }
  if (state === "error") return <p className="py-10 text-sm text-destructive">Não foi possível carregar a ata.</p>;

  if (!canEdit) {
    if (isEmpty) return <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma ata registrada para este evento.</p>;
    return (
      <div className="space-y-5">
        {MINUTES_SECTIONS.filter((s) => saved[s.key].trim()).map(({ key, label, icon: Icon }) => (
          <section key={key} className="space-y-1.5">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Icon className="size-4 text-brand" /> {label}
            </h3>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{saved[key]}</p>
          </section>
        ))}
        {meta && <MinutesMeta meta={meta} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {MINUTES_SECTIONS.map(({ key, label, icon: Icon, placeholder, max, rows }) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={`minutes-${key}`} className="flex items-center gap-2">
            <Icon className="size-4 text-brand" /> {label}
          </Label>
          <Textarea
            id={`minutes-${key}`}
            value={fields[key]}
            onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            maxLength={max}
            rows={rows}
            className="resize-y"
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {meta ? <MinutesMeta meta={meta} /> : <p className="text-xs text-muted-foreground">Ata ainda não registrada.</p>}
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isEmpty}
            onClick={() => void copyMinutes(minutesToText(eventTitle, eventWhen, saved))}
          >
            <Copy /> Copiar
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={pending || !dirty}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar ata
          </Button>
        </div>
      </div>
    </div>
  );
}

function MinutesMeta({ meta }: { meta: { updatedAt: string; editor: string | null } }) {
  return (
    <p className="text-xs text-muted-foreground">
      Atualizada {meta.editor ? `por ${meta.editor} ` : ""}em {formatDateTime(meta.updatedAt)}
    </p>
  );
}
