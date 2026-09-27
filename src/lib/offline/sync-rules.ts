/**
 * Pure synchronisation rules (no IndexedDB / network) so they can be unit
 * tested: business keys, error classification and outbox coalescing.
 */

/**
 * Tables whose rows are identified by a natural key in the database, not only
 * by id. Verified against the schema: egg_production has
 * UNIQUE (farm_id, date) — "egg_production_farm_id_date_key".
 */
export const BUSINESS_KEYS: Record<string, readonly string[]> = {
  egg_production: ["farm_id", "date"],
};

export function businessKeyOf(table: string, row: Record<string, unknown>): string | null {
  const cols = BUSINESS_KEYS[table];
  if (!cols) return null;
  const parts = cols.map((c) => row[c]);
  if (parts.some((p) => p == null || p === "")) return null;
  return parts.map(String).join("|");
}

export type SyncErrorKind = "temporary" | "permanent";
export type ClassifiedError = { kind: SyncErrorKind; message: string; code: string | null };

type ErrLike = { message?: string; code?: string; status?: number; details?: string };

/**
 * Temporary = worth retrying automatically (network, timeouts, 5xx, expired
 * session). Permanent = the same request will keep failing (RLS, schema,
 * constraint, bad data) and needs review. The message is user-safe.
 */
export function classifySyncError(err: unknown): ClassifiedError {
  const e = (err ?? {}) as ErrLike;
  const raw = String(e.message ?? err ?? "").toLowerCase();
  const code = e.code ? String(e.code) : null;
  const status = typeof e.status === "number" ? e.status : null;

  const temp = (message: string): ClassifiedError => ({ kind: "temporary", message, code });
  const perm = (message: string): ClassifiedError => ({ kind: "permanent", message, code });

  if (
    raw.includes("failed to fetch") ||
    raw.includes("network") ||
    raw.includes("load failed") ||
    raw.includes("fetch failed") ||
    raw.includes("timeout") ||
    raw.includes("timed out") ||
    raw.includes("econnreset") ||
    raw.includes("connection")
  ) {
    return temp("Connection problem — will retry automatically.");
  }
  if (code === "PGRST301" || code === "PGRST303" || raw.includes("jwt expired") || status === 401) {
    return temp("Session needs refreshing — will retry after you sign in.");
  }
  if (status != null && (status >= 500 || status === 408 || status === 429)) {
    return temp("Server temporarily unavailable — will retry automatically.");
  }
  if (code === "57014" || code === "53300" || code === "40001" || code === "40P01") {
    return temp("Server was busy — will retry automatically.");
  }

  if (code === "42501" || status === 403 || raw.includes("row-level security")) {
    return perm("You don't have permission to save this record for this farm.");
  }
  if (code === "23505") return perm("A record with the same details already exists.");
  if (code === "23503") return perm("This record refers to something that no longer exists (e.g. a deleted room).");
  if (code === "23502" || code === "23514") return perm("Some required information is missing or invalid.");
  if (code?.startsWith("22")) return perm("A value has the wrong format.");
  if (code === "42703" || code === "42P01" || code === "PGRST204" || code === "PGRST205") {
    return perm("This record doesn't match the current app version. Please update the app.");
  }
  if (code?.startsWith("23") || code?.startsWith("42") || code?.startsWith("PGRST")) {
    return perm("The server rejected this record.");
  }
  if (status != null && status >= 400) return perm("The server rejected this record.");
  // Unknown: treat as temporary but capped by MAX_TEMP_ATTEMPTS in the engine.
  return temp("Could not sync yet — will retry automatically.");
}

/** Temporary errors eventually stop auto-retrying so nothing loops forever. */
export const MAX_TEMP_ATTEMPTS = 20;

export type CoalesceItem = {
  id: string;
  table: string;
  op: "insert" | "update" | "delete";
  rowId: string | null;
  farmId: string | null;
  status: string;
  payload: Record<string, unknown>;
};

export type CoalesceAction<T> =
  | { kind: "append" }
  | { kind: "merge-into"; target: T; payload: Record<string, unknown> }
  | { kind: "drop-insert"; target: T };

/**
 * Decide how a new write combines with writes still waiting in the outbox so
 * repeated taps / edits of an unsynced record never produce extra rows.
 */
export function coalesce<T extends CoalesceItem>(
  queued: T[],
  next: Omit<CoalesceItem, "id" | "status">,
): CoalesceAction<T> {
  const open = queued.filter((q) => q.table === next.table && q.status !== "conflict");

  if (next.op === "insert") {
    const key = businessKeyOf(next.table, { farm_id: next.farmId, ...next.payload });
    if (key) {
      const same = open.find(
        (q) => q.op === "insert" && businessKeyOf(q.table, { farm_id: q.farmId, ...q.payload }) === key,
      );
      if (same) return { kind: "merge-into", target: same, payload: { ...same.payload, ...next.payload } };
    }
    return { kind: "append" };
  }

  if (!next.rowId) return { kind: "append" };
  const pendingInsert = open.find((q) => q.op === "insert" && q.rowId === next.rowId);
  if (!pendingInsert) return { kind: "append" };
  if (next.op === "update") {
    return { kind: "merge-into", target: pendingInsert, payload: { ...pendingInsert.payload, ...next.payload } };
  }
  return { kind: "drop-insert", target: pendingInsert };
}

/** Did the cloud row change (for the fields we touch) since our snapshot? */
export function detectConflict(
  base: Record<string, unknown> | null,
  cloud: Record<string, unknown> | null,
  patch: Record<string, unknown>,
): boolean {
  if (!base || !cloud) return false;
  return Object.keys(patch).some((k) => {
    if (!(k in base)) return false;
    return JSON.stringify(base[k] ?? null) !== JSON.stringify(cloud[k] ?? null);
  });
}

/** For an insert that meets an existing natural-key row: does it differ? */
export function differsFrom(cloud: Record<string, unknown>, payload: Record<string, unknown>): boolean {
  return Object.keys(payload).some(
    (k) => k in cloud && JSON.stringify(cloud[k] ?? null) !== JSON.stringify(payload[k] ?? null),
  );
}
