import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Boxes, Package, PackageMinus } from "lucide-react";

import { ResourcesView } from "@/components/finance/resources-view";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { getResourcesOverview } from "@/server/queries/finance";

export const metadata: Metadata = { title: "Insumos" };

export default async function ResourcesPage() {
  const profile = await requireStaff();
  const data = await getResourcesOverview();
  const maxConsumption = Math.max(1, ...data.consumptionByProject.map((p) => p.total));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestão financeira"
        title="Insumos e recursos"
        description="Estoque de materiais para projetos com produtos físicos — custo médio ponderado e consumo por projeto."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/finance">
              <ArrowLeft /> Financeiro
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Itens cadastrados" value={data.resources.length} icon={Package} />
        <StatTile label="Valor em estoque" value={formatCurrency(data.stockValue)} icon={Boxes} tone="neutral" />
        <StatTile
          label="Abaixo do mínimo"
          value={data.lowStock}
          hint={data.lowStock ? "Hora de repor" : "Estoque saudável"}
          icon={AlertTriangle}
          tone={data.lowStock ? "warning" : "success"}
        />
        <StatTile label="Consumo no mês" value={formatCurrency(data.monthConsumption)} icon={PackageMinus} tone="brand" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <ResourcesView
          resources={data.resources}
          movements={data.movements}
          projects={data.projects}
          isAdmin={profile.isAdmin}
        />
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Consumo por projeto</CardTitle>
            <CardDescription>Valor dos materiais (movimentações recentes)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.consumptionByProject.length ? (
              <ul className="space-y-3">
                {data.consumptionByProject.map((p) => (
                  <li key={p.id} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="size-2 rounded-[3px]" style={{ backgroundColor: p.color }} />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(p.total)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-chart-1" style={{ width: `${(p.total / maxConsumption) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Registre saídas vinculadas a projetos para ver o consumo.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
