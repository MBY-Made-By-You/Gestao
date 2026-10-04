import type { Enums, Tables } from "@/lib/supabase/database.types";

// -----------------------------------------------------------------------------
// Entidades (linhas do banco)
// -----------------------------------------------------------------------------
export type Profile = Tables<"profiles">;
export type Project = Tables<"projects">;
export type ProjectMember = Tables<"project_members">;
export type BoardColumn = Tables<"board_columns">;
export type Sprint = Tables<"sprints">;
export type Task = Tables<"tasks">;
export type Tag = Tables<"tags">;
export type TaskAttachment = Tables<"task_attachments">;
export type XpEvent = Tables<"xp_events">;
export type FinanceCategory = Tables<"finance_categories">;
export type Transaction = Tables<"transactions">;
export type Resource = Tables<"resources">;
export type ResourceMovement = Tables<"resource_movements">;
export type CalendarEvent = Tables<"events">;

export type ProjectProgress = Tables<"project_progress">;
export type MemberStats = Tables<"member_stats">;
export type FinanceMonthly = Tables<"finance_monthly">;
export type ProjectFinancials = Tables<"project_financials">;

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------
export type AppRole = Enums<"app_role">;
export type ProjectStatus = Enums<"project_status">;
export type TaskPriority = Enums<"task_priority">;
export type SprintStatus = Enums<"sprint_status">;
export type AttachmentKind = Enums<"attachment_kind">;
export type TransactionType = Enums<"transaction_type">;
export type TransactionStatus = Enums<"transaction_status">;
export type MovementType = Enums<"movement_type">;
export type EventType = Enums<"event_type">;

// -----------------------------------------------------------------------------
// Modelos compostos usados pela interface
// -----------------------------------------------------------------------------
export type MiniProfile = Pick<Profile, "id" | "full_name" | "avatar_url">;

/** Tarefa com responsável, etiquetas e contagem de anexos (card do Kanban). */
export type TaskCard = Task & {
  assignee: MiniProfile | null;
  tags: Tag[];
  attachment_count: number;
};

export type ColumnWithTasks = BoardColumn & { tasks: TaskCard[] };

export type ProjectWithStats = Project & {
  progress: ProjectProgress | null;
  members: MiniProfile[];
};

export type SessionProfile = Profile & {
  isAdmin: boolean;
  isStaff: boolean;
};

/** Resultado padrão das Server Actions. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };
