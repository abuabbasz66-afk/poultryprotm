import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Signed-out login helpers. The phone → email lookup and failed-login logging
 * used to be callable straight from the browser, which let anyone discover the
 * email behind a phone number and flood the security log. Both now run here,
 * throttled per identifier and per network address, and never reveal whether
 * an account exists.
 */

const WINDOW_MINUTES = 15;
const MAX_PER_IDENTIFIER = 5;
const MAX_PER_IP = 30;
const GENERIC_ERROR = "Invalid login credentials";

async function sha256(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp() {
  const h = getRequest()?.headers;
  return (
    h?.get("cf-connecting-ip") || h?.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Records one attempt and reports whether the caller is still under both limits. */
async function underLimit(admin: Admin, bucket: string, identifier: string) {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const [idHash, ipHash] = await Promise.all([sha256(identifier), sha256(clientIp())]);
  const count = async (key: string) => {
    const { count: n } = await admin
      .from("auth_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("bucket", bucket)
      .eq("key_hash", key)
      .gte("created_at", since);
    return n ?? 0;
  };
  const [byId, byIp] = await Promise.all([count(`id:${idHash}`), count(`ip:${ipHash}`)]);
  if (byId >= MAX_PER_IDENTIFIER || byIp >= MAX_PER_IP) return false;
  await admin.from("auth_rate_limits").insert([
    { bucket, key_hash: `id:${idHash}` },
    { bucket, key_hash: `ip:${ipHash}` },
  ]);
  return true;
}

async function logFailed(admin: Admin, identifier: string, detail: string) {
  await admin.rpc("log_security_event", {
    _event_type: "login_failed",
    _identifier: identifier,
    _detail: detail.slice(0, 200),
  });
}

/** Phone-number sign-in. Returns session tokens; the email is never sent to the browser. */
export const signInWithPhone = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; password: string }) => {
    const phone = String(input?.phone ?? "").replace(/[^0-9]/g, "");
    const password = String(input?.password ?? "");
    if (phone.length < 7 || phone.length > 15 || !password || password.length > 200) {
      throw new Error(GENERIC_ERROR);
    }
    return { phone, password };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await underLimit(supabaseAdmin, "phone_login", data.phone))) {
      return {
        ok: false as const,
        error: "Too many sign-in attempts. Please wait 15 minutes and try again.",
      };
    }
    const { data: email } = await supabaseAdmin.rpc("resolve_login_email", {
      _identifier: data.phone,
    });
    if (typeof email !== "string" || !email) return { ok: false as const, error: GENERIC_ERROR };

    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const authClient = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: auth, error } = await authClient.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !auth.session) {
      await logFailed(supabaseAdmin, email, error?.message ?? "sign-in failed");
      return { ok: false as const, error: GENERIC_ERROR };
    }
    return {
      ok: true as const,
      access_token: auth.session.access_token,
      refresh_token: auth.session.refresh_token,
    };
  });

/** Throttled failed-login report for email sign-ins (signed-out callers). */
export const reportFailedLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { identifier: string }) => {
    const identifier = String(input?.identifier ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 254);
    if (!identifier) throw new Error("Missing identifier");
    return { identifier };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (await underLimit(supabaseAdmin, "failed_login_log", data.identifier)) {
      await logFailed(supabaseAdmin, data.identifier, "Invalid login credentials");
    }
    return { ok: true };
  });
