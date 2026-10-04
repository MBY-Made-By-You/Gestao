import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KanbanBoard } from "@/components/kanban/kanban-board";
import { requireProfile } from "@/lib/auth";
import { getBoardData } from "@/server/queries/board";

export const metadata: Metadata = { title: "Quadro" };

export default async function BoardPage({ params, searchParams }: PageProps<"/projects/[projectId]/board">) {
  const [{ projectId }, { task }, profile] = await Promise.all([params, searchParams, requireProfile()]);
  const data = await getBoardData(projectId);
  if (!data) notFound();

  return (
    <KanbanBoard
      data={data}
      canEdit={profile.isStaff}
      currentUserId={profile.id}
      initialTaskId={typeof task === "string" ? task : null}
    />
  );
}
