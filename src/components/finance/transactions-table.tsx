"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { TransactionDialog } from "@/components/finance/transaction-dialog";
import { EmptyState } from "@/components/brand/empty-state";
import { ProjectFilterLabel } from "@/components/shared/project-filter-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, plural } from "@/lib/format";
import type { FinanceCategory, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteTransaction, markTransactionPaid } from "@/server/actions/finance";
import type { TransactionRow } from "@/server/queries/finance";

const TYPE_FILTER_LABEL: Record<"all" | TransactionType, string> = {
  all: "Receitas e despesas",
  income: "Somente receitas",
  expense: "Somente despesas",
};

export function TransactionsTable({
  transactions,
  categories,
  projects,
  isAdmin,
}: {
  transactions: TransactionRow[];
  categories: FinanceCategory[];
  projects: { id: string; name: string; color: string }[];
  isAdmin: boolean;
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [dialog, setDialog] = useState<{ open: boolean; transaction: TransactionRow | null; type: TransactionType }>({
    open: false,
    transaction: null,
    type: "expense",
  });
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () =>
      transactions.filter((t) => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (projectFilter === "general" && t.project_id) return false;
        if (projectFilter !== "all" && projectFilter !== "general" && t.project_id !== projectFilter) return false;
        return true;
      }),
    [transactions, typeFilter, projectFilter],
  );

  const net = visible
    .filter((t) => t.status === "paid")
    .reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Lançamento excluído");
    });
  }

  function markPaid(id: string) {
    startTransition(async () => {
      const result = await markTransactionPaid(id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Marcado como efetivado");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger size="sm" className="w-auto min-w-36" aria-label="Filtrar por tipo">
            <SelectValue>{TYPE_FILTER_LABEL[typeFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TYPE_FILTER_LABEL) as (keyof typeof TYPE_FILTER_LABEL)[]).map((key) => (
              <SelectItem key={key} value={key}>
                {TYPE_FILTER_LABEL[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger size="sm" className="w-auto min-w-40" aria-label="Filtrar por projeto">
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
        <span className="text-xs text-muted-foreground">
          {plural(visible.length, "lançamento")} · resultado{" "}
          <strong className={net >= 0 ? "text-success" : "text-destructive"}>{formatCurrency(net)}</strong>
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, transaction: null, type: "income" })}>
            <Plus /> Receita
          </Button>
          <Button size="sm" onClick={() => setDialog({ open: true, transaction: null, type: "expense" })}>
            <Plus /> Despesa
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState compact title="Nenhum lançamento neste mês" description="Registre receitas e despesas para acompanhar o caixa." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{formatDate(t.occurred_on, "dd/MM")}</TableCell>
                  <TableCell className="max-w-72">
                    <p className="truncate font-semibold">{t.description}</p>
                    {t.notes && <p className="truncate text-xs text-muted-foreground">{t.notes}</p>}
                  </TableCell>
                  <TableCell>
                    {t.category ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="size-2 rounded-full" style={{ backgroundColor: t.category.color }} />
                        {t.category.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.project ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="size-2 rounded-[3px]" style={{ backgroundColor: t.project.color }} />
                        {t.project.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Geral</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.status === "paid" ? (
                      <Badge variant="success">
                        <CheckCircle2 /> {t.type === "income" ? "Recebido" : "Pago"}
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <Clock /> {t.type === "income" ? "A receber" : "A pagar"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-bold tabular-nums",
                      t.type === "income" ? "text-success" : "text-foreground",
                    )}
                  >
                    {t.type === "income" ? "+" : "−"} {formatCurrency(t.amount)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${t.description}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setDialog({ open: true, transaction: t, type: t.type })}>
                          <Pencil /> Editar
                        </DropdownMenuItem>
                        {t.status === "pending" && (
                          <DropdownMenuItem onSelect={() => markPaid(t.id)} disabled={pending}>
                            <CheckCircle2 /> Marcar como {t.type === "income" ? "recebido" : "pago"}
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => remove(t.id)} disabled={pending}>
                              <Trash2 /> Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dialog.open && (
        <TransactionDialog
          key={dialog.transaction?.id ?? `new-${dialog.type}`}
          open={dialog.open}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
          transaction={dialog.transaction}
          categories={categories}
          projects={projects}
          defaultType={dialog.type}
        />
      )}
    </div>
  );
}
