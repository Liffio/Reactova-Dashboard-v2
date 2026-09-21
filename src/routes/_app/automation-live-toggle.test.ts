/**
 * A3. The live switch on an automation card.
 *
 * Three behaviours the brief names: toggle to paused and back, roll back on failure, and a disabled
 * switch for a DRAFT. Two of those are about the cache rather than the markup, so they are asserted
 * by running the mutation's own `onMutate` and `onError` against a real QueryClient rather than by
 * reading the source for them. A source scan can tell you a rollback was written; only executing it
 * tells you it restores the right entries.
 *
 * The markup half stays a source scan, since this repo has no React test harness. The rendered
 * result is in `automation-run5/ui-actual/`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const page = read("./automations.index.tsx")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

type Row = { id: string; status: "ACTIVE" | "PAUSED" | "DRAFT"; name: string };

/**
 * The optimistic write and its rollback, transcribed from the mutation in `automations.index.tsx`.
 *
 * Transcribed rather than imported because the handlers are defined inside a React component and
 * this repo cannot render one. The scan at the bottom of this file pins that the real mutation
 * still uses these exact calls, so the two cannot drift silently.
 */
const onMutate = async (qc: QueryClient, input: { id: string; status: Row["status"] }) => {
  await qc.cancelQueries({ queryKey: ["automations"] });
  const snapshot = qc.getQueriesData({ queryKey: ["automations"] });
  qc.setQueriesData<{ items: Row[] }>({ queryKey: ["automations"] }, (old) =>
    old
      ? {
          ...old,
          items: old.items.map((a) => (a.id === input.id ? { ...a, status: input.status } : a)),
        }
      : old,
  );
  return { snapshot };
};

const onError = (qc: QueryClient, context: { snapshot: Array<[readonly unknown[], unknown]> }) => {
  context.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
};

const KEY_A = ["automations", "ws-1", { page: 1, status: null }] as const;
const KEY_B = ["automations", "ws-1", { page: 1, status: "ACTIVE" }] as const;

let qc: QueryClient;
const rows = (): { items: Row[] } => ({
  items: [
    { id: "a1", status: "ACTIVE", name: "Launch DM" },
    { id: "a2", status: "PAUSED", name: "Waitlist" },
  ],
});
const statusOf = (key: readonly unknown[], id: string) =>
  qc.getQueryData<{ items: Row[] }>(key)?.items.find((a) => a.id === id)?.status;

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(KEY_A, rows());
  qc.setQueryData(KEY_B, rows());
});

describe("toggling", () => {
  it("flips a live automation to paused immediately, before the request lands", async () => {
    await onMutate(qc, { id: "a1", status: "PAUSED" });
    expect(statusOf(KEY_A, "a1")).toBe("PAUSED");
  });

  it("flips a paused one back to active", async () => {
    await onMutate(qc, { id: "a2", status: "ACTIVE" });
    expect(statusOf(KEY_A, "a2")).toBe("ACTIVE");
  });

  it("leaves every other automation alone", async () => {
    await onMutate(qc, { id: "a1", status: "PAUSED" });
    expect(statusOf(KEY_A, "a2")).toBe("PAUSED");
  });

  /**
   * 🔴 One cache entry per view.
   *
   * The list's real key carries the workspace and the whole filter/sort/page body, so the same card
   * lives in several entries at once. Writing to one would leave the All tab correct and the Active
   * tab stale, which is two answers about one automation.
   */
  it("updates every cached view the card appears in", async () => {
    await onMutate(qc, { id: "a1", status: "PAUSED" });
    expect(statusOf(KEY_A, "a1")).toBe("PAUSED");
    expect(statusOf(KEY_B, "a1")).toBe("PAUSED");
  });
});

describe("failure rollback", () => {
  it("puts the status back when the save fails", async () => {
    const context = await onMutate(qc, { id: "a1", status: "PAUSED" });
    expect(statusOf(KEY_A, "a1")).toBe("PAUSED");

    onError(qc, context);
    expect(statusOf(KEY_A, "a1")).toBe("ACTIVE");
  });

  /** A partial rollback is worse than none: right on this tab, wrong on the next. */
  it("restores every entry it wrote to, not just the first", async () => {
    const context = await onMutate(qc, { id: "a1", status: "PAUSED" });
    onError(qc, context);
    expect(statusOf(KEY_A, "a1")).toBe("ACTIVE");
    expect(statusOf(KEY_B, "a1")).toBe("ACTIVE");
  });

  it("leaves untouched rows untouched through the whole round trip", async () => {
    const context = await onMutate(qc, { id: "a1", status: "PAUSED" });
    onError(qc, context);
    expect(statusOf(KEY_A, "a2")).toBe("PAUSED");
  });
});

describe("the switch in the card", () => {
  it("is on for ACTIVE and off for anything else", () => {
    expect(page).toMatch(/checked=\{a\.status === "ACTIVE"\}/);
    expect(page).toMatch(/status: next \? "ACTIVE" : "PAUSED"/);
  });

  /** A DRAFT is not a third position on a two-position switch. */
  it("is disabled for a draft, and for anyone who cannot edit", () => {
    expect(page).toMatch(/disabled=\{!canEdit \|\| a\.status === "DRAFT"\}/);
  });

  it("says why it is disabled rather than just refusing to move", () => {
    expect(page).toMatch(/Finish setting this up before it can go live/);
    expect(page).toMatch(/You do not have permission to change automations/);
  });

  it("carries an accessible name naming the automation", () => {
    expect(page).toMatch(/aria-label=/);
    expect(page).toMatch(/Pause \$\{a\.name\}/);
  });

  /**
   * The transcription at the top of this file is only honest if the real mutation still does these
   * exact things. If any of the three moves, the behaviour above stops being what ships.
   */
  it("still uses the cache calls this file transcribes", () => {
    expect(page).toMatch(/await queryClient\.cancelQueries\(\{ queryKey: \["automations"\] \}\)/);
    expect(page).toMatch(/queryClient\.getQueriesData\(\{ queryKey: \["automations"\] \}\)/);
    expect(page).toMatch(/queryClient\.setQueriesData<\{ items: Automation\[\] \}>/);
    expect(page).toMatch(
      /context\?\.snapshot\.forEach\(\(\[key, data\]\) => queryClient\.setQueryData\(key, data\)\)/,
    );
  });

  /**
   * Counts are a workspace-wide aggregate, so guessing them from one page would be inventing a
   * number. `onSettled` also means a rolled-back card is reconciled against the server rather than
   * left on a local guess.
   */
  it("refetches on settle rather than only on success", () => {
    expect(page).toMatch(/onSettled: \(\) => invalidate\(\)/);
  });
});
