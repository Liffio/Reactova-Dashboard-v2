/**
 * A1. The trigger offers Pick a post first, then Next post, and never "All posts" for a new one.
 *
 * A source scan over the builder. This repo has no React test harness, the same reason
 * `add-workspace-no-navigation.test.ts` and `use-features.test.ts` take that approach. The rendered
 * result is in the screenshot pairs under `automation-run5/ui-actual/`.
 *
 * Each assertion below fails against the code as it was: the array used to open with
 * `{ v: "any", l: "All posts" }` and end with Pick a post, and the default scope was `"any"`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const strip = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

const builder = strip(read("./automation-builder.tsx"));
const form = strip(read("./automation-form.ts"));

describe("the offered trigger choices", () => {
  it("offers Pick a post first and Next post second, in that order", () => {
    const options = [...builder.matchAll(/\{ v: "(specific|next|any)", l: "([^"]+)"/g)].map(
      (m) => ({
        v: m[1],
        label: m[2],
      }),
    );
    expect(options).toEqual([
      { v: "specific", label: "Pick a post" },
      { v: "next", label: "Next post" },
    ]);
  });

  /**
   * 🔴 The scope the server now refuses must not be selectable.
   *
   * Checked as the absence of a selectable option rather than the absence of the string, because
   * the legacy label below deliberately contains "All posts".
   */
  it("has no selectable All posts option at all", () => {
    expect(builder).not.toMatch(/\{ v: "any"/);
    expect(builder).not.toMatch(/l: "All posts"/);
  });

  it("defaults a new automation to Pick a post", () => {
    // Was `postScope: "any"`, which opened the builder on a choice the server refuses on create.
    const defaults = form.slice(form.indexOf("export const defaultForm"));
    expect(defaults).toMatch(/postScope: "specific"/);
    expect(defaults).not.toMatch(/postScope: "any"/);
  });
});

describe("an existing All posts automation", () => {
  it("is recognised by what it is, not by how the builder was opened", () => {
    // `mode === "edit"` would also be true for editing a Pick a post automation.
    expect(builder).toMatch(/const isLegacyAnyScope = form\.postScope === "any"/);
  });

  it("shows the retired label and a one-line note", () => {
    expect(builder).toMatch(/All posts \(no longer offered\)/);
    const note = builder.slice(builder.indexOf("This automation runs on comments from all"));
    expect(note.slice(0, 400)).toMatch(/keeps working exactly as it does now/i);
    expect(note.slice(0, 400)).toMatch(/cannot be switched back/i);
  });

  /**
   * It is a span, not a button. A1: "Once switched, All posts cannot be picked again", so the
   * legacy label has to be unselectable, or the one-way door has a handle on both sides.
   */
  it("renders the retired choice as unselectable", () => {
    const block = builder.slice(builder.indexOf("isLegacyAnyScope && ("));
    const label = block.slice(0, block.indexOf("All posts (no longer offered)"));
    expect(label).toMatch(/<span/);
    expect(label).not.toMatch(/<button/);
    expect(label).toMatch(/cursor-not-allowed/);
  });
});

describe("the Sync button", () => {
  it("refetches the same query the picker reads, rather than a new endpoint", () => {
    expect(builder).toMatch(/wizardData\.refetch\(\)/);
  });

  it("has a loading state, a synced timestamp and a failure message", () => {
    expect(builder).toMatch(/wizardData\.isFetching/);
    expect(builder).toMatch(/Synced \$\{relativeSyncLabel\(wizardData\.dataUpdatedAt\)\}/);
    expect(builder).toMatch(/Could not refresh your posts from Instagram/);
  });

  /**
   * The timestamp describes the DATA, not the button.
   *
   * `dataUpdatedAt` is the query's own, so a list loaded on mount reads as synced then, where a
   * locally-tracked "last pressed" time would say "not synced yet" over perfectly fresh data.
   */
  it("takes the timestamp from the query rather than from the last tap", () => {
    expect(builder).toMatch(/wizardData\.dataUpdatedAt/);
  });

  /**
   * 🔴 The debounce is a visible cooldown.
   *
   * A trailing-edge debounce protects the Instagram API equally and tells the person nothing, so
   * they tap again. The button has to disable itself AND say when it will be ready.
   */
  it("debounces with a cooldown that is visible and disables the button", () => {
    expect(builder).toMatch(/SYNC_COOLDOWN_MS/);
    expect(builder).toMatch(/disabled=\{wizardData\.isFetching \|\| syncSecondsLeft > 0\}/);
    expect(builder).toMatch(/Sync in \$\{syncSecondsLeft\}s/);
    // And the guard is in the handler too, so a programmatic call cannot bypass the disabled prop.
    expect(builder).toMatch(/if \(syncSecondsLeft > 0 \|\| wizardData\.isFetching\) return;/);
  });
});
