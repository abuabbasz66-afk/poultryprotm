import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const WHATSAPP_COMMUNITY_KEY = "whatsapp_community";
export const WHATSAPP_LINK_PLACEHOLDER = "[INSERT OFFICIAL POULTRYPRO WHATSAPP INVITATION LINK]";

export type WhatsAppCommunityConfig = {
  enabled: boolean;
  url: string | null;
};

export const EMPTY_WHATSAPP_COMMUNITY: WhatsAppCommunityConfig = {
  enabled: false,
  url: null,
};

export function validWhatsAppInvitationUrl(value: string | null | undefined): string | null {
  const cleaned = value?.trim() ?? "";
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "https:" || url.hostname !== "chat.whatsapp.com") return null;
    if (!/^\/[A-Za-z0-9]+\/?$/.test(url.pathname)) return null;
    return cleaned;
  } catch {
    return null;
  }
}

export function usableCommunityConfig(value: unknown): WhatsAppCommunityConfig {
  if (!value || typeof value !== "object") return EMPTY_WHATSAPP_COMMUNITY;
  const candidate = value as Record<string, unknown>;
  const url = validWhatsAppInvitationUrl(typeof candidate.url === "string" ? candidate.url : null);
  return { enabled: candidate.enabled === true && !!url, url };
}

export function useWhatsAppCommunity() {
  return useQuery({
    queryKey: [WHATSAPP_COMMUNITY_KEY],
    staleTime: 60_000,
    queryFn: async (): Promise<WhatsAppCommunityConfig> => {
      const { data, error } = await supabase.rpc("get_whatsapp_community");
      if (error) throw error;
      return usableCommunityConfig(data);
    },
  });
}

export function useSaveWhatsAppCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: WhatsAppCommunityConfig) => {
      const { data, error } = await supabase.rpc("admin_set_whatsapp_community", {
        _enabled: config.enabled,
        _url: config.url ?? "",
      });
      if (error) throw error;
      return usableCommunityConfig(data);
    },
    onSuccess: (saved) => {
      qc.setQueryData([WHATSAPP_COMMUNITY_KEY], saved);
      qc.invalidateQueries({ queryKey: ["admin-monitoring"] });
    },
  });
}
