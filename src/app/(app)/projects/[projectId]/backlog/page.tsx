import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BacklogView } from "@/components/backlog/backlog-view";
import { requireProfile } from "@/lib/auth";
import { getBacklogData } from "@/server/queries/board";

export const metadata: Metadata = { title: "Backlog e sprints" };

export default async function BacklogPage({ params }: PageProps<"/projects/[projectId]/backlog">) {
  const [{ projectId }, profile] = await Promise.all([params, requireProfile()]);
  const data = await getBacklogData(projectId);
  if (!data) notFound();

  return (
    <BacklogView
      project={data.project}
      tasks={data.tasks}
      columns={data.columns}
      tags={data.tags}
      sprints={data.sprints}
      sprintTasks={data.sprintTasks}
      members={data.members}
      canEdit={profile.isStaff}
      currentUserId={profile.id}
    />
  );
}
