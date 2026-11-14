import { describe, expect, it } from "vitest";
import { EMPTY_WHATSAPP_COMMUNITY, usableCommunityConfig, validWhatsAppInvitationUrl } from "./whatsapp-community";

describe("WhatsApp Community configuration", () => {
  it("accepts only HTTPS WhatsApp group invitation links", () => {
    expect(validWhatsAppInvitationUrl("https://chat.whatsapp.com/AbCd123XYZ")).toBe("https://chat.whatsapp.com/AbCd123XYZ");
    expect(validWhatsAppInvitationUrl("http://chat.whatsapp.com/AbCd123XYZ")).toBeNull();
    expect(validWhatsAppInvitationUrl("https://wa.me/2348065301413")).toBeNull();
    expect(validWhatsAppInvitationUrl("https://chat.whatsapp.com.evil.example/AbCd123XYZ")).toBeNull();
  });

  it("disables an invitation when the official link is missing", () => {
    expect(usableCommunityConfig({ enabled: true, url: null })).toEqual(EMPTY_WHATSAPP_COMMUNITY);
  });

  it("does not enable a malformed or unsupported link", () => {
    expect(usableCommunityConfig({ enabled: true, url: "javascript:alert(1)" })).toEqual(EMPTY_WHATSAPP_COMMUNITY);
  });

  it("keeps a valid enabled invitation available to every surface", () => {
    expect(usableCommunityConfig({ enabled: true, url: "https://chat.whatsapp.com/OfficialInvite" })).toEqual({
      enabled: true,
      url: "https://chat.whatsapp.com/OfficialInvite",
    });
  });
});
