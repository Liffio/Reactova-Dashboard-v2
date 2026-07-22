import { useEffect, useRef } from "react";
import { API_BASE } from "@/lib/api/http";

const SLUG_PATTERN = /^[a-zA-Z0-9-]{3,64}$/;

type ResolveResponse = { destination: string };

export function ShortLinkRedirect() {
  const started = useRef(false);
  const slug =
    typeof window !== "undefined"
      ? (window.location.pathname.replace(/^\/+/, "").split("/")[0]?.trim() ?? "")
      : "";

  useEffect(() => {
    if (!slug || started.current) return;
    if (!SLUG_PATTERN.test(slug)) return;
    started.current = true;

    const params = new URLSearchParams({ format: "json" });
    const searchParams = new URLSearchParams(window.location.search);
    const leadId = searchParams.get("l");
    if (leadId?.trim()) params.set("l", leadId.trim());

    const resolveUrl = `${API_BASE}/api/v1/public/shortlinks/${encodeURIComponent(slug)}?${params}`;

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
  }, [slug]);

  return null;
}
