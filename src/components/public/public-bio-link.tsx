import { useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { getPublicBioLink, type PublicBioLinkPayload } from "@/lib/api/biolink-api";
import { resolveApiAssetUrl, API_BASE } from "@/lib/api/http";
import { cn } from "@/lib/utils";

const publicQueryClient = new QueryClient();

export function PublicBioLinkApp() {
  return (
    <QueryClientProvider client={publicQueryClient}>
      <PublicBioLinkInner />
    </QueryClientProvider>
  );
}

function PublicBioLinkInner() {
  const pathSlug =
    typeof window !== "undefined"
      ? window.location.pathname.replace(/^\/+/, "").split("/")[0] ?? ""
      : "";
  const querySlug =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("slug") ?? ""
      : "";
  const slug = (pathSlug || querySlug).trim();

  const query = useQuery({
    queryKey: ["public-biolink", slug],
    queryFn: () => getPublicBioLink(slug),
    enabled: Boolean(slug),
    retry: 1,
  });

  const styles = useMemo(() => buildButtonStyles(query.data), [query.data]);

  if (!slug) {
    return (
      <BioFrame>
        <p className="text-sm opacity-75">Missing bio slug.</p>
      </BioFrame>
    );
  }

  if (query.isLoading) {
    return (
      <BioFrame>
        <div className="h-20 w-20 rounded-full animate-pulse bg-white/20 mb-3 mx-auto" />
        <div className="h-6 w-32 rounded-full animate-pulse bg-white/20 mx-auto mb-2" />
        <div className="w-full mt-8 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-xl animate-pulse bg-white/10" />
          ))}
        </div>
      </BioFrame>
    );
  }

  if (query.isError || !query.data) {
    return (
      <BioFrame>
        <p className="text-sm opacity-75">Bio link not found.</p>
      </BioFrame>
    );
  }

  const data = query.data;
  const avatarUrl = resolveApiAssetUrl(data.avatarUrl);

  return (
    <BioFrame data={data}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Avatar"
          className="h-20 w-20 rounded-full mb-3 mx-auto object-cover border-2 border-white/20"
        />
      ) : (
        <div
          className="h-20 w-20 rounded-full mb-3 mx-auto"
          style={{ background: `linear-gradient(135deg, ${data.accentColor}, #1f2937)` }}
        />
      )}
      <p className="font-bold text-xl text-center">{data.displayName}</p>
      {data.bio && <p className="text-sm text-center mt-1 opacity-90">{data.bio}</p>}

      <div className="w-full mt-8 space-y-3">
        {(data.sectionOrder ?? ["links", "socials"]).map((section) =>
          section === "links" ? (
            <div key="pub-links" className="space-y-3">
              {data.links.map((link) => (
                <a
                  key={link.id}
                  href={`${API_BASE}${link.clickUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "block w-full text-center px-4 py-3 font-medium transition-opacity hover:opacity-90",
                    styles.className
                  )}
                  style={styles.style}
                >
                  {link.title}
                </a>
              ))}
            </div>
          ) : (
            <div
              key="pub-socials"
              className={cn(
                data.socialLayout === "horizontal"
                  ? "flex flex-wrap justify-center gap-2"
                  : "flex flex-col gap-3"
              )}
            >
              {data.socials.map((item) => (
                <a
                  key={item.id}
                  href={`${API_BASE}${item.clickUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "text-center px-4 py-2 font-medium transition-opacity hover:opacity-90 inline-flex items-center justify-center gap-1",
                    data.socialLayout === "horizontal" ? "min-w-[80px]" : "w-full",
                    styles.className
                  )}
                  style={styles.style}
                >
                  {item.emoji && <span>{item.emoji}</span>}
                  {item.label}
                </a>
              ))}
            </div>
          )
        )}
      </div>
    </BioFrame>
  );
}

function BioFrame({
  data,
  children,
}: {
  data?: PublicBioLinkPayload;
  children: React.ReactNode;
}) {
  const bg = data
    ? data.backgroundType === "gradient"
      ? `linear-gradient(135deg, ${data.backgroundColor}, ${data.backgroundColorTo})`
      : data.backgroundColor
    : "#111827";

  return (
    <div
      className="min-h-screen w-full flex justify-center py-10 px-4"
      style={{ background: bg, color: data?.textColor ?? "#ffffff" }}
    >
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

function buildButtonStyles(data?: PublicBioLinkPayload) {
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
    boxShadow: shadow,
  };

  if (buttonStyle === "outlined") {
    return {
      className: "rounded-lg border bg-transparent",
      style: { ...baseStyle, borderColor: color, color, background: "transparent" },
    };
  }
  if (buttonStyle === "soft") {
    return {
      className: "rounded-2xl",
      style: {
        ...baseStyle,
        background: `${color}24`,
        color: buttonTextColor,
        borderColor: "transparent",
      },
    };
  }
  return {
    className: "rounded-lg",
    style: { ...baseStyle, background: color, color: buttonTextColor, borderColor: "transparent" },
  };
}
