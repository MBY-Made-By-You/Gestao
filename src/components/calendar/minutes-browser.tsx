"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, FileText, Flag, Search, Users, Video } from "lucide-react";

import { copyMinutes, MINUTES_SECTIONS, minutesToText } from "@/components/calendar/event-minutes";
import { EmptyState } from "@/components/brand/empty-state";
import { ProjectFilterLabel } from "@/components/shared/project-filter-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_TYPE_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { zonedParts } from "@/lib/timezone";
import type { EventType } from "@/lib/types";
import type { MinutesListItem } from "@/server/queries/minutes";

const TYPE_ICON: Record<EventType, typeof Video> = { meeting: Video, event: Users, milestone: Flag };

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function MinutesBrowser({
  items,
  projects,
}: {
  items: MinutesListItem[];
  projects: { id: string; name: string; color: string }[];
}) {
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");

  const visible = useMemo(() => {
    const term = normalize(query.trim());
    return items.filter((item) => {
      if (projectFilter === "general" && item.event.project) return false;
      if (projectFilter !== "all" && projectFilter !== "general" && item.event.project?.id !== projectFilter) return false;
      if (!term) return true;
      const haystack = [item.event.title, item.summary, item.decisions, item.learnings, item.next_steps].join(" ");
      return normalize(haystack).includes(term);
    });
  }, [items, query, projectFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nas atas (assunto, decisão, aprendizado…)"
            className="pl-9"
            aria-label="Buscar nas atas"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por projeto">
            <SelectValue>
              <ProjectFilterLabel value={projectFilter} projects={projects} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            <SelectItem value="general">Geral da equipe</SelectItem>
            <SelectSeparator />
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={items.length ? "Nenhuma ata encontrada" : "Nenhuma ata ainda"}
          description={
            items.length
              ? "Tente outra busca ou outro projeto."
              : "Abra um evento no calendário e use a aba Ata para registrar o que foi dito e aprendido."
          }
        />
      ) : (
        <ul className="space-y-4">
          {visible.map((item) => (
            <MinutesCard key={item.event_id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MinutesCard({ item }: { item: MinutesListItem }) {
  const [expanded, setExpanded] = useState(false);
  const { event } = item;
  const Icon = TYPE_ICON[event.type];
  const when = event.all_day ? formatDate(event.starts_at) : formatDateTime(event.starts_at);
  const sections = MINUTES_SECTIONS.filter((s) => item[s.key]?.trim());
  const long = sections.reduce((n, s) => n + (item[s.key]?.length ?? 0), 0) > 600;
  const href = `/calendar?date=${zonedParts(event.starts_at).ymd}&evento=${event.id}&aba=ata`;

  return (
    <li className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <header className="flex flex-wrap items-start gap-3 border-b px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong dark:text-brand">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold">{event.title}</h2>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>
              {EVENT_TYPE_LABEL[event.type]} · {when}
            </span>
            {event.project && (
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: event.project.color }} />
                {event.project.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copiar ata"
            title="Copiar ata"
            onClick={() => void copyMinutes(minutesToText(event.title, `${EVENT_TYPE_LABEL[event.type]} · ${when}`, item))}
          >
            <Copy />
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={href}>
              <ExternalLink /> Abrir
            </Link>
          </Button>
        </div>
      </header>
      <div className={expanded || !long ? "space-y-4 px-5 py-4" : "relative max-h-56 space-y-4 overflow-hidden px-5 py-4"}>
        {sections.map(({ key, label, icon: SectionIcon }) => (
          <section key={key} className="space-y-1">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <SectionIcon className="size-4 text-brand" /> {label}
            </h3>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item[key]}</p>
          </section>
        ))}
        {long && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>
      <footer className="flex items-center gap-3 border-t px-5 py-2.5 text-xs text-muted-foreground">
        <span>
          Atualizada {item.editor?.full_name ? `por ${item.editor.full_name} ` : ""}em {formatDateTime(item.updated_at)}
        </span>
        {long && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto font-semibold text-brand-strong hover:underline dark:text-brand"
          >
            {expanded ? "Mostrar menos" : "Ver ata completa"}
          </button>
        )}
      </footer>
    </li>
  );
}
