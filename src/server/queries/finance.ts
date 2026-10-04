import "server-only";

import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

import { toDateInput } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { FinanceCategory, Resource, ResourceMovement, Transaction } from "@/lib/types";
import { toNumber } from "@/lib/utils";

export type TransactionRow = Transaction & {
  category: Pick<FinanceCategory, "id" | "name" | "color"> | null;
  project: { id: string; name: string; color: string } | null;
};

export type MonthlyPoint = { month: string; label: string; income: number; expense: number; balance: number };

export type FinanceOverview = {
  month: Date;
  transactions: TransactionRow[];
  categories: FinanceCategory[];
  projects: { id: string; name: string; color: string }[];
  history: MonthlyPoint[];
  totals: {
    income: number;
    expense: number;
    balance: number;
    pendingIncome: number;
    pendingExpense: number;
    accumulated: number;
  };
  byCategory: { id: string; name: string; color: string; total: number }[];
  byProject: {
    id: string;
    name: string;
    color: string;
    budget: number | null;
    income: number;
    expense: number;
    materials: number;
    totalCost: number;
  }[];
};

/** `monthParam` = yyyy-MM; padrão: mês atual. */
export async function getFinanceOverview(monthParam?: string): Promise<FinanceOverview> {
  const supabase = await createClient();
  const parsed = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? new Date(`${monthParam}-01T12:00:00`) : new Date();
  const month = startOfMonth(parsed);
  const from = toDateInput(month);
  const to = toDateInput(endOfMonth(month));

  const [txRes, catRes, projRes, monthlyRes, finRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, category:finance_categories(id, name, color), project:projects(id, name, color)")
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("finance_categories").select("*").order("name"),
    supabase.from("projects").select("id, name, color, status").order("name"),
    supabase.from("finance_monthly").select("*").order("month"),
    supabase.from("project_financials").select("*"),
  ]);
  if (txRes.error) throw txRes.error;

  const transactions = (txRes.data ?? []).map((t) => ({ ...t, amount: toNumber(t.amount) }));
  const paid = transactions.filter((t) => t.status === "paid");
  const income = paid.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = paid.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const pending = transactions.filter((t) => t.status === "pending");

  const monthly = (monthlyRes.data ?? []).map((r) => ({
    month: (r.month ?? "").slice(0, 10),
    income: toNumber(r.income),
    expense: toNumber(r.expense),
    balance: toNumber(r.balance),
  }));
  const accumulated = monthly.filter((r) => r.month <= from).reduce((s, r) => s + r.balance, 0);

  const history: MonthlyPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = startOfMonth(subMonths(month, i));
    const key = toDateInput(m);
    const row = monthly.find((r) => r.month === key);
    history.push({
      month: key,
      label: format(m, "MMM yy", { locale: ptBR }),
      income: row?.income ?? 0,
      expense: row?.expense ?? 0,
      balance: row?.balance ?? 0,
    });
  }

  const categoryTotals = new Map<string, { id: string; name: string; color: string; total: number }>();
  for (const t of paid.filter((t) => t.type === "expense")) {
    const key = t.category?.id ?? "none";
    const entry = categoryTotals.get(key) ?? {
      id: key,
      name: t.category?.name ?? "Sem categoria",
      color: t.category?.color ?? "#94A3B8",
      total: 0,
    };
    entry.total += t.amount;
    categoryTotals.set(key, entry);
  }

  const projects = projRes.data ?? [];
  const byProject = (finRes.data ?? [])
    .map((f) => {
      const p = projects.find((x) => x.id === f.project_id);
      return {
        id: f.project_id ?? "",
        name: p?.name ?? "—",
        color: p?.color ?? "#94A3B8",
        budget: f.budget === null ? null : toNumber(f.budget),
        income: toNumber(f.income),
        expense: toNumber(f.expense),
        materials: toNumber(f.materials_cost),
        totalCost: toNumber(f.total_cost),
      };
    })
    .filter((p) => p.budget !== null || p.totalCost > 0 || p.income > 0)
    .sort((a, b) => b.totalCost - a.totalCost);

  return {
    month,
    transactions,
    categories: catRes.data ?? [],
    projects: projects.map(({ id, name, color }) => ({ id, name, color })),
    history,
    totals: {
      income,
      expense,
      balance: income - expense,
      pendingIncome: pending.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      pendingExpense: pending.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      accumulated,
    },
    byCategory: [...categoryTotals.values()].sort((a, b) => b.total - a.total),
    byProject,
  };
}

export type MovementRow = ResourceMovement & {
  resource: Pick<Resource, "id" | "name" | "unit"> | null;
  project: { id: string; name: string; color: string } | null;
  author: { full_name: string } | null;
};

export async function getResourcesOverview() {
  const supabase = await createClient();
  const monthStart = toDateInput(startOfMonth(new Date()));
  const [resRes, movRes, projRes] = await Promise.all([
    supabase.from("resources").select("*").order("name"),
    supabase
      .from("resource_movements")
      .select(
        "*, resource:resources(id, name, unit), project:projects(id, name, color), author:profiles!resource_movements_created_by_fkey(full_name)",
      )
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("projects").select("id, name, color").in("status", ["planning", "active", "on_hold"]).order("name"),
  ]);
  if (resRes.error) throw resRes.error;

  const resources = (resRes.data ?? []).map((r) => ({
    ...r,
    quantity: toNumber(r.quantity),
    unit_cost: toNumber(r.unit_cost),
    min_quantity: toNumber(r.min_quantity),
  }));
  const movements: MovementRow[] = (movRes.data ?? []).map((m) => ({
    ...m,
    quantity: toNumber(m.quantity),
    unit_cost: toNumber(m.unit_cost),
  }));

  const stockValue = resources.reduce((s, r) => s + r.quantity * r.unit_cost, 0);
  const lowStock = resources.filter((r) => r.min_quantity > 0 && r.quantity <= r.min_quantity).length;
  const monthConsumption = movements
    .filter((m) => m.type === "out" && m.occurred_on >= monthStart)
    .reduce((s, m) => s + m.quantity * m.unit_cost, 0);

  const consumptionByProject = new Map<string, { id: string; name: string; color: string; total: number }>();
  for (const m of movements.filter((m) => m.type === "out" && m.project)) {
    const entry = consumptionByProject.get(m.project!.id) ?? { ...m.project!, total: 0 };
    entry.total += m.quantity * m.unit_cost;
    consumptionByProject.set(m.project!.id, entry);
  }

  return {
    resources,
    movements,
    projects: projRes.data ?? [],
    stockValue,
    lowStock,
    monthConsumption,
    consumptionByProject: [...consumptionByProject.values()].sort((a, b) => b.total - a.total),
  };
}
