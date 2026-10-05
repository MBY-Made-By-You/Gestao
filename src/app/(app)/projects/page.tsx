import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";

import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { NewProjectButton } from "@/components/projects/project-form-dialog";
import { requireProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { listProjects } from "@/server/queries/projects";

export const metadata: Metadata = { title: "Projetos" };

const FILTERS = [
  { value: "active", label: "Em andamento" },
  { value: "closed", label: "Concluídos e arquivados" },
  { value: "all", label: "Todos" },
] as const;

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const [{ status }, profile] = await Promise.all([searchParams, requireProfile()]);
  const filter = FILTERS.find((f) => f.value === status)?.value ?? "active";
  const projects = await listProjects(filter);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestão de projetos"
        title="Projetos"
        description={
          profile.isStaff
            ? "Acompanhe o progresso, prazos e orçamento de cada projeto."
            : "Projetos em que você foi incluído como cliente/visualizador."
        }
        actions={
          profile.isStaff ? (
            <NewProjectButton>
              <Plus /> Novo projeto
            </NewProjectButton>
          ) : null
        }
      />

      <nav className="flex w-fit gap-1 rounded-xl bg-muted p-1" aria-label="Filtrar projetos">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "active" ? "/projects" : `/projects?status=${f.value}`}
            aria-current={filter === f.value ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-semibold text-muted-foreground transition hover:text-foreground",
              filter === f.value && "bg-card text-foreground shadow-sm",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={filter === "active" ? "Nenhum projeto em andamento" : "Nada por aqui"}
          description={
            profile.isStaff
              ? "Crie o primeiro projeto para montar o quadro Kanban, o backlog e o controle financeiro."
              : "Peça a um administrador para incluir você em um projeto."
          }
          action={profile.isStaff ? <NewProjectButton>Criar projeto</NewProjectButton> : null}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} showFinance={profile.isStaff} />
          ))}
        </div>
      )}
    </div>
  );
}
