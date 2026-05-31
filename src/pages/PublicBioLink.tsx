import { useMemo, type CSSProperties } from "react";
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
    const data = query.data;
    const color = data?.accentColor ?? "#7C6AF7";
    const buttonStyle = data?.buttonStyle ?? "filled";
    const radius = data?.buttonRadius ?? 12;
    const borderWidth = data?.buttonBorderWidth ?? 0;
    const buttonTextColor = data?.buttonTextColor ?? "#fff";
    const shadow = data?.buttonShadow ? "0 8px 20px rgba(0,0,0,0.25)" : "none";
    const baseStyle: CSSProperties = {
      borderRadius: `${radius}px`,
      borderWidth: `${borderWidth}px`,
      borderStyle: "solid",
      boxShadow: shadow
    };
    if (buttonStyle === "outlined") {
      return {
        className: "rounded-lg border bg-transparent",
        style: { ...baseStyle, borderColor: color, color, background: "transparent" }
      };
    }
    if (buttonStyle === "soft") {
      return {
        className: "rounded-2xl",
        style: { ...baseStyle, background: `${color}24`, color: buttonTextColor, borderColor: "transparent" }
      };
    }
    return {
      className: "rounded-lg text-white",
      style: { ...baseStyle, background: color, color: buttonTextColor, borderColor: "transparent" }
    };
  }, [query.data]);

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
    <BioFrame data={query.data}>
      {query.data.avatarUrl ? (
        <img src={resolveAvatarUrl(query.data.avatarUrl)} alt="Avatar" className="h-20 w-20 rounded-full mb-3 mx-auto object-cover border border-white/20" />
      ) : (
        <div className="h-20 w-20 rounded-full mb-3 mx-auto" style={{ background: `linear-gradient(135deg, ${query.data.accentColor}, #1f2937)` }} />
      )}
      <div className="font-bold text-xl text-center">{query.data.displayName}</div>
      <p className="text-sm text-center mt-1 opacity-90">{query.data.bio}</p>
      <div className="w-full mt-8 space-y-3">
        {(query.data.sectionOrder ?? ["links", "socials"]).map((section) =>
          section === "links" ? (
            <div key="pub-links" className="space-y-3">
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
          ) : (
            <div
              key="pub-socials"
              className={cn(query.data.socialLayout === "horizontal" ? "flex flex-wrap justify-center gap-2" : "flex flex-col gap-3")}
            >
              {query.data.socials.map((item) => (
                <div key={item.id} className={cn(query.data.socialLayout === "horizontal" ? "min-w-[80px]" : "w-full")}>
                  <a
                    href={`${API_BASE}${item.clickUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "text-center px-4 py-2 font-medium transition-opacity hover:opacity-90 inline-flex items-center justify-center gap-1 w-full",
                      styles.className
                    )}
                    style={styles.style}
                  >
                    <span>{item.emoji || (item.platform === "instagram" ? "📸" : "🔗")}</span>
                    <span>{item.label}</span>
                  </a>
                  {item.platform === "instagram" && (item.mode === "posts" || item.mode === "reels") && (item.mediaItems?.length ?? 0) > 0 && (
                    <div className="grid grid-cols-3 gap-1 mt-2">
                      {item.mediaItems?.map((media) => (
                        <a key={media.id} href={media.permalink || "#"} target="_blank" rel="noreferrer">
                          <img src={media.mediaUrl} alt="Instagram media" className="w-full aspect-square object-cover rounded-md" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
      <div className="text-xs mt-10 text-center opacity-75">Powered by Liffio</div>
    </BioFrame>
  );
}

function BioFrame({
  children,
  data
}: {
  children: React.ReactNode;
  data?: {
    backgroundType: "solid" | "gradient";
    backgroundColor: string;
    backgroundColorTo: string;
    textColor: string;
    cardStyle: "solid" | "glass" | "outline";
    cardColor: string;
    cardOpacity: number;
    fontFamily: "inter" | "poppins" | "space-grotesk" | "playfair";
  };
}) {
  const rootBg =
    data?.backgroundType === "gradient"
      ? `linear-gradient(145deg, ${data.backgroundColor}, ${data.backgroundColorTo})`
      : data?.backgroundColor ?? "#0B1020";

  const cardStyle: CSSProperties = data
    ? data.cardStyle === "glass"
      ? {
          background: "rgba(15, 23, 42, 0.35)",
          border: "1px solid rgba(255,255,255,0.2)",
          backdropFilter: "blur(10px)"
        }
      : data.cardStyle === "outline"
        ? {
            background: "transparent",
            border: `1px solid ${data.cardColor}`
          }
        : {
            background: `${data.cardColor}${toAlphaHex(data.cardOpacity)}`,
            border: "1px solid rgba(255,255,255,0.08)"
          }
    : {};

  const fontFamily = getFontFamily(data?.fontFamily ?? "inter");

  return (
    <div
      className="min-h-screen px-4 py-10"
      style={{
        background: rootBg,
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: data?.textColor ?? "#fff",
        fontFamily
      }}
    >
      <div className="mx-auto max-w-md rounded-2xl p-6 min-h-[70vh]" style={cardStyle}>
        {children}
      </div>
    </div>
  );
}

function getFontFamily(font: "inter" | "poppins" | "space-grotesk" | "playfair") {
  if (font === "poppins") return "Poppins, Inter, sans-serif";
  if (font === "space-grotesk") return '"Space Grotesk", Inter, sans-serif';
  if (font === "playfair") return '"Playfair Display", Georgia, serif';
  return "Inter, sans-serif";
}

function toAlphaHex(value: number) {
  const clamped = Math.max(0, Math.min(100, value));
  const channel = Math.round((clamped / 100) * 255);
  return channel.toString(16).padStart(2, "0");
}

function resolveAvatarUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname === "unsplash.com" && url.pathname.startsWith("/photos/")) {
      const slug = url.pathname.split("/").pop() ?? "";
      const photoId = slug.split("-").pop();
      if (photoId) {
        return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=400&h=400&q=80`;
      }
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}
