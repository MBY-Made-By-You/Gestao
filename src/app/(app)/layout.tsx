import { SidebarContent } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, color")
    .in("status", ["active", "planning"])
    .order("updated_at", { ascending: false })
    .limit(8);

  const user = {
    name: profile.full_name,
    email: profile.email,
    avatarUrl: profile.avatar_url,
    role: profile.role,
  };

  return (
    <div className="bg-app min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-sidebar-border bg-sidebar/90 backdrop-blur-xl lg:block">
        <SidebarContent user={user} projects={projects ?? []} />
      </aside>
      <MobileNav user={user} projects={projects ?? []} />
      <div className="lg:pl-[264px]">
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
