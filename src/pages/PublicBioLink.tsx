import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { API_BASE } from "@/lib/api";
import { getPublicBioLink } from "@/hooks/useBioLink";
import { cn } from "@/lib/utils";

export default function PublicBioLink() {
  const location = useLocation();
  const pathSlug = location.pathname.replace(/^\/+/, "");
  const querySlug = new URLSearchParams(location.search).get("slug") ?? "";
  const slug = (pathSlug || querySlug).trim();

  const query = useQuery({
    queryKey: ["public-biolink", slug],
    queryFn: () => getPublicBioLink(slug),
    enabled: Boolean(slug)
  });

  const styles = useMemo(() => {
    const color = query.data?.accentColor ?? "#7C6AF7";
    const buttonStyle = query.data?.buttonStyle ?? "filled";
    if (buttonStyle === "outlined") {
      return {
        className: "rounded-lg border bg-transparent",
        style: { borderColor: color, color }
      };
    }
    if (buttonStyle === "soft") {
      return {
        className: "rounded-2xl",
        style: { background: `${color}24`, color }
      };
    }
    return {
      className: "rounded-lg text-white",
      style: { background: color, color: "#fff" }
    };
  }, [query.data?.accentColor, query.data?.buttonStyle]);

  if (!slug) {
    return <BioFrame><p className="text-sm text-muted-foreground">Missing bio slug.</p></BioFrame>;
  }
  if (query.isLoading) {
    return <BioFrame><p className="text-sm text-muted-foreground">Loading...</p></BioFrame>;
  }
  if (query.isError || !query.data) {
    return <BioFrame><p className="text-sm text-muted-foreground">Bio link not found.</p></BioFrame>;
  }

  return (
    <BioFrame>
      <div className="h-20 w-20 rounded-full mb-3 mx-auto" style={{ background: `linear-gradient(135deg, ${query.data.accentColor}, #1f2937)` }} />
      <div className="font-bold text-xl text-center">{query.data.displayName}</div>
      <p className="text-sm text-muted-foreground text-center mt-1">{query.data.bio}</p>
      <div className="w-full mt-8 space-y-3">
        {query.data.links.map((link) => (
          <a
            key={link.id}
            href={`${API_BASE}${link.clickUrl}`}
            target="_blank"
            rel="noreferrer"
            className={cn("block w-full text-center px-4 py-3 font-medium transition-opacity hover:opacity-90", styles.className)}
            style={styles.style}
          >
            {link.title}
          </a>
        ))}
      </div>
      <div className="text-xs text-muted-foreground mt-10 text-center">Powered by Reactova</div>
    </BioFrame>
  );
}

function BioFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6">
        {children}
      </div>
    </div>
  );
}
