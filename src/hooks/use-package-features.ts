import { useState } from "react";

/**
 * Selection state for a package's contents.
 *
 * Kept out of the picker component so that file exports components only — React Fast Refresh
 * cannot preserve state across edits in a module that mixes the two, which would reset a
 * half-composed checklist on every save during development.
 *
 * Two sets rather than one list: a module can be included with none of its sub-functions ticked,
 * which is a real state and not the same as "not included".
 */

export type FeatureSelection = { parentKey: string; childKey: string | null };

export function usePackageFeatureSelection(initial: FeatureSelection[] = []) {
  const [parents, setParents] = useState<Set<string>>(
    () => new Set(initial.map((f) => f.parentKey)),
  );
  const [children, setChildren] = useState<Set<string>>(
    () => new Set(initial.filter((f) => f.childKey).map((f) => f.childKey!)),
  );

  const reset = (features: FeatureSelection[]) => {
    setParents(new Set(features.map((f) => f.parentKey)));
    setChildren(new Set(features.filter((f) => f.childKey).map((f) => f.childKey!)));
  };

  return { parents, setParents, children, setChildren, reset };
}

/** Counts for the footer summary — features ticked, and how many modules they span. */
export function summarise(selection: FeatureSelection[]) {
  return {
    features: selection.filter((s) => s.childKey).length,
    modules: new Set(selection.map((s) => s.parentKey)).size,
  };
}
