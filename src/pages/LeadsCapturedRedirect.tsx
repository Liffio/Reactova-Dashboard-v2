import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { API_BASE } from "@/lib/api";

type ResolveResponse = {
  destination: string;
};

/**
 * Public DM button click handler. Records the lead click via API, then instantly redirects
 * to the real destination (no visible UI).
 */
export default function LeadsCapturedRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const started = useRef(false);

  useEffect(() => {
    if (!slug?.trim() || started.current) {
      return;
    }
    started.current = true;

    const params = new URLSearchParams({ format: "json" });
    const leadId = searchParams.get("l");
    if (leadId?.trim()) {
      params.set("l", leadId.trim());
    }

    const resolveUrl = `${API_BASE}/api/v1/public/leads-captured/${encodeURIComponent(slug.trim())}?${params}`;

    void (async () => {
      try {
        const res = await fetch(resolveUrl, {
          method: "GET",
          credentials: "omit",
          headers: { Accept: "application/json" }
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as ResolveResponse;
        if (typeof data.destination === "string" && data.destination.trim()) {
          window.location.replace(data.destination);
        }
      } catch {
        /* silent — user may close tab */
      }
    })();
  }, [slug, searchParams]);

  return null;
}
