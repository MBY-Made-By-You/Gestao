"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import type { ActionResult, Resource } from "@/lib/types";
import { failure, getActionContext } from "@/server/action-context";

const uuid = z.uuid();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const money = z.number({ error: "Informe um valor." }).finite().positive("O valor deve ser maior que zero.").max(1e12);

// -----------------------------------------------------------------------------
// Lançamentos (receitas e despesas)
// -----------------------------------------------------------------------------

const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  description: z.string().trim().min(1, "Descreva o lançamento.").max(200),
  amount: money,
  occurred_on: dateOnly,
  status: z.enum(["paid", "pending"]),
  project_id: uuid.nullable(),
  category_id: uuid.nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

export type TransactionInput = z.input<typeof transactionSchema>;

export async function saveTransaction(id: string | null, input: TransactionInput): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Lançamento inválido." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;

  const { error } = id
    ? await supabase.from("transactions").update(parsed.data).eq("id", id)
    : await supabase.from("transactions").insert(parsed.data);
  if (error) return failure(error, "Não foi possível salvar o lançamento.");
  refresh();
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Lançamento inválido." };
  const context = await getActionContext("admin");
  if (!context.ok) return context;
  const { data, error } = await context.ctx.supabase.from("transactions").delete().eq("id", id).select("id");
  if (error) return failure(error, "Não foi possível excluir o lançamento.");
  if (!data?.length) return { ok: false, error: "Apenas administradores podem excluir lançamentos." };
  refresh();
  return { ok: true };
}

export async function markTransactionPaid(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Lançamento inválido." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { error } = await context.ctx.supabase.from("transactions").update({ status: "paid" }).eq("id", id);
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Insumos (estoque)
// -----------------------------------------------------------------------------

const resourceSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao insumo.").max(120),
  sku: z.string().trim().max(60).nullable(),
  unit: z.string().trim().min(1).max(12),
  min_quantity: z.number().finite().nonnegative().max(1e9),
  supplier: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

export type ResourceInput = z.input<typeof resourceSchema>;

export async function saveResource(id: string | null, input: ResourceInput): Promise<ActionResult<Resource>> {
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;
  const payload = { ...parsed.data, sku: parsed.data.sku || null };

  const query = id
    ? supabase.from("resources").update(payload).eq("id", id)
    : supabase.from("resources").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) return failure(error, "Não foi possível salvar o insumo.");
  refresh();
  return { ok: true, data };
}

export async function deleteResource(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Insumo inválido." };
  const context = await getActionContext("admin");
  if (!context.ok) return context;
  const { error } = await context.ctx.supabase.from("resources").delete().eq("id", id);
  if (error) return failure(error, "Não foi possível excluir o insumo.");
  refresh();
  return { ok: true };
}

const movementSchema = z
  .object({
    resource_id: uuid,
    type: z.enum(["in", "out"]),
    quantity: z.number().finite().positive("A quantidade deve ser maior que zero.").max(1e9),
    unit_cost: z.number().finite().nonnegative().max(1e12).optional(),
    occurred_on: dateOnly,
    project_id: uuid.nullable(),
    note: z.string().trim().max(500).nullable(),
    /** Entrada (compra): também lança uma despesa geral de "Materiais e insumos". */
    create_expense: z.boolean().optional(),
  })
  .refine((m) => m.type === "out" || m.unit_cost !== undefined, {
    message: "Informe o custo unitário da compra.",
  });

export type MovementInput = z.input<typeof movementSchema>;

/**
 * Registra entrada/saída de estoque. O gatilho do banco atualiza o saldo e o
 * custo médio ponderado (e bloqueia saídas maiores que o estoque).
 */
export async function createMovement(input: MovementInput): Promise<ActionResult> {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const context = await getActionContext("member");
  if (!context.ok) return context;
  const { supabase } = context.ctx;
  const { create_expense, ...movement } = parsed.data;

  try {
    let transactionId: string | null = null;
    if (movement.type === "in" && create_expense && movement.unit_cost) {
      const { data: resource } = await supabase.from("resources").select("name, unit").eq("id", movement.resource_id).single();
      const { data: category } = await supabase
        .from("finance_categories")
        .select("id")
        .eq("type", "expense")
        .eq("name", "Materiais e insumos")
        .maybeSingle();
      const amount = Math.round(movement.quantity * movement.unit_cost * 100) / 100;
      if (amount > 0) {
        const { data: tx, error: txError } = await supabase
          .from("transactions")
          .insert({
            type: "expense",
            description: `Compra: ${resource?.name ?? "insumo"} (${movement.quantity} ${resource?.unit ?? "un"})`,
            amount,
            occurred_on: movement.occurred_on,
            status: "paid",
            project_id: null,
            category_id: category?.id ?? null,
            notes: movement.note,
          })
          .select("id")
          .single();
        if (txError) throw txError;
        transactionId = tx.id;
      }
    }

    const { error } = await supabase.from("resource_movements").insert({
      ...movement,
      unit_cost: movement.type === "in" ? (movement.unit_cost ?? 0) : 0,
      transaction_id: transactionId,
    });
    if (error) {
      if (transactionId) await supabase.from("transactions").delete().eq("id", transactionId);
      throw error;
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error, "Não foi possível registrar a movimentação.");
  }
}

export async function deleteMovement(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Movimentação inválida." };
  const context = await getActionContext("admin");
  if (!context.ok) return context;
  const { error } = await context.ctx.supabase.from("resource_movements").delete().eq("id", id);
  if (error) return failure(error, "Não foi possível estornar a movimentação.");
  refresh();
  return { ok: true };
}
