import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
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
  component: () => <Outlet />,
});
