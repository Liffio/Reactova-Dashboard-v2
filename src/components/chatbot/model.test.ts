import { describe, expect, it } from "vitest";

import type { ChatbotStep } from "@/lib/api/chatbot-api";
import { MAX_CONDITION_RULES, MAX_FOLLOW_UPS } from "@/lib/api/chatbot-api";
import { autoLink, conditionRuleCap, duplicateStep, followUpCap, newButton, newStep, newWebhookSecret } from "./model";

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
    expect(step.config).toMatchObject({
      visitLabel: "Visit profile",
      followingStepId: null,
      notFollowingStepId: null,
    });
    expect(String(step.config.retryMessage)).toContain("Following");
    expect(step.buttons).toEqual([]);
  });
});

describe("autoLink: a new step is linked from the step that was open", () => {
  const link = (prev: ChatbotStep) => autoLink(prev, "NEW");

  it("Message: the first button that goes nowhere, else its next step", () => {
    const withButtons = {
      ...newStep("MESSAGE", 0),
      buttons: [
        { ...newButton("NEXT_STEP", "Plans"), targetStepId: "x" },
        newButton("NEXT_STEP", "Shop"),
      ],
    };
    const r = link(withButtons)!;
    expect(r.step.buttons[1].targetStepId).toBe("NEW");
    expect(r.step.buttons[0].targetStepId).toBe("x");
    expect(r.slot).toBe('the "Shop" button');

    const plain = newStep("MESSAGE", 0);
    expect(link(plain)!.step.config.nextStepId).toBe("NEW");
  });

  it("never overwrites a link", () => {
    expect(link({ ...newStep("MESSAGE", 0), config: { nextStepId: "x" } })).toBeNull();
    const full = {
      ...newStep("MESSAGE", 0),
      buttons: [{ ...newButton("NEXT_STEP", "A"), targetStepId: "x" }],
    };
    expect(link(full)).toBeNull(); // with flow buttons, "next" is never used
  });

  it("Condition fills Yes, then Otherwise; Split the first empty path", () => {
    const cond = newStep("CONDITION", 0);
    const first = link(cond)!;
    expect(first.slot).toBe("Yes");
    expect(first.step.config.yesStepId).toBe("NEW");
    expect(link(first.step)!.slot).toBe("Otherwise");

    const split = newStep("SPLIT", 0);
    const r = link(split)!;
    expect(r.slot).toBe("path A");
    expect((r.step.config.paths as Array<{ stepId: string | null }>)[0].stepId).toBe("NEW");
    expect(link(r.step)!.slot).toBe("path B");
  });

  it("Question, Webhook, Notify, Ask to follow", () => {
    expect(link(newStep("QUESTION", 0))!.step.config.nextStepId).toBe("NEW");
    expect(link(newStep("WEBHOOK", 0))!.step.config.nextStepId).toBe("NEW");
    expect(link(newStep("NOTIFY", 0))!.step.config.nextStepId).toBe("NEW");
    expect(link(newStep("FOLLOW_GATE", 0))!.slot).toBe("Following");
  });

  it("Handover links only through a button that goes nowhere; Start another chatbot never", () => {
    expect(link(newStep("HANDOVER", 0))).toBeNull();
    const ho = { ...newStep("HANDOVER", 0), buttons: [newButton("NEXT_STEP", "Other topic")] };
    expect(link(ho)!.step.buttons[0].targetStepId).toBe("NEW");
    expect(link(newStep("START_CHATBOT", 0))).toBeNull();
  });
});

describe("follow-ups per step in the builder", () => {
  it("shows each plan's own maximum, not a fixed number", () => {
    // Free, Starter, Growth, Business/Creator/Agency as set in prod
    expect([0, 1, 2, 3].map(followUpCap)).toEqual([0, 1, 2, 3]);
  });

  it("an unlimited package gets the ceiling of 3; nothing goes past it", () => {
    expect(MAX_FOLLOW_UPS).toBe(3);
    expect(followUpCap(null)).toBe(3);
    expect(followUpCap(10)).toBe(3);
  });

  it("offers nothing until the plan's limits have loaded", () => {
    expect(followUpCap(undefined)).toBeUndefined();
  });
});

describe("rules per condition in the builder", () => {
  it("offers each plan its own number: Free none, Starter 5, Growth 15", () => {
    expect([0, 5, 15].map(conditionRuleCap)).toEqual([0, 5, 15]);
  });

  it("unlimited plans get the ceiling of 50", () => {
    expect(MAX_CONDITION_RULES).toBe(50);
    expect(conditionRuleCap(null)).toBe(50);
  });

  it("offers nothing until the plan's limits have loaded", () => {
    expect(conditionRuleCap(undefined)).toBeUndefined();
  });
});
