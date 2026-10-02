import { describe, expect, it } from "vitest";
import { resolveNotificationAction } from "./notification-registry";
import type { NotificationItem } from "@/lib/api/notifications-api";

const row = (
  actionType: string | null,
  actionPayload: Record<string, unknown> | null = null,
): NotificationItem => ({
  id: "n1",
  type: "TEST",
  category: "system",
  title: "Title",
  body: "Body",
  actionType,
  actionPayload,
  rolledCount: 1,
  readAt: null,
  archivedAt: null,
  createdAt: "2026-10-03T00:00:00.000Z",
});

describe("resolveNotificationAction", () => {
  it("links the chatbot actions without a payload", () => {
    expect(resolveNotificationAction(row("open_chatbots"))).toEqual({
      label: "Open chatbots",
      to: "/chatbot",
    });
    expect(resolveNotificationAction(row("open_chatbot_contacts"))).toEqual({
      label: "Open contacts",
      to: "/chatbot/contacts",
    });
  });

  it("links the handover alert the backend sends to the contacts page", () => {
    expect(resolveNotificationAction(row("OPEN_CHATBOT_CONTACT", { contactId: "c-123" }))).toEqual({
      label: "Open contacts",
      to: "/chatbot/contacts",
    });
  });

  it("matches action types regardless of case", () => {
    expect(resolveNotificationAction(row("Open_Chatbots"))?.to).toBe("/chatbot");
    expect(resolveNotificationAction(row("OPEN_AUTOMATION", { automationId: "a1" }))?.to).toBe(
      "/automations?id=a1",
    );
  });

  it("gives no action for unknown, empty or prototype keys", () => {
    expect(resolveNotificationAction(row(null))).toBeNull();
    expect(resolveNotificationAction(row(""))).toBeNull();
    expect(
      resolveNotificationAction(row("OPEN_URL", { url: "https://app.liffio.com/chatbot" })),
    ).toBeNull();
    expect(resolveNotificationAction(row("constructor"))).toBeNull();
    expect(resolveNotificationAction(row("__proto__"))).toBeNull();
  });
});
