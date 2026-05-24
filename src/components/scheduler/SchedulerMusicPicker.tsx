import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Music2, X } from "lucide-react";
import { apiRequest, resolveApiAssetUrl } from "@/lib/api";
import type { InstagramMusicTrack } from "@/hooks/useScheduler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";

type Props = {
  workspaceId: string;
  postType: string;
  selected: InstagramMusicTrack | null;
  onSelect: (track: InstagramMusicTrack | null) => void;
  musicSoundVolume: number;
  originalSoundVolume: number;
  onMusicSoundVolumeChange: (value: number) => void;
  onOriginalSoundVolumeChange: (value: number) => void;
  shareToFeed: boolean;
  onShareToFeedChange: (value: boolean) => void;
};

export function SchedulerMusicPicker({
  workspaceId,
  postType,
  selected,
  onSelect,
  musicSoundVolume,
  originalSoundVolume,
  onMusicSoundVolumeChange,
  onOriginalSoundVolumeChange,
  shareToFeed,
  onShareToFeedChange
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const isReel = postType === "REEL";

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const sessionQuery = useQuery({
    queryKey: ["instagram-music-session", workspaceId],
    queryFn: () =>
      apiRequest<{ configured: boolean; updatedAt: string | null }>(
        "/api/v1/integrations/meta/instagram-music-session",
        { workspaceId }
      ),
    enabled: Boolean(workspaceId)
  });

  const searchQuery = useQuery({
    queryKey: ["scheduler", "music-search", workspaceId, debouncedQuery],
    queryFn: () => {
      const qs = new URLSearchParams({
        q: debouncedQuery,
        limit: "25"
      });
      return apiRequest<{ tracks: InstagramMusicTrack[] }>(
        `/api/v1/scheduler/music/search?${qs.toString()}`,
        { workspaceId }
      );
    },
    enabled: Boolean(workspaceId) && open && (sessionQuery.data?.configured ?? false),
    staleTime: 60_000
  });

  const tracks = useMemo(() => searchQuery.data?.tracks ?? [], [searchQuery.data?.tracks]);
  const sessionConfigured = sessionQuery.data?.configured ?? false;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-3">
      <div>
        <Label>Instagram music</Label>
        <p className="text-xs text-muted-foreground">
          Search licensed tracks for scheduled posts. Music is attached when publishing reels; for
          other types it is stored on the schedule for reference and future use.
        </p>
      </div>

      {!sessionConfigured && !sessionQuery.isLoading ? (
        <p className="text-xs text-warning rounded-lg border border-warning/30 bg-warning/5 p-2">
          Music search is not configured.{" "}
          <Link to="/settings?tab=General" className="text-primary underline">
            Add your Instagram session in Settings
          </Link>{" "}
          (sessionid + csrftoken cookies).
        </p>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2 bg-input border-border"
            disabled={!sessionConfigured}
          >
            <Music2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {selected ? (
              <span className="truncate text-left">
                {selected.title}
                {selected.artist ? ` — ${selected.artist}` : ""}
              </span>
            ) : (
              <span className="text-muted-foreground">Search and select a track…</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,420px)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search songs or artists…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {searchQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Searching…
                </div>
              ) : null}
              {searchQuery.isError ? (
                <CommandEmpty>
                  <span className="block text-left px-2">
                    {searchQuery.error instanceof Error
                      ? searchQuery.error.message
                      : "Could not search music"}
                    {" "}
                    <Link to="/settings?tab=General" className="text-primary underline">
                      Configure session
                    </Link>
                  </span>
                </CommandEmpty>
              ) : null}
              {!searchQuery.isLoading && !searchQuery.isError && tracks.length === 0 ? (
                <CommandEmpty>No tracks found. Try another keyword.</CommandEmpty>
              ) : null}
              <CommandGroup>
                {tracks.map((track) => {
                  const coverSrc = resolveApiAssetUrl(track.coverUrl);
                  return (
                  <CommandItem
                    key={`${track.id}:${track.clusterId}`}
                    value={`${track.id}-${track.title}`}
                    onSelect={() => {
                      onSelect(track);
                      setOpen(false);
                    }}
                    className="flex items-center gap-3"
                  >
                    {coverSrc ? (
                      <img
                        src={coverSrc}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Music2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{track.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {track.artist || "Unknown artist"}
                      </p>
                    </div>
                  </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <div className="min-w-0 text-sm">
            <p className="font-medium truncate">{selected.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {selected.artist || "Unknown artist"} · ID {selected.id}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onSelect(null)} aria-label="Clear music">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Music volume (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={musicSoundVolume}
            onChange={(e) => onMusicSoundVolumeChange(Number(e.target.value))}
            className="bg-input border-border"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Original audio volume (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={originalSoundVolume}
            onChange={(e) => onOriginalSoundVolumeChange(Number(e.target.value))}
            className="bg-input border-border"
          />
        </div>
      </div>

      {isReel ? (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Also show on feed</span>
          <input
            type="checkbox"
            checked={shareToFeed}
            onChange={(e) => onShareToFeedChange(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
        </label>
      ) : null}
    </div>
  );
}
