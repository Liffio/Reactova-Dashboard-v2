import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Music2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";

type Props = {
  workspaceId: string;
  instagramConnected: boolean;
};

export function InstagramMusicSessionSettings({ workspaceId, instagramConnected }: Props) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState("");
  const [csrfToken, setCsrfToken] = useState("");

  const statusQuery = useQuery({
    queryKey: ["instagram-music-session", workspaceId],
    queryFn: () =>
      apiRequest<{ configured: boolean; updatedAt: string | null }>(
        "/api/v1/integrations/meta/instagram-music-session",
        { workspaceId }
      ),
    enabled: Boolean(workspaceId) && instagramConnected
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ configured: boolean; updatedAt: string }>(
        "/api/v1/integrations/meta/instagram-music-session",
        {
          method: "PUT",
          workspaceId,
          body: { sessionId: sessionId.trim(), csrfToken: csrfToken.trim() }
        }
      ),
    onSuccess: async () => {
      setSessionId("");
      setCsrfToken("");
      await queryClient.invalidateQueries({ queryKey: ["instagram-music-session", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["scheduler", "music-search"] });
      toast.success("Instagram music search enabled for this workspace");
    },
    onError: (error) => toast.error((error as Error).message)
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      apiRequest<void>("/api/v1/integrations/meta/instagram-music-session", {
        method: "DELETE",
        workspaceId
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["instagram-music-session", workspaceId] });
      toast.success("Instagram music session removed");
    },
    onError: (error) => toast.error((error as Error).message)
  });

  if (!instagramConnected) {
    return null;
  }

  const configured = statusQuery.data?.configured ?? false;

  return (
    <div className="rounded-lg border border-border bg-background/60 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Music2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium">Licensed music search</p>
          <p className="text-xs text-muted-foreground">
            Instagram Business Login cannot search Meta&apos;s music catalog. Paste a one-time web
            session from the same Instagram account (open instagram.com → DevTools → Application →
            Cookies → copy <span className="font-mono">sessionid</span> and{" "}
            <span className="font-mono">csrftoken</span>).
          </p>
          {configured ? (
            <p className="text-xs text-primary">
              Configured
              {statusQuery.data?.updatedAt
                ? ` · updated ${new Date(statusQuery.data.updatedAt).toLocaleString()}`
                : ""}
            </p>
          ) : (
            <p className="text-xs text-warning">Not configured — scheduler music search will fail until saved.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ig-music-sessionid">sessionid</Label>
          <Input
            id="ig-music-sessionid"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Paste sessionid cookie value"
            className="bg-input border-border font-mono text-xs"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ig-music-csrf">csrftoken</Label>
          <Input
            id="ig-music-csrf"
            value={csrfToken}
            onChange={(e) => setCsrfToken(e.target.value)}
            placeholder="Paste csrftoken cookie value"
            className="bg-input border-border font-mono text-xs"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!sessionId.trim() || !csrfToken.trim() || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Validating…" : configured ? "Update session" : "Save session"}
        </Button>
        {configured ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={clearMutation.isPending}
            onClick={() => clearMutation.mutate()}
          >
            Remove
          </Button>
        ) : null}
        <Link to="/scheduler" className="text-xs text-primary hover:underline">
          Open scheduler
        </Link>
      </div>
    </div>
  );
}
