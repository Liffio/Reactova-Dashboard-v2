import type { ChatbotStep } from "@/lib/api/chatbot-api";
import { cfgStr } from "./model";

/**
 * Live mirror of the server's "broken step" rules (chatbot-ui-fixes spec item 6; server side in
 * `validation.ts`'s `validateGraph`). Recomputed from the draft on every render so the banner and
 * the per-step outline update as each one is fixed, without a round trip to the publish endpoint.
 *
 * Deliberately narrower than the full publish gate: plan limits, media and merge-field checks stay
 * server-only (they need data — caps, file status — this component doesn't have). This only covers
 * the structural "goes nowhere" rules, the ones item 6 is about.
 *
 * A Split path left empty is NOT broken here, on purpose: `splitConfigSchema`'s own comment says a
 * pathless path deliberately ends the run there, same as a Message with no buttons and no next
 * step. Only a Condition's branches are both mandatory, because a condition's only job is routing.
 */
export interface BrokenStep {
  stepId: string;
  message: string;
}

/** Where a step leads with no input needed, and where it leads on a tap/answer — mirrors `edgesOf` (validation.ts). */
function edgesOf(step: ChatbotStep): string[] {
  const c = step.config;
  const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
  const outside = s((c.outsideHours as { stepId?: unknown } | undefined)?.stepId);
  const buttonTargets = [...step.buttons, ...step.followUps.flatMap((f) => f.buttons)]
    .map((b) => (b.action === "NEXT_STEP" ? b.targetStepId : null))
    .filter((x): x is string => !!x);

  switch (step.type) {
    case "CONDITION":
      return [s(c.yesStepId), s(c.elseStepId)].filter((x): x is string => !!x);
    case "QUESTION":
      return [outside, s(c.nextStepId), s(c.skipStepId), ...buttonTargets].filter((x): x is string => !!x);
    case "MESSAGE":
    case "HANDOVER":
      return [s(c.nextStepId), outside, ...buttonTargets].filter((x): x is string => !!x);
    case "WEBHOOK":
    case "NOTIFY":
      return [s(c.nextStepId)].filter((x): x is string => !!x);
    case "SPLIT": {
      const paths = Array.isArray(c.paths) ? (c.paths as Array<{ stepId?: unknown }>) : [];
      return paths.map((p) => s(p.stepId)).filter((x): x is string => !!x);
    }
    case "FOLLOW_GATE":
      return [s(c.followingStepId), s(c.notFollowingStepId)].filter((x): x is string => !!x);
    default:
      return [];
  }
}

/** The broken steps in this draft, each with the one-line reason to show in the banner. */
export function findBrokenSteps(steps: ChatbotStep[], firstStepId: string | null): BrokenStep[] {
  const ids = new Set(steps.map((s) => s.id));
  const out: BrokenStep[] = [];

  for (const step of steps) {
    // A button offering no destination: always a mistake, never a deliberate end — a button
    // invites a tap, so one that goes nowhere traps whoever taps it.
    for (const b of step.buttons) {
      if (b.action === "NEXT_STEP" && !b.targetStepId) {
        out.push({ stepId: step.id, message: `"${b.label}" doesn't go anywhere` });
        break;
      }
    }
    // A reference pointing at a step since deleted.
    const refs: Array<[string, string]> = [
      ["nextStepId", "This step"],
      ["yesStepId", "This condition's Yes path"],
      ["elseStepId", "This condition's Else path"],
      ["skipStepId", "The skip button"],
      ["followingStepId", "The Following path"],
      ["notFollowingStepId", "The Not following path"],
    ];
    for (const [key, label] of refs) {
      const target = cfgStr(step, key);
      if (target && !ids.has(target)) {
        out.push({ stepId: step.id, message: `${label} points at a step that was deleted` });
      }
    }
    // A condition always routes: an empty Yes or Else is half-wired, not a deliberate end.
    if (step.type === "CONDITION") {
      if (!cfgStr(step, "yesStepId")) out.push({ stepId: step.id, message: "This condition's Yes path doesn't lead anywhere" });
      if (!cfgStr(step, "elseStepId")) out.push({ stepId: step.id, message: "This condition's Else path doesn't lead anywhere" });
    }
  }

  // Unreachable from the entry point: nothing in the flow leads to it.
  if (firstStepId && ids.has(firstStepId)) {
    const byId = new Map(steps.map((s) => [s.id, s]));
    const seen = new Set<string>();
    const queue = [firstStepId];
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const step = byId.get(id);
      if (step) queue.push(...edgesOf(step));
    }
    for (const step of steps) {
      if (!seen.has(step.id)) out.push({ stepId: step.id, message: "Nothing leads to this step, so nobody will see it" });
    }
  }

  return out;
}

/** Just the ids, for outlining and the step-number marker. */
export function brokenStepIds(broken: BrokenStep[]): Set<string> {
  return new Set(broken.map((b) => b.stepId));
}
