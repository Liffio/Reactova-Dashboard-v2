import { describe, it, expect, vi } from "vitest";
import { landInNewWorkspace, type LandingDeps } from "./land-in-new-workspace";

/**
 * FX8. After a successful purchase the customer must land in the workspace they just paid for.
 *
 * Two defects sit behind these tests, both reported from production:
 *
 * 1. The app landed back on the workspace the buyer came from. The cause is an order problem, not a
 *    missing call: `AppProvider` resolves the active workspace id against the workspace list, and
 *    `pickWorkspaceId` falls back to `workspaces[0]` for an id it does not find, which an effect
 *    then writes back into `currentId`. Switching before the list has refreshed therefore reverts.
 * 2. Nothing navigated, so a buyer who opened the sheet from the billing page stayed on the billing
 *    page. Spec 5.2: never the previous workspace, never the billing page.
 *
 * Every test here asserts ORDER, because order is the whole requirement. A test that only checked
 * "refetch was called" would pass against the broken version.
 */

/** Records the sequence of collaborator calls, which is the thing under test. */
function spyDeps() {
  const calls: string[] = [];
  const deps: LandingDeps = {
    refetchWorkspaces: vi.fn(async () => {
      calls.push("refetch");
    }),
    setCurrentId: vi.fn((id: string) => {
      calls.push(`setCurrentId:${id}`);
    }),
    refreshAuth: vi.fn(async () => {
      calls.push("refreshAuth");
    }),
    rememberGroup: vi.fn((groupId: string | null) => {
      calls.push(`rememberGroup:${groupId ?? "none"}`);
    }),
    closePanel: vi.fn(() => {
      calls.push("closePanel");
    }),
    navigateToDashboard: vi.fn(async () => {
      calls.push("navigate:/dashboard");
    }),
  };
  return { deps, calls };
}

describe("landing after a successful intent", () => {
  it("refreshes from the server BEFORE making the new workspace active", async () => {
    const { deps, calls } = spyDeps();

    await landInNewWorkspace(deps, "ws-new", null);

    expect(calls.indexOf("refetch")).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf("refetch")).toBeLessThan(calls.indexOf("setCurrentId:ws-new"));
  });

  it("waits for the refetch to resolve, not merely to start", async () => {
    const { deps, calls } = spyDeps();
    let settled = false;
    deps.refetchWorkspaces = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            settled = true;
            calls.push("refetch");
            resolve();
          }, 10);
        }),
    );

    await landInNewWorkspace(deps, "ws-new", null);

    // If the await were missing, the switch would happen while `settled` was still false.
    expect(settled).toBe(true);
    expect(calls.indexOf("refetch")).toBeLessThan(calls.indexOf("setCurrentId:ws-new"));
  });

  it("makes the NEW workspace active, not the one the buyer came from", async () => {
    const { deps } = spyDeps();

    await landInNewWorkspace(deps, "ws-new", null);

    expect(deps.setCurrentId).toHaveBeenCalledTimes(1);
    expect(deps.setCurrentId).toHaveBeenCalledWith("ws-new");
  });

  it("navigates to the dashboard, and does it last", async () => {
    const { deps, calls } = spyDeps();

    await landInNewWorkspace(deps, "ws-new", null);

    expect(deps.navigateToDashboard).toHaveBeenCalledTimes(1);
    expect(calls[calls.length - 1]).toBe("navigate:/dashboard");
    expect(calls.indexOf("setCurrentId:ws-new")).toBeLessThan(calls.indexOf("navigate:/dashboard"));
  });

  it("remembers the agency so the group opens with the new workspace in it", async () => {
    const { deps, calls } = spyDeps();

    await landInNewWorkspace(deps, "ws-new", "grp-1");

    expect(deps.rememberGroup).toHaveBeenCalledWith("grp-1");
    expect(calls).toContain("rememberGroup:grp-1");
  });

  it("remembers no agency for a standalone purchase", async () => {
    const { deps } = spyDeps();

    await landInNewWorkspace(deps, "ws-new", null);

    expect(deps.rememberGroup).toHaveBeenCalledWith(null);
  });

  it("closes the switcher panel", async () => {
    const { deps } = spyDeps();

    await landInNewWorkspace(deps, "ws-new", null);

    expect(deps.closePanel).toHaveBeenCalledTimes(1);
  });
});

describe("the failure case stays where the buyer was", () => {
  /**
   * The failure path is the ABSENCE of this call: a cancelled, failed or timed-out intent never
   * reaches `onCreated`, so nothing here runs. What this file can pin is the other half of that
   * promise: given nothing to land in, it must not half-land, and above all must not navigate.
   */
  it("does nothing at all without a workspace id", async () => {
    const { deps, calls } = spyDeps();

    await landInNewWorkspace(deps, "", null);

    expect(calls).toEqual([]);
    expect(deps.navigateToDashboard).not.toHaveBeenCalled();
    expect(deps.setCurrentId).not.toHaveBeenCalled();
  });

  it("does not switch to a half-created workspace named only by whitespace", async () => {
    const { deps } = spyDeps();

    await landInNewWorkspace(deps, "   ", null);

    expect(deps.setCurrentId).not.toHaveBeenCalled();
    expect(deps.navigateToDashboard).not.toHaveBeenCalled();
  });
});
