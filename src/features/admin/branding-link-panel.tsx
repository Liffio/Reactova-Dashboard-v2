import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchBrandingLinkByOwner } from "@/lib/api/admin-branding-links-api";

type Props = { workspaceId?: string; creatorProfileId?: string };

/**
 * Compact branding performance card for the admin creator and workspace detail pages.
 *
 * Renders nothing when the owner has no link yet. A card reading "0 clicks" for a workspace that
 * has never sent a branded DM is noise — absence of a link and absence of performance are
 * different facts, and only the second is worth a tile.
 */
export function BrandingLinkPanel({ workspaceId, creatorProfileId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "branding-link", workspaceId ?? creatorProfileId],
    queryFn: () => fetchBrandingLinkByOwner({ workspaceId, creatorProfileId }),
    enabled: Boolean(workspaceId || creatorProfileId),
  });

  if (isLoading || !data) return null;

  const clicks = Number(data.humanClicks);
  const signups = Number(data.signups);

  return (
    // `rounded-2xl` + `shadow-soft` rather than the shadcn `<Card>` default (`rounded-xl` +
    // `shadow`): every sibling card on all three host pages — admin creator detail, creator
    // management detail, and the workspace detail page — uses the 2xl/soft pairing, so the
    // default would visibly mismatch its neighbours on each of them.
    <Card className="rounded-2xl shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Branding link</CardTitle>
        {/* `/by-owner` applies no date filter at all — it is genuinely all-time, unlike the
            branding-links table (trailing 30 days). Two different measures need two different
            labels, or an admin comparing this panel against that creator's row sees numbers that
            disagree with no explanation. */}
        <p className="text-muted-foreground text-xs">All time</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <code className="text-xs text-muted-foreground">{data.code}</code>
        <div className="grid grid-cols-4 gap-3 text-sm">
          <Stat label="Clicks" value={clicks} />
          <Stat label="Signups" value={signups} />
          <Stat label="Conv %" value={Number(data.conversionRate)} />
          <Stat label="Paid" value={Number(data.paidConversions)} />
        </div>
        <Link
          to="/admin/branding-links/$linkId"
          params={{ linkId: data.id }}
          className="text-xs underline underline-offset-4"
        >
          View full analytics
        </Link>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}
