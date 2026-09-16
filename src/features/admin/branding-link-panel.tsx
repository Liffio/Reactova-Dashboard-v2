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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Branding link</CardTitle>
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
