/**
 * Gamificação básica: o XP vem do banco (tabela xp_events, alimentada por
 * gatilho ao concluir tarefas). Aqui ficam níveis, títulos e conquistas.
 *
 *   XP da tarefa = pontos × peso da prioridade (baixa 5, média 10, alta 15, urgente 20)
 *   +50% quando entregue até o prazo.
 */

const XP_PER_LEVEL_UNIT = 50;

export const LEVEL_TITLES = [
  "Capivara Aprendiz",
  "Capivara Curiosa",
  "Capivara Colaboradora",
  "Capivara Especialista",
  "Capivara Mestre",
  "Capivara Lendária",
] as const;

/** XP mínimo para alcançar o nível `level` (nível 1 = 0 XP). */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return XP_PER_LEVEL_UNIT * (n - 1) ** 2;
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / XP_PER_LEVEL_UNIT)) + 1;
}

export type LevelInfo = {
  level: number;
  title: string;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  /** 0..1 dentro do nível atual */
  progress: number;
  toNext: number;
};

export function levelInfo(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = levelFromXp(safeXp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = nextLevelXp - currentLevelXp;
  return {
    level,
    title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1],
    xp: safeXp,
    currentLevelXp,
    nextLevelXp,
    progress: span > 0 ? (safeXp - currentLevelXp) / span : 1,
    toNext: Math.max(0, nextLevelXp - safeXp),
  };
}

export type BadgeId = "first" | "marathon" | "centurion" | "punctual" | "on_fire" | "xp_master";

export type Badge = {
  id: BadgeId;
  name: string;
  description: string;
  icon: "Rocket" | "Medal" | "Crown" | "Timer" | "Flame" | "Sparkles";
  earned: boolean;
};

export type BadgeStats = {
  xp: number;
  tasks_completed: number;
  tasks_on_time: number;
  tasks_completed_with_due: number;
  tasks_completed_last_30d: number;
};

export function onTimeRate(stats: Pick<BadgeStats, "tasks_on_time" | "tasks_completed_with_due">): number | null {
  if (!stats.tasks_completed_with_due) return null;
  return stats.tasks_on_time / stats.tasks_completed_with_due;
}

export function computeBadges(stats: BadgeStats): Badge[] {
  const rate = onTimeRate(stats);
  return [
    {
      id: "first",
      name: "Primeira entrega",
      description: "Concluiu a primeira tarefa",
      icon: "Rocket",
      earned: stats.tasks_completed >= 1,
    },
    {
      id: "marathon",
      name: "Maratonista",
      description: "25 tarefas concluídas",
      icon: "Medal",
      earned: stats.tasks_completed >= 25,
    },
    {
      id: "centurion",
      name: "Centenário",
      description: "100 tarefas concluídas",
      icon: "Crown",
      earned: stats.tasks_completed >= 100,
    },
    {
      id: "punctual",
      name: "Pontual",
      description: "90% das entregas no prazo (mín. 5)",
      icon: "Timer",
      earned: stats.tasks_completed_with_due >= 5 && rate !== null && rate >= 0.9,
    },
    {
      id: "on_fire",
      name: "Em chamas",
      description: "10 tarefas em 30 dias",
      icon: "Flame",
      earned: stats.tasks_completed_last_30d >= 10,
    },
    {
      id: "xp_master",
      name: "Mestre do XP",
      description: "Acumulou 1.000 XP",
      icon: "Sparkles",
      earned: stats.xp >= 1000,
    },
  ];
}
