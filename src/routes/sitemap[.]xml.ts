import { createFileRoute } from "@tanstack/react-router";
import { buildPublicSitemap, loadPublicTutorials } from "@/lib/public-sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const backendUrl = process.env.SUPABASE_URL;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!backendUrl || !publishableKey) {
          return new Response("Sitemap temporarily unavailable", { status: 503 });
        }
        try {
          const tutorials = await loadPublicTutorials(async (offset, limit) => {
            const url = new URL("/rest/v1/academy_tutorials", backendUrl);
            url.search = new URLSearchParams({
              select: "slug,is_published,is_archived",
              is_published: "eq.true",
              is_archived: "eq.false",
              order: "id.asc",
              offset: String(offset),
              limit: String(limit),
            }).toString();
            // Public, sessionless read: never use an admin key or a user's bearer.
            const response = await fetch(url, { headers: { apikey: publishableKey } });
            if (!response.ok) throw new Error(`Public tutorial read failed (${response.status})`);
            return response.json();
          });
          return new Response(buildPublicSitemap(tutorials), {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
          });
        } catch (error) {
          console.error("Sitemap generation failed", error);
          return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
        }
      },
    },
  },
});
