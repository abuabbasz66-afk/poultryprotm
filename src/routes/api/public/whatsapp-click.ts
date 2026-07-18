import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  page_path: z.string().max(500).optional().nullable(),
  page_label: z.string().max(120).optional().nullable(),
  user_type: z.enum(["guest", "registered", "admin"]).optional(),
  user_id: z.string().uuid().optional().nullable(),
  device_type: z.enum(["Mobile", "Tablet", "Desktop", "Unknown"]).optional(),
  browser: z.string().max(60).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  referrer_source: z.string().max(60).optional().nullable(),
  session_id: z.string().max(80).optional().nullable(),
  kind: z.enum(["click", "visit"]).optional(),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/whatsapp-click")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return jsonRes({ ok: false, error: "invalid_json" }, 400);
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return jsonRes({ ok: false, error: "invalid_payload" }, 400);
        }
        const b = parsed.data;

        // Cloudflare Workers expose geo hints via request headers.
        const headers = request.headers;
        const country =
          headers.get("cf-ipcountry") ||
          headers.get("x-vercel-ip-country") ||
          null;
        const city =
          headers.get("cf-ipcity") ||
          headers.get("x-vercel-ip-city") ||
          null;
        const user_agent = (headers.get("user-agent") || "").slice(0, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (b.kind === "visit") {
            const { error } = await supabaseAdmin.from("landing_visits").insert({
              page_label: b.page_label ?? null,
              session_id: b.session_id ?? null,
            });
            if (error) return jsonRes({ ok: false, error: "db_error" }, 500);
            return jsonRes({ ok: true });
          }

          const { error } = await supabaseAdmin.from("whatsapp_clicks").insert({
            page_path: b.page_path ?? null,
            page_label: b.page_label ?? null,
            user_type: b.user_type ?? "guest",
            user_id: b.user_id ?? null,
            device_type: b.device_type ?? "Unknown",
            browser: b.browser ?? null,
            country,
            city,
            referrer: b.referrer ?? null,
            referrer_source: b.referrer_source ?? null,
            session_id: b.session_id ?? null,
            user_agent,
          });
          if (error) return jsonRes({ ok: false, error: "db_error" }, 500);
          return jsonRes({ ok: true });
        } catch {
          return jsonRes({ ok: false, error: "server_error" }, 500);
        }
      },
    },
  },
});
