import { cn } from "@/lib/utils";

export function Logo({ className = "", hideText = true, isCenter = false, size = "md" }: { className?: string, hideText?: boolean, isCenter?: boolean, size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-8 w-auto" : size === "md" ? "h-10 w-auto" : "h-12 w-auto";
  return (
    <>
      <div className={cn("flex items-baseline ", isCenter && "justify-center", `${className}`)} >
        <img src="/logo.png" alt="Logo" className={`${sizeClass} ${className}`} />
        {!hideText && <span className={`inline-block font-bold leading-none md:text-3xl text-xl`}>eactova</span>}
      </div>
    </>
  );
}
