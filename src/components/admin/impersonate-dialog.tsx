import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldAlert, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import { usePlatformCan } from "@/hooks/use-platform-authz";
import { getAdminUserWorkspaces } from "@/lib/api/admin-users-api";
import { startImpersonation } from "@/lib/api/admin-impersonation-api";

/**
 * The impersonate-start dialog (Task 18, spec §5.7/§7.4 + Ruling R20). One shared instance per
 * page (user list, user detail) rather than one per row — cheap to keep mounted since its
 * workspace-membership query is `enabled: open`, so an idle instance costs nothing.
 *
 * Start flow (R20 — READ BEFORE TOUCHING): on success this NEVER calls `setImpersonationToken`
 * and NEVER touches `localStorage`/`sessionStorage` from this (the admin's) tab. It hands the
 * minted token to a brand-new tab via the URL fragment `/dashboard#liffio_imp=<token>` —
 * `window.open(..., "_blank")` — exactly the convention `src/lib/api/impersonation.ts`'s
 * `consumeImpersonationHandoff()` (Task 19) already knows how to receive. This tab stays on the
 * admin console, fully authenticated as the admin the whole time (task-19-report.md §10.2's hard
 * structural requirement: reusing the same tab for both roles cannot work under the sessionStorage
 * design, because `resolveRequestToken()` in http.ts prefers whatever imp token sits in THIS tab's
 * own `sessionStorage`, and a fragment on the CURRENT tab's URL would write one there).
 *
 * Popup-blocker fix: the actual `window.open` call is deferred to a real click on the success
 * toast's own action button (`openImpersonatedTab`, below) rather than fired from inside the async
 * `mutation.onSuccess` — a browser no longer credits that callback with the click that started the
 * mutation by the time the network round trip resolves, so most popup blockers silently swallowed
 * it. See `openImpersonatedTab`'s own comment for the retry-on-block handling.
 */

const IMPERSONATE = "platform:impersonate";
/** Mirrors the server's `IMPERSONATION_REASON_MIN_LENGTH`/`_MAX_LENGTH`
 *  (`server/src/config/adminControlPlane.ts`) — client-side check in addition to the server's. */
const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 1000;
const TICKET_REF_MAX_LENGTH = 255;
/** Sentinel Select value for "no specific workspace" — `startImpersonation` maps this to `null`
 *  on the wire ("All workspaces"), never to an empty string. */
const ALL_WORKSPACES_VALUE = "__all__";

/**
 * Opens the impersonated tab at `/dashboard#liffio_imp=<token>` (R20 — see the file-level doc
 * comment) from a genuine, synchronous click on the toast's own action button, rather than from
 * the async `mutation.onSuccess` callback that used to call `window.open` directly. That
 * distinction matters: by the time an async callback resolves, most browsers no longer treat the
 * call as "triggered by the user's click" and silently block the popup — which used to leave the
 * dialog closed, the toast claiming success, and no second tab anywhere. Checking `window.open`'s
 * return value (`null` on a block) and offering the SAME button again as a "Try again" action
 * closes that gap instead of asserting success unconditionally.
 */
function openImpersonatedTab(token: string, expiresAt: string): void {
  const open = () => {
    const win = window.open(`/dashboard#liffio_imp=${encodeURIComponent(token)}`, "_blank");
    if (!win) {
      toast.error("Your browser blocked the popup.", {
        description: "Allow popups for this site, then try again.",
        duration: 15000,
        action: { label: "Try again", onClick: open },
      });
      return;
    }
    toast.success("Opened the impersonated tab.");
  };
  toast.success("Impersonation started", {
    description: `Ends at ${formatDateTime(expiresAt)}`,
    duration: 15000,
    action: { label: "Open impersonated tab", onClick: open },
  });
}

export function ImpersonateDialog({
  targetUserId,
  targetLabel,
  open,
  onOpenChange,
}: {
  targetUserId: string;
  targetLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const canImpersonate = usePlatformCan(IMPERSONATE);

  const [reason, setReason] = useState("");
  const [ticketRef, setTicketRef] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string>(ALL_WORKSPACES_VALUE);
  const [bannedConfirmRequired, setBannedConfirmRequired] = useState(false);
  const [confirmBanned, setConfirmBanned] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const reset = () => {
    setReason("");
    setTicketRef("");
    setWorkspaceId(ALL_WORKSPACES_VALUE);
    setBannedConfirmRequired(false);
    setConfirmBanned(false);
    setBlockedMessage(null);
  };

  // Fresh state every time a different target opens (rather than only on close) — otherwise a
  // leftover reason/ticket from a previous target could get submitted against this one.
  useEffect(() => {
    if (open) reset();
  }, [open, targetUserId]);

  // Reuses the exact same query the Workspaces tab uses (`["admin-user", userId, "workspaces"]`)
  // — same cache entry, so opening this dialog right after viewing that tab costs no round trip.
  const workspacesQuery = useQuery({
    queryKey: ["admin-user", targetUserId, "workspaces"],
    queryFn: () => getAdminUserWorkspaces(targetUserId),
    enabled: open && Boolean(targetUserId),
  });
  const workspaces = workspacesQuery.data?.items ?? [];
  const showWorkspaceSelector = workspaces.length > 1;

  const mutation = useMutation({
    mutationFn: () =>
      startImpersonation({
        targetUserId,
        // Selector shown only for >1 membership (brief's literal rule). Below that: a single
        // membership is the only sensible scope, so it's used automatically; zero memberships (or
        // the selector's own "All workspaces" choice) sends null.
        workspaceId: showWorkspaceSelector
          ? workspaceId === ALL_WORKSPACES_VALUE
            ? null
            : workspaceId
          : (workspaces[0]?.workspaceId ?? null),
        reason: reason.trim(),
        ticketRef: ticketRef.trim() ? ticketRef.trim() : null,
        ...(bannedConfirmRequired ? { confirmBanned: true as const } : {}),
      }),
    onSuccess: (res) => {
      // Popup-blocker fix: `window.open` used to fire right here, inside the async
      // mutation's onSuccess — after a network round trip, well past the point a browser still
      // credits this call with the click that started it, so most popup blockers silently
      // swallow it while the toast lied and said "opened in a new tab". Deferring the actual
      // `window.open` to the toast action BUTTON's own onClick gives it a fresh, genuine click
      // gesture to run on instead, which popup blockers do allow. `openImpersonatedTab` still
      // follows R20 to the letter once it runs: a genuinely NEW tab carrying the token in the URL
      // fragment, never a storage write or navigation from this (the admin's) tab.
      openImpersonatedTab(res.token, res.expiresAt);
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "TARGET_BANNED_CONFIRM_REQUIRED") {
        setBannedConfirmRequired(true);
        return;
      }
      if (err instanceof ApiError && err.code === "CANNOT_IMPERSONATE_ADMIN") {
        setBlockedMessage("Platform admins cannot be impersonated.");
        return;
      }
      if (err instanceof ApiError && err.code === "CANNOT_IMPERSONATE_SELF") {
        setBlockedMessage("You can't impersonate your own account.");
        return;
      }
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to start impersonation.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
    },
  });

  const trimmedLength = reason.trim().length;
  const reasonValid = trimmedLength >= REASON_MIN_LENGTH && trimmedLength <= REASON_MAX_LENGTH;
  const bannedOk = !bannedConfirmRequired || confirmBanned;
  const canSubmit = reasonValid && bannedOk && !blockedMessage;

  const handleClose = () => {
    if (mutation.isPending) return;
    onOpenChange(false);
  };

  // Belt-and-suspenders alongside every trigger site's own `usePlatformCan` gate (brief
  // requirement 2's "hide otherwise") — this dialog structurally cannot open without the
  // permission, no matter how it's triggered.
  if (!canImpersonate) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Impersonate {targetLabel}
          </DialogTitle>
          <DialogDescription>
            Opens a new tab, signed in as this user, in VIEW ONLY mode. Escalating to WRITE requires
            your own authenticator code, from the impersonation console, once the session is live.
          </DialogDescription>
        </DialogHeader>

        {blockedMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {blockedMessage}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Everything is logged: your identity, this user, your reason, and every action taken
                for the lifetime of the session.
              </span>
            </div>

            {showWorkspaceSelector && (
              <div className="space-y-1.5">
                <Label>Workspace</Label>
                <Select value={workspaceId} onValueChange={setWorkspaceId}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_WORKSPACES_VALUE}>All workspaces</SelectItem>
                    {workspaces.map((w) => (
                      <SelectItem key={w.workspaceId} value={w.workspaceId}>
                        {w.workspaceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="impersonate-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="impersonate-reason"
                value={reason}
                maxLength={REASON_MAX_LENGTH}
                placeholder="Why are you impersonating this account? (at least 10 characters)"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="impersonate-ticket">Ticket reference (optional)</Label>
              <Input
                id="impersonate-ticket"
                value={ticketRef}
                maxLength={TICKET_REF_MAX_LENGTH}
                placeholder="e.g. ZEN-1234"
                onChange={(e) => setTicketRef(e.target.value)}
              />
            </div>

            {bannedConfirmRequired && (
              <label className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <Checkbox
                  checked={confirmBanned}
                  onCheckedChange={(v) => setConfirmBanned(v === true)}
                  className="mt-0.5"
                />
                <span className="flex items-start gap-1.5">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />I understand this account
                  is banned.
                </span>
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          {!blockedMessage && (
            <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Starting…" : "Start impersonation"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
