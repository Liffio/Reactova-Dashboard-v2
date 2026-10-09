import { describe, expect, it } from "vitest";
import type { ChatbotButton, ChatbotStep } from "@/lib/api/chatbot-api";
import { brokenStepIds, findBrokenSteps } from "./broken-steps";

/**
 * Live mirror of the server's structural "broken step" rules (validation.ts). Kept narrow on
 * purpose: plan limits and media checks stay server-only, this is only the "goes nowhere" rules.
 */

let n = 0;
const id = () => `step-${++n}`;
const btn = (over: Partial<ChatbotButton> = {}): ChatbotButton => ({
  id: id(),
  label: "Go",
  action: "NEXT_STEP",
  targetStepId: null,
  targetChatbotId: null,
  url: null,
  tagToAdd: null,
  ...over,
});
const step = (over: Partial<ChatbotStep> & Pick<ChatbotStep, "type">): ChatbotStep => ({
  id: id(),
  name: "s",
  position: 0,
  delaySeconds: 2,
  body: "hi",
  mediaAssetId: null,
  tagToAdd: null,
  config: {},
  buttons: [],
  followUps: [],
  ...over,
});

describe("findBrokenSteps", () => {
  it("finds nothing in a simple linked flow", () => {
    const s2 = step({ type: "MESSAGE" });
    const s1 = step({ type: "MESSAGE", buttons: [btn({ targetStepId: s2.id })] });
    expect(findBrokenSteps([s1, s2], s1.id)).toEqual([]);
  });

  it("flags a button with no target", () => {
    const s1 = step({ type: "MESSAGE", buttons: [btn({ targetStepId: null })] });
    const broken = findBrokenSteps([s1], s1.id);
    expect(broken).toEqual([{ stepId: s1.id, message: '"Go" doesn\'t go anywhere' }]);
  });

  it("flags a condition with an empty Yes or Else, but not one fully wired", () => {
    const a = step({ type: "MESSAGE" });
    const half = step({ type: "CONDITION", config: { yesStepId: a.id, elseStepId: null } });
    expect(findBrokenSteps([half, a], half.id).map((b) => b.stepId)).toContain(half.id);

    const whole = step({ type: "CONDITION", config: { yesStepId: a.id, elseStepId: a.id } });
    expect(findBrokenSteps([whole, a], whole.id)).toEqual([]);
  });

  it("does not flag a Split path left empty — that's a deliberate end", () => {
    const split = step({ type: "SPLIT", config: { paths: [{ stepId: null }, { stepId: null }] } });
    expect(findBrokenSteps([split], split.id)).toEqual([]);
  });

  it("does not flag a Message with no buttons and no next step — also a deliberate end", () => {
    const s1 = step({ type: "MESSAGE", config: { nextStepId: null } });
    expect(findBrokenSteps([s1], s1.id)).toEqual([]);
  });

  it("flags a link to a step that was deleted", () => {
    const s1 = step({ type: "MESSAGE", config: { nextStepId: "gone" } });
    expect(findBrokenSteps([s1], s1.id)[0]).toMatchObject({ stepId: s1.id });
  });

  it("flags a step unreachable from the entry point", () => {
    const s1 = step({ type: "MESSAGE" });
    const orphan = step({ type: "MESSAGE" });
    const broken = findBrokenSteps([s1, orphan], s1.id);
    expect(brokenStepIds(broken)).toEqual(new Set([orphan.id]));
  });

  it("the count drops to zero once the only break is fixed", () => {
    const s2 = step({ type: "MESSAGE" });
    // s2 is linked from s1's own nextStepId, so fixing the dead button is the only change.
    const s1 = step({ type: "MESSAGE", config: { nextStepId: s2.id }, buttons: [btn({ targetStepId: null })] });
    expect(findBrokenSteps([s1, s2], s1.id)).toHaveLength(1);
    const fixed = { ...s1, buttons: [btn({ targetStepId: s2.id })] };
    expect(findBrokenSteps([fixed, s2], fixed.id)).toHaveLength(0);
  });
});
