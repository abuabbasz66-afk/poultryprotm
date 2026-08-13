import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { usePresenceHeartbeat } from "@/lib/presence";
import { useAuthUserId } from "@/lib/farm-data";
import { AppShell } from "@/components/app-sidebar";
import { useFarmContext } from "@/lib/rbac";
import { ForcePasswordChange } from "@/components/force-password-change";
import { useLocationTracker } from "@/lib/use-location-tracker";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href ?? location.pathname } });
    }
    // If the authenticated user has no farm yet, force them through onboarding.
    if (location.pathname !== "/onboarding") {
      const { data: farm } = await supabase
        .from("farms")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!farm) {
        throw redirect({ to: "/onboarding" });
      }
    }
    return { user: data.user };
  },
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  const { data: userId } = useAuthUserId();
  const { data: ctx } = useFarmContext();
  usePresenceHeartbeat(userId ?? null);

  if (ctx?.mustChangePassword) {
    return <ForcePasswordChange fullName={ctx.fullName} />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

