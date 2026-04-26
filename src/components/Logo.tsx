import { cn } from "@/lib/utils";

export function Logo({  className = "" , hideText = false , isCenter = false }: { className?: string, hideText?: boolean, isCenter?: boolean }) {
  return (
    <>
      <div className={cn("flex items-baseline ", isCenter && "justify-center",`${className}`) } >
        <img src="/logo.png" alt="Logo" className={`h-10 w-auto ${className}`} />
        {!hideText && <span className={`inline-block font-bold leading-none md:text-3xl text-xl`}>eactova</span>}
      </div>
    </>
  );
}
