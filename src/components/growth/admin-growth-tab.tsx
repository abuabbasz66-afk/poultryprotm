import { useGrowthStats, useGrowthDropoff, useAdminFeedback, pct } from "@/lib/growth";
import { format as fmtDate, parseISO } from "date-fns";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="text-[10px] uppercase tracking-widest text-[#12281c]/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[#12281c]">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[#12281c]/60">{sub}</div>}
    </div>
  );
}

function FunnelRow({ label, value, base }: { label: string; value: number; base: number }) {
  const p = pct(value, base);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-[#12281c]">{label}</span>
        <span className="tabular-nums text-[#12281c]/70">
          {value.toLocaleString()} · {p}%
        </span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[#12281c]/10">
        <div className="h-full rounded-full bg-[#c9a24a]" style={{ width: `${Math.min(100, p)}%` }} />
      </div>
    </div>
  );
}

/** Platform growth analytics. Every figure is computed from real records. */
export function AdminGrowthTab({ enabled = true }: { enabled?: boolean }) {
  const stats = useGrowthStats(enabled);
  const drop = useGrowthDropoff(enabled);
  const feedback = useAdminFeedback(enabled);

  if (stats.isPending) {
    return <div className="text-sm text-[#12281c]/60">Loading growth data…</div>;
  }
  if (stats.error || !stats.data) {
    return <div className="text-sm text-red-700">Could not load growth data.</div>;
  }
  const s = stats.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Registered users" value={s.total_users.toLocaleString()} sub={`${s.new_users_30d} in last 30 days`} />
        <Stat label="Farms created" value={s.total_farms.toLocaleString()} />
        <Stat label="Activated farms" value={s.activated_farms.toLocaleString()} sub={`${pct(s.activated_farms, s.total_farms)}% of farms`} />
        <Stat label="Repeat usage (3+ days)" value={s.repeat_usage_farms.toLocaleString()} />
        <Stat label="Free farms" value={s.free_farms.toLocaleString()} />
        <Stat label="Standard farms" value={s.standard_farms.toLocaleString()} />
        <Stat label="Premium farms" value={s.premium_farms.toLocaleString()} />
        <Stat label="Monthly recurring revenue" value={`₦${Number(s.mrr_ngn).toLocaleString()}`} sub="Active farms on paid plans" />
        <Stat label="Checkout started" value={s.checkout_started_farms.toLocaleString()} />
        <Stat label="Paying farms" value={s.paid_farms.toLocaleString()} />
        <Stat
          label="Farms on a paid plan"
          value={`${pct(s.paid_farms, s.total_farms)}%`}
          sub="Share of all farms that are paying"
        />
        <Stat label="Cancellations recorded" value={s.cancelled_events.toLocaleString()} />
      </div>

      <section className="rounded-xl border border-black/10 bg-white p-5">
        <h3 className="text-sm font-semibold text-[#12281c]">Activation funnel</h3>
        <p className="mb-4 mt-1 text-xs text-[#12281c]/60">
          Percentages are of registered users. Upgrade views are only counted from the
          date product event tracking went live.
        </p>
        <div className="space-y-3">
          <FunnelRow label="Registered" value={s.total_users} base={s.total_users} />
          <FunnelRow label="Farm created" value={s.total_farms} base={s.total_users} />
          <FunnelRow label="Activated" value={s.activated_farms} base={s.total_users} />
          <FunnelRow label="Repeated usage" value={s.repeat_usage_farms} base={s.total_users} />
          <FunnelRow label="Upgrade viewed" value={s.upgrade_viewed_farms} base={s.total_users} />
          <FunnelRow label="Checkout started" value={s.checkout_started_farms} base={s.total_users} />
          <FunnelRow label="Paid" value={s.paid_farms} base={s.total_users} />
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-5">
        <h3 className="text-sm font-semibold text-[#12281c]">Where users stop</h3>
        {drop.isPending ? (
          <div className="mt-3 text-sm text-[#12281c]/60">Loading…</div>
        ) : drop.data ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["Registered but no farm", drop.data.registered_no_farm],
              ["Farm created but no flock", drop.data.farm_no_flock],
              ["Farm created but no production", drop.data.farm_no_production],
              ["Used once, never returned", drop.data.single_session_farms],
              ["Never viewed a paid plan", drop.data.active_no_upgrade_view],
              ["Checkout started, never paid", drop.data.checkout_without_payment],
            ].map(([label, value]) => (
              <li
                key={String(label)}
                className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm"
              >
                <span className="text-[#12281c]/80">{label}</span>
                <span className="font-semibold tabular-nums text-[#12281c]">
                  {Number(value).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 text-sm text-red-700">Could not load drop-off data.</div>
        )}
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-5">
        <h3 className="text-sm font-semibold text-[#12281c]">User feedback</h3>
        {feedback.isPending ? (
          <div className="mt-3 text-sm text-[#12281c]/60">Loading…</div>
        ) : (feedback.data?.length ?? 0) === 0 ? (
          <div className="mt-3 text-sm text-[#12281c]/60">No feedback submitted yet.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-[#12281c]/60">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Type</th>
                  <th>Sentiment / reason</th>
                  <th>Message</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {feedback.data!.map((f) => (
                  <tr key={f.id} className="border-t border-black/5 align-top">
                    <td className="py-2 whitespace-nowrap text-[#12281c]/70">
                      {fmtDate(parseISO(f.created_at), "d MMM yyyy")}
                    </td>
                    <td className="capitalize">{f.kind}</td>
                    <td>{f.sentiment ?? f.reason ?? "—"}</td>
                    <td className="max-w-[320px]">{f.message ?? "—"}</td>
                    <td className="whitespace-nowrap text-[#12281c]/70">
                      {f.contact_email ?? f.contact_phone ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
