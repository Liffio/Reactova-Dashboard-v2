import { type ReactNode } from "react";
import { ChevronDown, User, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDateTime, formatHandle } from "@/lib/format";
import { realHandle, UNKNOWN_PERSON } from "@/lib/instagram-identity";
import { FollowingStatus } from "@/components/leads/following-status";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/api/leads-api";

/**
 * One answer as stored in `leads.metadata.answers[key]` (chatbot/leads.ts `enrichLeadWithAnswer`,
 * backend). EMAIL/PHONE typed answers are excluded here — they already have their own fixed
 * fields above. A pre-this-feature row stored a raw string instead of this shape; it is still
 * shown, labelled by its own key, since there is no snapshotted question to show instead.
 */
type StoredAnswer = { type?: string; value?: string; question?: string | null };

type AnswerRow = { key: string; label: string; value: string };

function answerRows(lead: Lead): AnswerRow[] {
  const answers = (lead.metadata?.answers ?? {}) as Record<string, unknown>;
  const rows: AnswerRow[] = [];
  for (const [key, raw] of Object.entries(answers)) {
    if (typeof raw === "string") {
      rows.push({ key, label: key, value: raw });
      continue;
    }
    const a = raw as StoredAnswer;
    if (a?.type === "EMAIL" || a?.type === "PHONE") continue;
    rows.push({ key, label: a?.question?.trim() || key, value: a?.value ?? "" });
  }
  return rows;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function TechnicalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <code className="truncate font-mono text-[11px]">{value || "—"}</code>
    </div>
  );
}

/**
 * The leads detail side panel (spec Part 3 — "Detail panel").
 *
 * Deliberately NOT built on the Sheet/Dialog primitive: a Radix dialog is modal — it dims and
 * blocks the page behind it, which is exactly what the spec rules out ("Not a modal. The table
 * stays visible so you can click through several leads without losing your place."). Below the
 * `md` breakpoint the panel takes the full width anyway, so a backdrop is added there only, purely
 * so the panel doesn't look like it's floating over nothing — it still isn't a focus-trapping
 * modal, and tapping it closes the panel rather than requiring an explicit close tap.
 */
export function LeadDetailPanel({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const open = Boolean(lead);
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-background shadow-xl transition-transform duration-200 ease-out sm:max-w-md",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {lead && <LeadDetailContent lead={lead} onClose={onClose} />}
      </aside>
    </>
  );
}

function LeadDetailContent({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const username = realHandle(lead.igUsername, lead.igUserId);
  const handle = formatHandle(username);
  const initial = (username ?? lead.displayName ?? "").trim().charAt(0).toUpperCase();
  const answers = answerRows(lead);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11 shrink-0">
            {lead.profilePicUrl && <AvatarImage src={lead.profilePicUrl} className="object-cover" />}
            <AvatarFallback className="bg-brand-gradient text-sm font-bold text-white">
              {initial || <User className="h-4 w-4" aria-hidden />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {/* Username bold on top, display name beneath — the spec's order for this panel,
                the reverse of the name-first convention `instagramIdentity()` uses elsewhere. */}
            <p className="truncate font-display text-base font-semibold">
              {handle ?? UNKNOWN_PERSON}
            </p>
            {lead.displayName && (
              <p className="truncate text-sm text-muted-foreground">{lead.displayName}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/*
       * Every field the desktop table shows, always rendered — mobile has no three-column
       * overview to fall back on, so a value this lead doesn't have reads as "—", not as an
       * omitted field (spec item 1: the point of tap-for-detail is that the detail is complete).
       */}
      <div className="divide-y divide-border border-y border-border">
        <Field label="Source">{lead.source ?? "—"}</Field>
        <Field label="Keyword">
          {lead.keyword ? (
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px]">
              {lead.keyword}
            </span>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Placement">{lead.placement ?? "—"}</Field>
        <Field label="Email">{lead.email ?? "—"}</Field>
        <Field label="Phone">{lead.phone ?? "—"}</Field>
        <Field label="Tags">{lead.tags.length > 0 ? lead.tags.join(" · ") : "—"}</Field>
        <Field label="Following">
          <FollowingStatus value={lead.isFollowing} />
        </Field>
        <Field label="Link clicked">
          {lead.linkClicked === null ? "—" : lead.linkClicked ? "Yes" : "No"}
        </Field>
        <Field label="Captured">{formatDateTime(lead.capturedAt)}</Field>
        <Field label="Last seen">{formatDateTime(lead.lastInteractionAt)}</Field>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Answers
        </h3>
        {answers.length > 0 ? (
          <dl className="flex flex-col gap-2.5 text-sm">
            {answers.map((a) => (
              <div key={a.key} className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0 flex-1 text-muted-foreground">{a.label}</dt>
                <dd className="shrink-0 break-all text-right font-medium">{a.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">No answers yet.</p>
        )}
      </div>

      <Collapsible className="mt-5">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted">
          Technical
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
          <TechnicalRow label="Comment id" value={String(lead.metadata?.commentId ?? "")} />
          <TechnicalRow label="Ad media id" value={lead.sourceMediaId ?? ""} />
          <TechnicalRow label="Original post" value={String(lead.metadata?.originalMediaId ?? "")} />
          <TechnicalRow label="Ad id" value={String(lead.metadata?.adId ?? "")} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
