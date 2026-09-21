/**
 * The docs cannot silently fall behind the schema.
 *
 * ## What went wrong twice
 *
 * Run 5 added `excludedKeywords`, `followUps` and `brandingEnabled` to the scheduled post's
 * `automation` object and reported them as documented. They were, in a **new section further down
 * the page**, while "Schedule a post" kept its original three-field snippet. Somebody reading the
 * section that introduces the endpoint saw `enabled`, `keywords` and `dmMessage` and concluded
 * those were the fields.
 *
 * So there are two failure modes, and this file covers both:
 *
 * 1. a field exists in the API and nowhere in the docs
 * 2. the docs describe a field the API does not take
 *
 * The second matters as much as the first: a documented field that silently does nothing is worse
 * than an undocumented one, because the caller believes it worked.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { SCHEDULED_POST_AUTOMATION_FIELDS } from "./api-docs-automation-fields";

/**
 * The schema lives in the sibling Backend repository.
 *
 * Read from disk rather than duplicated here, because a duplicated list is the thing being guarded
 * against. When the checkout has no sibling Backend, the cross-repo assertions are skipped rather
 * than failed: a missing repository is not a documentation defect, and a test that fails for the
 * wrong reason gets ignored for the right ones. The within-repo checks below always run.
 */
const schemaPath = fileURLToPath(
  new URL("../../../Backend/src/api/schemas/scheduledPostAutomation.schema.ts", import.meta.url),
);
const hasBackend = existsSync(schemaPath);

/** Top-level keys of `scheduledPostAutomationSchema`, read off the source. */
function schemaFieldNames(): string[] {
  const source = readFileSync(schemaPath, "utf8");
  const start = source.indexOf("export const scheduledPostAutomationSchema = z.object({");
  const body = source.slice(start, source.indexOf("\n});", start));
  // Two spaces of indent is a top-level key; anything deeper belongs to a nested object.
  return [...body.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
}

const documented = SCHEDULED_POST_AUTOMATION_FIELDS.map((f) => f.name);

describe("every field the API takes is documented", () => {
  it.skipIf(!hasBackend)("has no schema field missing from the docs", () => {
    const missing = schemaFieldNames().filter((name) => !documented.includes(name));
    expect(missing, `Add these to SCHEDULED_POST_AUTOMATION_FIELDS: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it.skipIf(!hasBackend)("documents no field the API does not take", () => {
    const names = schemaFieldNames();
    const invented = documented.filter((name) => !names.includes(name));
    expect(invented, `These are documented but not in the schema: ${invented.join(", ")}`).toEqual(
      [],
    );
  });

  it.skipIf(!hasBackend)(
    "finds a plausible number of fields, so a broken parse cannot pass",
    () => {
      // If the regex stopped matching, both checks above would trivially pass against an empty list.
      expect(schemaFieldNames().length).toBeGreaterThan(10);
    },
  );
});

describe("the documented fields are usable as documentation", () => {
  it("gives every field a type, a required answer, a fallback and notes", () => {
    for (const field of SCHEDULED_POST_AUTOMATION_FIELDS) {
      expect(field.type, field.name).not.toBe("");
      expect(field.required, field.name).not.toBe("");
      expect(field.fallback, field.name).not.toBe("");
      expect(field.notes.length, field.name).toBeGreaterThan(10);
    }
  });

  it("names no field twice", () => {
    expect(new Set(documented).size).toBe(documented.length);
  });

  /**
   * The API name, not the UI's. The follow gate is labelled "Ask to follow before DM" on screen and
   * a reader who types that into their request body gets a field the server ignores.
   */
  it("uses the wire name for the follow gate", () => {
    expect(documented).toContain("followBeforeDm");
    expect(documented).not.toContain("askToFollow");
  });

  it("covers the three fields run 5 added", () => {
    for (const name of ["excludedKeywords", "followUps", "brandingEnabled"]) {
      expect(documented).toContain(name);
    }
  });
});

describe("the page renders them", () => {
  const docs = readFileSync(
    fileURLToPath(new URL("./api-docs-content.tsx", import.meta.url)),
    "utf8",
  );

  it("renders the list rather than restating it", () => {
    // A second hand-written list beside this one is exactly how the two got out of step.
    expect(docs).toMatch(/SCHEDULED_POST_AUTOMATION_FIELDS\.map/);
  });

  it("puts it in the section that introduces the endpoint", () => {
    const section = docs.slice(
      docs.indexOf('<Section id="schedule-post"'),
      docs.indexOf('<Section id="media-uploads"'),
    );
    expect(section).toMatch(/SCHEDULED_POST_AUTOMATION_FIELDS/);
    // And the errors a caller of THIS endpoint can hit are there too.
    expect(section).toMatch(/BRANDING_CONTROL_REQUIRED/);
    expect(section).toMatch(/At least one keyword is required when anyComment is false/);
  });

  it("keeps no em dashes in the prose", () => {
    // The two that remain are the "no value" glyph in the plan table, which is data, not prose.
    const prose = docs.split("\n").filter((line) => !/return ["']—["']/.test(line));
    expect(prose.join("\n")).not.toMatch(/\s—\s/);
  });
});
