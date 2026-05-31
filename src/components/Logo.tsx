import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

interface LogoProps {
  className?: string;
  hideText?: boolean;
  isCenter?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({
  className,
  isCenter = false,
  size = "md",
}: LogoProps) {
  const imageSize = {
    sm: "h-8",
    md: "h-12",
    lg: "h-24",
  };

  return (
    <div
      className={cn(
        "flex items-center",
        isCenter ? "justify-center" : "justify-start"
      )}
    >
      <img
        src="/logo.png"
        alt="Liffio"
        className={cn(
          imageSize[size],
          "w-auto object-contain dark:hidden",
          className
        )}
      />

      <img
        src="/logo-light.png"
        alt="Liffio"
        className={cn(
          imageSize[size],
          "hidden w-auto object-contain dark:block",
          className
        )}
      />
    </div>
  );
}