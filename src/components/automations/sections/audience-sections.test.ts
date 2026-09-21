/**
 * A2. "Audience growth" becomes two sections, and nothing about the values changes.
 *
 * The brief is explicit that this is *"no behaviour change, only structure and copy"*, so the
 * assertions are in two halves: the structure really did split, and the bindings really did not
 * move. The second half is the one worth having. A split that quietly renamed a field or dropped a
 * character limit would look identical on screen and lose people's saved follow-ups.
 *
 * A source scan, since this repo has no React test harness. The rendered result is in
 * `automation-run5/ui-actual/`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DELAY_OPTIONS, MAX_FOLLOW_UPS } from "./follow-up-options";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const strip = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

const builder = strip(read("../automation-builder.tsx"));
const followGate = strip(read("./follow-before-dm-section.tsx"));
const sequence = strip(read("./follow-up-sequence-section.tsx"));

describe("the split", () => {
  it("has no Audience growth section left", () => {
    expect(builder).not.toMatch(/Audience growth/);
    expect(builder).not.toMatch(/Ask for a follow first, then re-engage automatically/);
  });

  it("mounts two separate sections, each with its own heading and description", () => {
    expect(builder).toMatch(/<FollowBeforeDmSection/);
    expect(builder).toMatch(/<FollowUpSequenceSection/);
    expect(followGate).toMatch(/title="Ask to follow before DM"/);
    expect(sequence).toMatch(/title="Follow-up sequence"/);
    // Each carries its own subtitle rather than sharing one vague enough to cover both.
    expect(followGate).toMatch(/subtitle="[^"]+"/);
    expect(sequence).toMatch(/subtitle="[^"]+"/);
  });

  it("renders each as its own section element", () => {
    expect(followGate).toMatch(/<section/);
    expect(sequence).toMatch(/<section/);
  });

  /**
   * The ring used to key on `followBeforeDm` OR `followUps` for the whole block, so a validation
   * pass pointing at a follow-up flashed the follow gate too. Each section now takes only its own.
   */
  it("gives each section only its own highlight key", () => {
    expect(builder).toMatch(/highlighted=\{highlightedFields\.has\("followBeforeDm"\)\}/);
    expect(builder).toMatch(/highlighted=\{highlightedFields\.has\("followUps"\)\}/);
    expect(builder).not.toMatch(
      /highlightedFields\.has\("followBeforeDm"\) \|\|\s*\n?\s*highlightedFields\.has\("followUps"\)/,
    );
  });
});

describe("the values are bound exactly as they were", () => {
  it("reads and writes the same two form fields", () => {
    expect(builder).toMatch(/value=\{form\.followBeforeDm\}/);
    expect(builder).toMatch(/onChange=\{\(v\) => update\(\{ followBeforeDm: v \}\)\}/);
    expect(builder).toMatch(/value=\{form\.followUps\}/);
    expect(builder).toMatch(/onChange=\{\(next\) => update\(\{ followUps: next \}\)\}/);
  });

  it("keeps the capability gate at the call site, where it already was", () => {
    // Not inside the component: the scheduler mounts the same one under its own rules (A4).
    expect(builder).toMatch(/features\.follow_before_dm && \(\s*\n?\s*<FollowBeforeDmSection/);
    expect(followGate).not.toMatch(/features\./);
    expect(sequence).not.toMatch(/features\./);
  });

  it("keeps the same delay options, in the same order", () => {
    expect(DELAY_OPTIONS.map((d) => d.minutes)).toEqual([60, 360, 1440, 4320, 10080]);
    expect(DELAY_OPTIONS.map((d) => d.label)).toEqual([
      "1 hour",
      "6 hours",
      "1 day",
      "3 days",
      "7 days",
    ]);
  });

  it("keeps the 10-step ceiling and the stored character limit", () => {
    expect(MAX_FOLLOW_UPS).toBe(10);
    expect(sequence).toMatch(/value\.length < MAX_FOLLOW_UPS/);
    expect(sequence).toMatch(/LIMITS\.followUpMessage\.max/);
  });

  it("keeps a new step's default delay at one day", () => {
    // A different default would silently reschedule every follow-up added after this change.
    expect(sequence).toMatch(/delayMinutes: 1440/);
  });

  it("keeps the follow-up row shape, so saved rows still load", () => {
    expect(sequence).toMatch(/\{ id: `f\$\{Date\.now\(\)\}`, delayMinutes: 1440, message: "" \}/);
  });
});

describe("the components are reusable by the scheduler (A4)", () => {
  /**
   * The props are a value and an onChange, nothing else. A form object or a capability lookup
   * inside either component would tie them to the builder and guarantee the drift A4 exists to end.
   */
  it("takes a value and an onChange, not a form", () => {
    for (const source of [followGate, sequence]) {
      expect(source).toMatch(/value:/);
      expect(source).toMatch(/onChange:/);
      expect(source).not.toMatch(/BuilderForm/);
      expect(source).not.toMatch(/useAutomationFeatures/);
    }
  });
});
