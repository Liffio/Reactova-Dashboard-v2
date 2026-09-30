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
