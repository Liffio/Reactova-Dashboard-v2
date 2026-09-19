/**
 * Where a buyer lands once a workspace purchase resolves. (FX8)
 *
 * ## Why this is a module and not four lines inside the component
 *
 * The whole requirement is an ORDER: refresh from the server, THEN make the new workspace active,
 * THEN navigate. Get that order wrong and the customer is bounced back into the workspace they came
 * from, which is the defect. An order is a behaviour, and a behaviour needs a test that can observe
 * it. This repo has no React test harness, so a `landInNewWorkspace` buried in a component could
 * only ever be checked by reading the source. Pulled out here with its collaborators injected, it is
 * tested by watching what it calls and in what sequence.
 *
 * ## The order, and why each step is where it is
 *
 * 1. **Refetch first.** `AppProvider` validates the active workspace id against the workspace list:
 *    `pickWorkspaceId` falls back to `workspaces[0]` for an id it cannot find, and an effect writes
 *    that fallback back into `currentId`. Switching to a workspace the list has not caught up with
 *    therefore does not merely fail, it actively reverts to the previous workspace.
 * 2. **Then make it active**, which also persists it as the stored last workspace and tells the
 *    server, so a reload right afterwards stays in the new workspace.
 * 3. **Then navigate**, once and only now that the payment has resolved. Never during it.
 */
export type LandingDeps = {
  /** Refetch the workspace list and the switcher payload. Must RESOLVE with the data in hand. */
  refetchWorkspaces: () => Promise<unknown>;
  /** Make this workspace active, persist it locally and tell the server. */
  setCurrentId: (workspaceId: string) => void;
  refreshAuth: () => Promise<unknown>;
  /** Remember the agency this landed in, so the next switcher open drills into it. */
  rememberGroup: (groupId: string | null) => void;
  closePanel: () => void;
  /** The one navigation this flow is allowed to make, and only after the intent reads PAID. */
  navigateToDashboard: () => Promise<unknown>;
};

export async function landInNewWorkspace(
  deps: LandingDeps,
  workspaceId: string,
  groupId: string | null,
): Promise<void> {
  /**
   * A guard rather than an assumption. Landing on an empty id would set the active workspace to
   * nothing and navigate anyway, which reads to the customer as "my new workspace vanished".
   */
  if (!workspaceId.trim()) return;

  await deps.refetchWorkspaces();

  deps.setCurrentId(workspaceId);
  await deps.refreshAuth();

  deps.rememberGroup(groupId);
  deps.closePanel();

  await deps.navigateToDashboard();
}
