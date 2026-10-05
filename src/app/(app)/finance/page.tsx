import type { Metadata } from "next";
import Link from "next/link";
import { addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Landmark, Package, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { CashflowChart } from "@/components/charts/cashflow-chart";
import { TransactionsTable } from "@/components/finance/transactions-table";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth";
import { formatCurrency, formatMonthYear, formatPercent, toMonthInput, todayInAppTimeZone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getFinanceOverview } from "@/server/queries/finance";

export const metadata: Metadata = { title: "Financeiro" };

export default async function FinancePage({ searchParams }: PageProps<"/finance">) {
  const [{ month: monthParam }, profile] = await Promise.all([searchParams, requireStaff()]);
  const data = await getFinanceOverview(typeof monthParam === "string" ? monthParam : undefined);
  const monthLabel = formatMonthYear(data.month);
  const prev = toMonthInput(subMonths(data.month, 1));
  const next = toMonthInput(addMonths(data.month, 1));
  const isCurrent = toMonthInput(data.month) === toMonthInput(todayInAppTimeZone());
  const maxCategory = Math.max(1, ...data.byCategory.map((c) => c.total));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestão financeira"
        title="Financeiro"
        description="Receitas e despesas por projeto ou gerais da equipe, com histórico mensal."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/finance/resources">
                <Package /> Insumos
              </Link>
            </Button>
            <div className="flex items-center gap-1 rounded-xl border bg-card p-1 shadow-xs">
              <Button asChild variant="ghost" size="icon-sm" aria-label="Mês anterior">
                <Link href={`/finance?month=${prev}`}>
                  <ChevronLeft />
                </Link>
              </Button>
              <span className="min-w-36 text-center text-sm font-bold">{monthLabel}</span>
              <Button asChild variant="ghost" size="icon-sm" aria-label="Próximo mês">
                <Link href={`/finance?month=${next}`}>
                  <ChevronRight />
                </Link>
              </Button>
              {!isCurrent && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/finance">Hoje</Link>
                </Button>
              )}
            </div>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Receitas do mês" value={formatCurrency(data.totals.income)} icon={TrendingUp} tone="success" />
        <StatTile label="Despesas do mês" value={formatCurrency(data.totals.expense)} icon={TrendingDown} tone="danger" />
        <StatTile
          label="Resultado do mês"
          value={formatCurrency(data.totals.balance)}
          hint={
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> A receber {formatCurrency(data.totals.pendingIncome)} · a pagar{" "}
              {formatCurrency(data.totals.pendingExpense)}
            </span>
          }
          icon={Wallet}
          tone={data.totals.balance >= 0 ? "brand" : "danger"}
        />
        <StatTile
          label="Saldo acumulado"
          value={formatCurrency(data.totals.accumulated)}
          hint="Tudo o que foi efetivado até este mês"
          icon={Landmark}
          tone={data.totals.accumulated >= 0 ? "brand" : "danger"}
        />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Histórico de 12 meses</CardTitle>
            <CardDescription>Receitas x despesas efetivadas — mês selecionado em destaque</CardDescription>
          </CardHeader>
          <CardContent>
            <CashflowChart data={data.history} height={280} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
            <CardDescription>{monthLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.byCategory.length ? (
              <ul className="space-y-3">
                {data.byCategory.map((c) => (
                  <li key={c.id} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(c.total)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-chart-2"
                        style={{ width: `${Math.max(2, (c.total / maxCategory) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {formatPercent(data.totals.expense ? c.total / data.totals.expense : 0)} das despesas
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem despesas efetivadas neste mês.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-extrabold">Lançamentos de {monthLabel.toLocaleLowerCase("pt-BR")}</h2>
        <TransactionsTable
          transactions={data.transactions}
          categories={data.categories}
          projects={data.projects}
          isAdmin={profile.isAdmin}
        />
      </section>

      {data.byProject.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custos por projeto</CardTitle>
            <CardDescription>Acumulado: despesas vinculadas + materiais consumidos do estoque</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Projeto</TableHead>
                  <TableHead className="text-right">Receitas</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Materiais</TableHead>
                  <TableHead className="text-right">Custo total</TableHead>
                  <TableHead className="pr-5">Orçamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byProject.map((p) => {
                  const ratio = p.budget ? p.totalCost / p.budget : 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-5">
                        <Link href={`/projects/${p.id}`} className="inline-flex items-center gap-2 font-semibold hover:underline">
                          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-success tabular-nums">{formatCurrency(p.income)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.expense)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.materials)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{formatCurrency(p.totalCost)}</TableCell>
                      <TableCell className="pr-5">
                        {p.budget ? (
                          <div className="flex min-w-40 items-center gap-2">
                            <Progress
                              value={Math.min(100, ratio * 100)}
                              className="h-1.5"
                              indicatorClassName={cn(ratio > 1 ? "bg-destructive" : ratio > 0.85 ? "bg-warning" : "bg-success")}
                              aria-label={`Orçamento de ${p.name}`}
                            />
                            <span className="text-xs font-semibold tabular-nums">{formatPercent(ratio)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem orçamento</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
