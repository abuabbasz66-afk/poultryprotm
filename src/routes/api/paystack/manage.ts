import { createFileRoute } from "@tanstack/react-router";
import { jsonRes, paystackFetch, resolveBillingContext } from "@/lib/paystack.server";

export const Route = createFileRoute("/api/paystack/manage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await resolveBillingContext(request);
        if ("error" in ctx) return ctx.error;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;
        const { data: farm } = await admin
          .from("farms")
          .select("paystack_subscription_code")
          .eq("id", ctx.farmId)
          .maybeSingle();

        const code = farm?.paystack_subscription_code as string | undefined;
        if (!code) return jsonRes({ error: "no_subscription" }, 404);

        const res = await paystackFetch<{ status: boolean; data?: { link: string } }>(
          `/subscription/${encodeURIComponent(code)}/manage/link`,
        );
        if (!res.ok || !res.body?.status || !res.body.data?.link) {
          return jsonRes({ error: "paystack_error" }, 502);
        }
        return jsonRes({ link: res.body.data.link });
      },
    },
  },
});
