import { describe, expect, it } from "vitest";

import { duplicateStep, newStep, newWebhookSecret } from "./model";

describe("webhook signing secrets in the builder", () => {
  it("a new Webhook step has its secret before anything is saved", () => {
    const step = newStep("WEBHOOK", 0);
    expect(step.config.secret).toMatch(/^[0-9a-f]{48}$/);
  });

  it("every secret is different", () => {
    expect(newWebhookSecret()).not.toBe(newWebhookSecret());
  });

  it("a duplicated Webhook step signs with its own secret, not the original's", () => {
    const original = newStep("WEBHOOK", 0);
    const copy = duplicateStep(original);
    expect(copy.config.secret).toMatch(/^[0-9a-f]{48}$/);
    expect(copy.config.secret).not.toBe(original.config.secret);
    expect(copy.id).not.toBe(original.id);
  });
});

describe("Ask to follow in the builder", () => {
  it("a new step has its message, the Visit profile label, the reminder and two open paths", () => {
    const step = newStep("FOLLOW_GATE", 3);
    expect(step.body?.trim()).toBeTruthy();
    expect(step.config).toMatchObject({ visitLabel: "Visit profile", followingStepId: null, notFollowingStepId: null });
    expect(String(step.config.retryMessage)).toContain("Following");
    expect(step.buttons).toEqual([]);
  });
});
