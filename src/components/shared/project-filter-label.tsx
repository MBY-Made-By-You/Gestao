type ProjectOption = { id: string; name: string; color: string };

/**
 * Rótulo do filtro de projeto ("all" | "general" | id). Passado como filho do
 * <SelectValue> para já sair no HTML do servidor (sem gatilho vazio antes da hidratação).
 */
export function ProjectFilterLabel({ value, projects }: { value: string; projects: ProjectOption[] }) {
  if (value === "general") return <>Geral da equipe</>;
  const project = value === "all" ? undefined : projects.find((p) => p.id === value);
  if (!project) return <>Todos os projetos</>;
  return (
    <>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
      {project.name}
    </>
  );
}
