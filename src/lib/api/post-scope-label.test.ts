/**
 * F1. Automation cards show their real trigger.
 *
 * `automations.index.tsx` compared the wire value against the lower-case vocabulary:
 *
 * ```tsx
 * a.postScope === "specific" ? "Specific post" : a.postScope === "next" ? "Next post" : "All posts"
 * ```
 *
 * The list endpoint returns TypeORM entities straight from `getManyAndCount`, so `postScope` is the
 * stored enum in upper case. Neither branch could ever match and **every** card read "All posts".
 *
 * It went unnoticed while "All posts" was a real scope that most automations plausibly had. Run 5
 * retired it, so every card in the product was advertising a trigger that can no longer be created.
 *
 * Caught by the screenshot pass rather than by a test: `ui-actual/04-automation-list-toggles-*.png`
 * shows four cards all reading "All posts", two of them seeded `NEXT` and one `SPECIFIC`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { postScopeLabel } from "./automations-api";

describe("postScopeLabel", () => {
  /**
   * 🔴 The three cases the brief names, in the spelling the API actually sends.
   *
   * Each of these returned "All posts" before the fix.
   */
  it("labels the enum the list endpoint really returns", () => {
    expect(postScopeLabel("SPECIFIC")).toBe("Pick a post");
    expect(postScopeLabel("NEXT")).toBe("Next post");
    expect(postScopeLabel("ANY")).toBe("All posts");
  });

  /**
   * Both spellings are live: the list endpoint sends the enum, and a form-shaped object in the same
   * app holds the lower-case one. A helper that handles only one of them is wrong at half its call
   * sites, which is how this bug existed in the first place.
   */
  it("labels the lower-case client vocabulary too", () => {
    expect(postScopeLabel("specific")).toBe("Pick a post");
    expect(postScopeLabel("next")).toBe("Next post");
    expect(postScopeLabel("any")).toBe("All posts");
  });

  it("matches the words the builder offers, so the two surfaces agree", () => {
    // The trigger picker's own labels are "Pick a post" and "Next post". A card saying "Specific
    // post" for the same automation would be a second name for one thing.
    expect(postScopeLabel("SPECIFIC")).toBe("Pick a post");
    expect(postScopeLabel("NEXT")).toBe("Next post");
  });

  /**
   * "All posts" is the widest scope, so an unrecognised value understates nothing. It is also the
   * pre-existing fallback, so a value nobody anticipated reads as it always did.
   */
  it("falls back to the widest scope for anything unrecognised", () => {
    for (const value of [null, undefined, "", "nonsense"]) {
      expect(postScopeLabel(value)).toBe("All posts");
    }
  });
});

describe("the card uses it", () => {
  it("no longer compares the wire value directly", () => {
    const page = readFileSync(
      fileURLToPath(new URL("../../routes/_app/automations.index.tsx", import.meta.url)),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

    expect(page).toMatch(/postScopeLabel\(a\.postScope\)/);
    // The comparison that never matched.
    expect(page).not.toMatch(/a\.postScope === "specific"/);
    expect(page).not.toMatch(/a\.postScope === "next"/);
  });
});
