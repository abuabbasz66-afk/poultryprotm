import { createFileRoute } from "@tanstack/react-router";

// Temporary diagnostic endpoint (no secrets, no PII) for weather connectivity.
export const Route = createFileRoute("/api/public/weather-diag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q") ?? "Katsina, Nigeria";
        const out: Record<string, unknown> = { q };
        try {
          const g = await fetch(
            "https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" +
              encodeURIComponent(q),
          );
          out['geoStatus'] = g.status;
          const gj: any = await g.json();
          out['geoHit'] = gj?.results?.[0] ?? null;
          const lat = gj?.results?.[0]?.latitude ?? 12.99;
          const lon = gj?.results?.[0]?.longitude ?? 7.6;
          const f = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=7&past_days=10&current=temperature_2m,relative_humidity_2m&hourly=temperature_2m&daily=temperature_2m_max`,
          );
          out['fcStatus'] = f.status;
          const t = await f.text();
          out['fcSample'] = t.slice(0, 200);
        } catch (e) {
          out['error'] = String((e as Error)?.stack ?? e);
        }
        return Response.json(out);
      },
    },
  },
});
