import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  hideText?: boolean;
  isCenter?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({
  className,
  hideText = true,
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
          "w-auto object-contain shrink-0",
          className
        )}
      />
    </div>
  );
}