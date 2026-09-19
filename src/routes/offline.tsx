import { createFileRoute } from "@tanstack/react-router";
import { WifiOff, RefreshCw } from "lucide-react";
import { useSyncState } from "@/lib/offline/status";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/offline")({
  component: OfflinePage,
  head: () => ({
    meta: [
      { title: "Offline — PoultryPro" },
      { name: "description", content: "PoultryPro is temporarily offline. Reconnect to continue recording and synchronising your farm data." },
      { property: "og:title", content: "Offline — PoultryPro" },
      { property: "og:description", content: "Reconnect to continue recording and synchronising farm data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function OfflinePage() {
  const { online } = useSyncState();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
          <WifiOff className="h-6 w-6 text-amber-600" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">PoultryPro is temporarily offline.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reconnect to continue recording and synchronising farm data.
        </p>
        <p className="mt-4 text-xs font-medium text-muted-foreground">
          {online ? "Connected" : "Offline — reconnecting..."}
        </p>
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    </div>
  );
}
