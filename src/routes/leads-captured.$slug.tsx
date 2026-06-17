import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { API_BASE } from "@/lib/api/http";

export const Route = createFileRoute("/leads-captured/$slug")({
  component: LeadsCapturedRedirect,
});

type ResolveResponse = { destination: string };

function LeadsCapturedRedirect() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const started = useRef(false);

  useEffect(() => {
    if (!slug?.trim() || started.current) return;
    started.current = true;

    const params = new URLSearchParams({ format: "json" });
    const leadId = (search as Record<string, string>).l;
    if (leadId?.trim()) params.set("l", leadId.trim());

    const resolveUrl = `${API_BASE}/api/v1/public/leads-captured/${encodeURIComponent(slug.trim())}?${params}`;

    void (async () => {
      try {
        const res = await fetch(resolveUrl, {
          method: "GET",
          credentials: "omit",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as ResolveResponse;
        if (typeof data.destination === "string" && data.destination.trim()) {
          window.location.replace(data.destination);
        }
      } catch {
        /* silent */
      }
    })();
  }, [slug, search]);

  return null;
}
