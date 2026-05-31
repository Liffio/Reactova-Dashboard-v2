import { cn } from "@/lib/utils";

export function Logo({ className = "", hideText = true, isCenter = false, size = "md" }: { className?: string, hideText?: boolean, isCenter?: boolean, size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-8 w-auto" : size === "md" ? "h-12 w-auto" : "h-24 w-auto mb-2 ";
  return (
    <>
      <div className={cn("flex items-center justify-start", isCenter && "justify-center!", `${sizeClass} ${className}`)} >
        <img src="/logo.png" alt="Logo" className={`${className}`} />
      </div>
    </>
  );
}
