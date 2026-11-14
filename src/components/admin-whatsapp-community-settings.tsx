import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/whatsapp-community-invitation";
import { usePlatformSettings } from "@/lib/admin-monitoring";
import {
  EMPTY_WHATSAPP_COMMUNITY,
  usableCommunityConfig,
  useSaveWhatsAppCommunity,
  validWhatsAppInvitationUrl,
  WHATSAPP_LINK_PLACEHOLDER,
} from "@/lib/whatsapp-community";

export function AdminWhatsAppCommunitySettings({ userId }: { userId: string }) {
  const settings = usePlatformSettings(userId, true);
  const save = useSaveWhatsAppCommunity();
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const current = usableCommunityConfig(settings.data?.whatsapp_community ?? EMPTY_WHATSAPP_COMMUNITY);

  useEffect(() => {
    if (!settings.data) return;
    const value = settings.data.whatsapp_community as Record<string, unknown> | undefined;
    setUrl(typeof value?.url === "string" ? value.url : "");
    setEnabled(value?.enabled === true);
  }, [settings.data]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned = url.trim();
    if (cleaned && !validWhatsAppInvitationUrl(cleaned)) {
      toast.error("Use a valid https://chat.whatsapp.com invitation link.");
      return;
    }
    if (enabled && !cleaned) {
      toast.error("Add the official invitation link before enabling it.");
      return;
    }
    try {
      await save.mutateAsync({ enabled, url: cleaned || null });
      await settings.refetch();
      toast.success(enabled ? "WhatsApp Community invitation enabled" : "WhatsApp Community settings saved");
    } catch (error) {
      toast.error("Could not save WhatsApp Community settings", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Settings className="h-4 w-4" /> Platform settings</span>
        <h1 className="mt-2 font-display text-3xl font-semibold">WhatsApp Community</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Manage the single invitation used on the public website, farmer dashboard and registration success screen.</p>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><WhatsAppIcon /></span>
          <div>
            <h2 className="font-semibold">Official invitation link</h2>
            <p className="mt-1 text-sm text-muted-foreground">Only official WhatsApp group invitation links are accepted. Saving here updates every invitation surface.</p>
          </div>
        </div>

        <label className="block text-sm font-medium" htmlFor="whatsapp-community-url">WhatsApp group invitation URL</label>
        <input
          id="whatsapp-community-url"
          type="text"
          inputMode="url"
          autoComplete="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={WHATSAPP_LINK_PLACEHOLDER}
          className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
          aria-describedby="whatsapp-community-help"
        />
        <p id="whatsapp-community-help" className="-mt-3 text-xs text-muted-foreground">Expected format: https://chat.whatsapp.com/…</p>

        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="mt-1 h-4 w-4 accent-[color:var(--primary)]" />
          <span>
            <span className="block text-sm font-medium">Show active Join buttons</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">When disabled or missing a valid link, the invitation remains visible but its button is unavailable.</span>
          </span>
        </label>

        <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Current status: <span className="font-medium text-foreground">{current.enabled ? "Enabled" : "Not active"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {current.enabled && current.url && (
              <Button asChild type="button" variant="outline"><a href={current.url} target="_blank" rel="noopener noreferrer">Preview <ExternalLink /></a></Button>
            )}
            <Button type="submit" disabled={save.isPending || settings.isPending}><Save /> {save.isPending ? "Saving…" : "Save settings"}</Button>
          </div>
        </div>
        {save.isSuccess && <p className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" /> Saved successfully.</p>}
      </form>
    </div>
  );
}
