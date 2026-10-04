"use client";

import { useState, useTransition } from "react";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toDateInput } from "@/lib/format";
import { parseMoney, toMoneyInput } from "@/lib/money";
import type { FinanceCategory, TransactionStatus, TransactionType } from "@/lib/types";
import { toNumber } from "@/lib/utils";
import { saveTransaction } from "@/server/actions/finance";
import type { TransactionRow } from "@/server/queries/finance";

const NONE = "__none__";

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  categories,
  projects,
  defaultType = "expense",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionRow | null;
  categories: FinanceCategory[];
  projects: { id: string; name: string; color: string }[];
  defaultType?: TransactionType;
}) {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<TransactionType>(transaction?.type ?? defaultType);
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [amount, setAmount] = useState(toMoneyInput(transaction ? toNumber(transaction.amount) : null));
  const [date, setDate] = useState(transaction?.occurred_on ?? toDateInput());
  const [status, setStatus] = useState<TransactionStatus>(transaction?.status ?? "paid");
  const [categoryId, setCategoryId] = useState<string>(transaction?.category_id ?? NONE);
  const [projectId, setProjectId] = useState<string>(transaction?.project_id ?? NONE);
  const [notes, setNotes] = useState(transaction?.notes ?? "");

  const typeCategories = categories.filter((c) => c.type === type);

  function changeType(value: TransactionType) {
    setType(value);
    if (!categories.some((c) => c.id === categoryId && c.type === value)) setCategoryId(NONE);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseMoney(amount);
    if (!value || value <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    startTransition(async () => {
      const result = await saveTransaction(transaction?.id ?? null, {
        type,
        description,
        amount: Math.round(value * 100) / 100,
        occurred_on: date,
        status,
        category_id: categoryId === NONE ? null : categoryId,
        project_id: projectId === NONE ? null : projectId,
        notes: notes.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(transaction ? "Lançamento atualizado" : "Lançamento registrado");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{transaction ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
            <DialogDescription>Vincule a um projeto ou deixe como custo/receita geral da equipe.</DialogDescription>
          </DialogHeader>

          <ToggleGroup
            type="single"
            value={type}
            onValueChange={(v) => v && changeType(v as TransactionType)}
            className="w-full"
            aria-label="Tipo de lançamento"
          >
            <ToggleGroupItem value="income" className="flex-1 data-[state=on]:text-success">
              <TrendingUp /> Receita
            </ToggleGroupItem>
            <ToggleGroupItem value="expense" className="flex-1 data-[state=on]:text-destructive">
              <TrendingDown /> Despesa
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="space-y-2">
            <Label htmlFor="tx-description">Descrição</Label>
            <Input
              id="tx-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === "income" ? "Ex.: Patrocínio Inatel" : "Ex.: Compra de sensores"}
              maxLength={200}
              required
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tx-amount">Valor</Label>
              <MoneyInput id="tx-amount" value={amount} onChange={setAmount} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-date">Data</Label>
              <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-category">Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="tx-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem categoria</SelectItem>
                  {typeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-status">Situação</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TransactionStatus)}>
                <SelectTrigger id="tx-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">{type === "income" ? "Recebido" : "Pago"}</SelectItem>
                  <SelectItem value="pending">{type === "income" ? "A receber" : "A pagar"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-project">Projeto</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="tx-project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Geral da equipe (sem projeto)</SelectItem>
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

          <div className="space-y-2">
            <Label htmlFor="tx-notes">Observações</Label>
            <Textarea
              id="tx-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nº da nota, forma de pagamento…"
              maxLength={2000}
              className="min-h-16"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !description.trim()}>
              {pending && <Loader2 className="animate-spin" />}
              {transaction ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
