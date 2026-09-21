/**
 * The branding switch follows the capability, and a new automation starts unbranded when it is
 * held.
 *
 * This repo has no React test harness, so the rendered behaviour is asserted as a source scan over
 * the builder — the same approach `add-workspace-no-navigation.test.ts` uses, and for the same
 * reason. Each assertion below fails against the code as it was before this change.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { AUTOMATION_FEATURE_KEYS } from "./use-features";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const strip = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

const builder = strip(read("../components/automations/automation-builder.tsx"));

describe("the capability key", () => {
  it("is the one the server gates on", () => {
    // `Backend/src/services/brandingControl.ts` exports the same string. If these drift, the switch
    // unlocks for a capability the API has never heard of, or stays locked for one it grants.
    expect(AUTOMATION_FEATURE_KEYS).toContain("branding_control");
  });
});

describe("the branding switch", () => {
  it("is locked by the capability, never by reading the plan", () => {
    expect(builder).toMatch(/disabled=\{!features\.branding_control\}/);
    // The rule from CLAUDE.md: no hardcoded plan check in the UI.
    const section = builder.slice(builder.indexOf("Liffio branding / watermark"));
    expect(section.slice(0, 1200)).not.toMatch(/plan\s*===|Plan\.FREE|current\.plan/);
  });

  it("shows branding as on whenever the workspace cannot control it", () => {
    // Free is locked ON, not merely locked: the switch must not render an off state it cannot honour.
    expect(builder).toMatch(
      /checked=\{features\.branding_control \? form\.brandingEnabled : true\}/,
    );
  });
});

describe("a new automation's starting state", () => {
  /**
   * The defect in (a): `defaultForm.brandingEnabled` is a constant `true`, so every automation on
   * every plan was created branded and a paying customer had to turn it off every single time.
   */
  it("starts unbranded when the workspace holds the capability", () => {
    expect(builder).toMatch(/\.\.\.defaultForm,\s*brandingEnabled: !features\.branding_control/);
  });

  it("only applies that to a NEW automation, never to one being edited", () => {
    // `initialForm` is an existing automation's saved state and must survive untouched.
    expect(builder).toMatch(
      /initialForm \?\? \{ \.\.\.defaultForm, brandingEnabled: !features\.branding_control \}/,
    );
  });

  /**
   * On a cold load `permissions` is still empty when the initial state is computed, so the
   * capability reads false and the form would start branded and stay that way. The effect corrects
   * it once the capability arrives — and stops as soon as the person touches the switch.
   */
  it("corrects itself once the capability arrives, but never argues with a deliberate choice", () => {
    expect(builder).toMatch(/brandingTouchedRef/);
    const effect = builder.slice(builder.indexOf("brandingTouchedRef.current) return;"));
    expect(effect.slice(0, 400)).toMatch(/setForm\(/);
    expect(builder).toMatch(/brandingTouchedRef\.current = true;/);
  });
});
