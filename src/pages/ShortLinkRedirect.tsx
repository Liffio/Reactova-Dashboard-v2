import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { API_BASE } from "@/lib/api";

const SHORTLINK_SLUG_PATTERN = /^[a-zA-Z0-9-]{3,64}$/;

type ResolveResponse = {
  destination: string;
};

/**
 * Public short link handler for go.reactova.com/{slug}.
 * Records click via API, then redirects to destination.
 */
export default function ShortLinkRedirect() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const started = useRef(false);
  const slug = location.pathname.replace(/^\/+/, "").split("/")[0]?.trim() ?? "";

  useEffect(() => {
    if (!slug || started.current) {
      return;
    }
    if (!SHORTLINK_SLUG_PATTERN.test(slug)) {
      return;
    }
    started.current = true;

    const params = new URLSearchParams({ format: "json" });
    const leadId = searchParams.get("l");
    if (leadId?.trim()) {
      params.set("l", leadId.trim());
    }

    const resolveUrl = `${API_BASE}/api/v1/public/shortlinks/${encodeURIComponent(slug)}?${params}`;

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
        /* silent */
      }
    })();
  }, [slug, searchParams]);

  return null;
}
