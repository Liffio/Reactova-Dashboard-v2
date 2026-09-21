/**
 * A1. Opening an existing "All posts" automation shows the note and both switchable choices.
 *
 * ## Why this test exists
 *
 * The retired label and its note were written into the trigger picker, and `lockTarget` replaces
 * that picker wholesale with `LockedTarget` in edit mode. So for the one case A1 exists to serve,
 * they rendered nowhere. Every other A1 test passed: the strings were present in the file, the
 * order was right, the server rule was right. Only opening the page showed it, and that is exactly
 * the gap a source scan leaves.
 *
 * So this file checks the three conditions that decide whether the branch runs at all, rather than
 * checking that the markup exists. The markup existing is what was already true when it was broken.
 *
 * The rendered proof is `automation-run5/ui-actual/02-legacy-any-automation-*.png`, where the
 * measured page reports `retiredLabel: true` and `selectable: ["Pick a post", "Next post"]`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const builder = read("./automation-builder.tsx")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

/**
 * The gate, transcribed. `lockTarget` comes from the edit route, `isLegacyAnyScope` from the loaded
 * automation's own scope.
 */
const targetLocked = (lockTarget: boolean, postScope: string) =>
  lockTarget && !(postScope === "any");

describe("which automations still hide the trigger picker", () => {
  it("shows the picker for an ANY automation opened in edit mode", () => {
    // The case that rendered nothing before: locked, and therefore no note and no choices.
    expect(targetLocked(true, "any")).toBe(false);
  });

  it("still hides it for every other automation in edit mode", () => {
    expect(targetLocked(true, "specific")).toBe(true);
    expect(targetLocked(true, "next")).toBe(true);
  });

  it("never hides it while creating, whatever the scope", () => {
    expect(targetLocked(false, "specific")).toBe(false);
    expect(targetLocked(false, "any")).toBe(false);
  });

  it("is wired that way in the builder, not just in this file", () => {
    expect(builder).toMatch(/const targetLocked = lockTarget && !isLegacyAnyScope;/);
    // And it is `targetLocked` that chooses LockedTarget, not the raw prop.
    expect(builder).toMatch(/\{targetLocked \? \(\s*\n?\s*<LockedTarget/);
    expect(builder).not.toMatch(/\{lockTarget \? \(\s*\n?\s*<LockedTarget/);
  });
});

describe("what the unlocked picker shows for a legacy automation", () => {
  it("renders the note and the retired label inside the branch that now runs", () => {
    const branch = builder.slice(builder.indexOf("{targetLocked ? ("));
    const unlocked = branch.slice(branch.indexOf(") : ("));
    expect(unlocked).toMatch(/All posts \(no longer offered\)/);
    expect(unlocked).toMatch(/This automation runs on comments from all of your posts/);
  });

  it("offers exactly Pick a post and Next post as choices", () => {
    const options = [...builder.matchAll(/\{ v: "(specific|next|any)", l: "([^"]+)"/g)].map(
      (m) => m[2],
    );
    expect(options).toEqual(["Pick a post", "Next post"]);
  });

  it("leaves the retired label unselectable", () => {
    const block = builder.slice(builder.indexOf("isLegacyAnyScope && ("));
    const label = block.slice(0, block.indexOf("All posts (no longer offered)"));
    expect(label).toMatch(/<span/);
    expect(label).not.toMatch(/<button/);
  });
});

describe("the narrowing can actually be saved", () => {
  /**
   * 🔴 The second half of the same defect.
   *
   * `postScope` and `postId` are stripped from an ordinary edit payload on purpose. Stripping them
   * here too would make the choice unsavable: the switch would appear to work and silently do
   * nothing, which is worse than the picker not rendering at all.
   */
  it("keeps postScope and postId on the payload when narrowing away from any", () => {
    expect(builder).toMatch(/narrowingLegacyScope/);
    expect(builder).toMatch(
      /narrowingLegacyScope\s*\?\s*\{ \.\.\.editable, postScope: payload\.postScope, postId: payload\.postId \}/,
    );
  });

  /**
   * Keyed on what was LOADED, not on what the form says now. After the owner picks "Next post" the
   * form no longer reads `any`, so testing the live value would drop the very change being made.
   */
  it("decides from the loaded automation rather than the current form value", () => {
    expect(builder).toMatch(
      /String\(initialForm\?\.postScope \?\? ""\)\.toLowerCase\(\) === "any"/,
    );
    expect(builder).not.toMatch(/narrowingLegacyScope =\s*\n?\s*form\.postScope/);
  });

  it("lets the postId autofill run for a narrowing, so specific cannot be left invalid", () => {
    // ANY to Pick a post needs a post chosen for it, exactly as a new automation does.
    expect(builder).toMatch(/if \(lockTarget && !isLegacyAnyScope\) return;/);
  });
});
