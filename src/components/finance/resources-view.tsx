"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/brand/empty-state";
import { MoneyInput } from "@/components/shared/money-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/misc";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, formatNumber, toDateInput } from "@/lib/format";
import { parseMoney } from "@/lib/money";
import type { MovementType, Resource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createMovement, deleteMovement, deleteResource, saveResource } from "@/server/actions/finance";
import type { MovementRow } from "@/server/queries/finance";

type ProjectOption = { id: string; name: string; color: string };
const NONE = "__none__";

export function ResourcesView({
  resources,
  movements,
  projects,
  isAdmin,
}: {
  resources: Resource[];
  movements: MovementRow[];
  projects: ProjectOption[];
  isAdmin: boolean;
}) {
  const [resourceDialog, setResourceDialog] = useState<{ open: boolean; resource: Resource | null }>({ open: false, resource: null });
  const [movementDialog, setMovementDialog] = useState<{ open: boolean; resource: Resource | null; type: MovementType }>({
    open: false,
    resource: null,
    type: "in",
  });
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error ?? "Erro");
      else toast.success(success);
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold">Estoque</h2>
          <Button size="sm" onClick={() => setResourceDialog({ open: true, resource: null })}>
            <Plus /> Novo insumo
          </Button>
        </div>

        {resources.length === 0 ? (
          <EmptyState
            compact
            title="Nenhum insumo cadastrado"
            description="Cadastre materiais e componentes (ex.: Arduino, filamento PLA, sensores) para controlar estoque e custos por projeto."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Insumo</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Custo médio</TableHead>
                  <TableHead className="text-right">Valor em estoque</TableHead>
                  <TableHead className="w-56 text-right">Movimentar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((r) => {
                  const low = r.min_quantity > 0 && r.quantity <= r.min_quantity;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-semibold">{r.name}</p>
                        {r.sku && <p className="text-xs text-muted-foreground">SKU {r.sku}</p>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.supplier || "—"}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold tabular-nums">
                          {formatNumber(r.quantity)} {r.unit}
                        </span>
                        {low && (
                          <Badge variant="warning" className="ml-2">
                            <AlertTriangle /> Baixo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.unit_cost)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(r.quantity * r.unit_cost)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setMovementDialog({ open: true, resource: r, type: "in" })}>
                            <ArrowDownToLine /> Entrada
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setMovementDialog({ open: true, resource: r, type: "out" })}
                            disabled={r.quantity <= 0}
                          >
                            <ArrowUpFromLine /> Saída
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${r.name}`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setResourceDialog({ open: true, resource: r })}>
                                <Pencil /> Editar
                              </DropdownMenuItem>
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => run(() => deleteResource(r.id), "Insumo excluído")}
                                  >
                                    <Trash2 /> Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-extrabold">Movimentações recentes</h2>
        {movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Data</TableHead>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Por</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground tabular-nums">{formatDate(m.occurred_on, "dd/MM/yy")}</TableCell>
                    <TableCell className="font-semibold">{m.resource?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={m.type === "in" ? "success" : "soft"}>
                        {m.type === "in" ? <ArrowDownToLine /> : <ArrowUpFromLine />}
                        {m.type === "in" ? "Entrada" : "Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(m.quantity)} {m.resource?.unit}
                    </TableCell>
                    <TableCell>
                      {m.project ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className="size-2 rounded-[3px]" style={{ backgroundColor: m.project.color }} />
                          {m.project.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m.quantity * m.unit_cost)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.author?.full_name ?? "—"}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Estornar movimentação"
                          aria-label="Estornar movimentação"
                          disabled={pending}
                          onClick={() => run(() => deleteMovement(m.id), "Movimentação estornada")}
                        >
                          <Undo2 />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {resourceDialog.open && (
        <ResourceDialog
          key={resourceDialog.resource?.id ?? "new"}
          resource={resourceDialog.resource}
          onOpenChange={(open) => setResourceDialog((d) => ({ ...d, open }))}
        />
      )}
      {movementDialog.open && movementDialog.resource && (
        <MovementDialog
          key={`${movementDialog.resource.id}-${movementDialog.type}`}
          resource={movementDialog.resource}
          type={movementDialog.type}
          projects={projects}
          onOpenChange={(open) => setMovementDialog((d) => ({ ...d, open }))}
        />
      )}
    </div>
  );
}

function ResourceDialog({ resource, onOpenChange }: { resource: Resource | null; onOpenChange: (open: boolean) => void }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(resource?.name ?? "");
  const [sku, setSku] = useState(resource?.sku ?? "");
  const [unit, setUnit] = useState(resource?.unit ?? "un");
  const [minQuantity, setMinQuantity] = useState(resource ? String(resource.min_quantity) : "0");
  const [supplier, setSupplier] = useState(resource?.supplier ?? "");
  const [notes, setNotes] = useState(resource?.notes ?? "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveResource(resource?.id ?? null, {
        name,
        sku: sku.trim() || null,
        unit,
        min_quantity: parseMoney(minQuantity) ?? 0,
        supplier: supplier.trim() || null,
        notes: notes.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(resource ? "Insumo atualizado" : "Insumo cadastrado — registre uma entrada para formar o estoque");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{resource ? "Editar insumo" : "Novo insumo"}</DialogTitle>
            <DialogDescription>O saldo e o custo médio são calculados pelas movimentações.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div className="space-y-2">
              <Label htmlFor="res-name">Nome</Label>
              <Input id="res-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-unit">Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="res-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["un", "kg", "g", "m", "cm", "l", "ml", "pct", "cx", "rolo"].map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="res-sku">SKU / código</Label>
              <Input id="res-sku" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={60} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-min">Estoque mínimo</Label>
              <Input
                id="res-min"
                inputMode="decimal"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-supplier">Fornecedor</Label>
            <Input id="res-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-notes">Observações</Label>
            <Textarea id="res-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className="min-h-16" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({
  resource,
  type,
  projects,
  onOpenChange,
}: {
  resource: Resource;
  type: MovementType;
  projects: ProjectOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [date, setDate] = useState(toDateInput());
  const [projectId, setProjectId] = useState(NONE);
  const [note, setNote] = useState("");
  const [createExpense, setCreateExpense] = useState(true);
  const isIn = type === "in";
  const qty = parseMoney(quantity) ?? 0;
  const cost = parseMoney(unitCost) ?? 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (qty <= 0) return void toast.error("Informe a quantidade.");
    startTransition(async () => {
      const result = await createMovement({
        resource_id: resource.id,
        type,
        quantity: qty,
        unit_cost: isIn ? cost : undefined,
        occurred_on: date,
        project_id: projectId === NONE ? null : projectId,
        note: note.trim() || null,
        create_expense: isIn && createExpense,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isIn ? "Entrada registrada" : "Saída registrada");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isIn ? <ArrowDownToLine className="size-5 text-success" /> : <ArrowUpFromLine className="size-5 text-brand" />}
              {isIn ? "Entrada" : "Saída"} · {resource.name}
            </DialogTitle>
            <DialogDescription>
              Em estoque: {formatNumber(resource.quantity)} {resource.unit} · custo médio {formatCurrency(resource.unit_cost)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mov-qty">Quantidade ({resource.unit})</Label>
              <Input id="mov-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} required autoFocus />
            </div>
            {isIn ? (
              <div className="space-y-2">
                <Label htmlFor="mov-cost">Custo unitário</Label>
                <MoneyInput id="mov-cost" value={unitCost} onChange={setUnitCost} required />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="mov-date">Data</Label>
                <Input id="mov-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            )}
          </div>
          {isIn && (
            <div className="space-y-2">
              <Label htmlFor="mov-date-in">Data da compra</Label>
              <Input id="mov-date-in" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="mov-project">{isIn ? "Projeto (opcional)" : "Consumido no projeto"}</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="mov-project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{isIn ? "Estoque geral" : "Uso geral (sem projeto)"}</SelectItem>
                <SelectSeparator />
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isIn && (
              <p className="text-xs text-muted-foreground">
                O custo ({formatCurrency(qty * resource.unit_cost)}) entra como material consumido do projeto.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mov-note">Observação</Label>
            <Input id="mov-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </div>
          {isIn && (
            <label className="flex items-start justify-between gap-4 rounded-xl border p-3">
              <span>
                <span className="block text-sm font-semibold">Lançar como despesa</span>
                <span className="block text-xs text-muted-foreground">
                  Registra {formatCurrency(qty * cost)} em “Materiais e insumos” (custo geral).
                </span>
              </span>
              <Switch checked={createExpense} onCheckedChange={setCreateExpense} />
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} className={cn(!isIn && "bg-brand")}>
              {pending && <Loader2 className="animate-spin" />}
              Registrar {isIn ? "entrada" : "saída"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
