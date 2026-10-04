import type {
  AppRole,
  EventType,
  ProjectStatus,
  SprintStatus,
  TaskPriority,
  TransactionStatus,
  TransactionType,
} from "@/lib/types";

export const APP_NAME = "MBY Gestão";
export const APP_TAGLINE = "Projetos, finanças e equipe — feito por você.";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  member: "Membro",
  viewer: "Visualizador",
};

export const ROLE_DESCRIPTION: Record<AppRole, string> = {
  admin: "Acesso total, gerencia equipe e financeiro",
  member: "Cria e edita projetos, tarefas e lançamentos",
  viewer: "Cliente: somente leitura dos projetos vinculados",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planejamento",
  active: "Ativo",
  on_hold: "Pausado",
  completed: "Concluído",
  archived: "Arquivado",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

/** Peso de XP por ponto, espelhando a coluna gerada tasks.xp_reward. */
export const PRIORITY_XP_WEIGHT: Record<TaskPriority, number> = {
  low: 5,
  medium: 10,
  high: 15,
  urgent: 20,
};

export const PRIORITY_STYLE: Record<TaskPriority, { dot: string; badge: string }> = {
  low: { dot: "bg-slate-400", badge: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  medium: { dot: "bg-brand", badge: "bg-brand/10 text-brand-strong dark:text-brand" },
  high: { dot: "bg-orange-500", badge: "bg-orange-500/12 text-orange-700 dark:text-orange-300" },
  urgent: { dot: "bg-red-500", badge: "bg-red-500/12 text-red-700 dark:text-red-300" },
};

export const SPRINT_STATUS_LABEL: Record<SprintStatus, string> = {
  planned: "Planejada",
  active: "Ativa",
  completed: "Concluída",
};

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
};

export const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  paid: "Efetivado",
  pending: "Pendente",
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  event: "Evento",
  meeting: "Reunião",
  milestone: "Marco",
};

export const STORY_POINT_OPTIONS = [0, 1, 2, 3, 5, 8, 13, 21] as const;

/** Paleta para projetos, colunas e etiquetas. */
export const COLOR_SWATCHES = [
  "#0399FB",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#0EA5E9",
  "#64748B",
  "#94A3B8",
] as const;
