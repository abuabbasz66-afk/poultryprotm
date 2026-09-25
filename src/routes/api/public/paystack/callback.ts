import { createFileRoute } from "@tanstack/react-router";
import { appUrl } from "@/lib/paystack.server";
import { findPaymentByReference } from "@/lib/paystack-billing.server";

/**
 * Public browser redirect target after Paystack checkout.
 *
 * This route is READ-ONLY: it never activates a plan or changes payment
 * status. Plan activation happens exclusively in the signature-verified
 * webhook (/api/public/paystack/webhook) or the authenticated recovery flow.
 */
export const Route = createFileRoute("/api/public/paystack/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const base = appUrl(request);
        const url = new URL(request.url);
        const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
        const go = (state: "success" | "failed" | "pending") =>
          Response.redirect(`${base}/subscriptions?payment=${state}`, 302);
        if (!reference || reference.length > 200) return go("failed");

        const pending = await findPaymentByReference(reference);
        if (!pending) return go("failed");
        if (pending.status === "success") return go("success");
        if (pending.status === "failed") return go("failed");
        return go("pending");
      },
    },
  },
});
