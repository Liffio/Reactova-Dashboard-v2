import { CreatorArea } from "./primitives";

function Bar({ w, h, className }: { w: string; h: string; className?: string }) {
  return (
    <div
      style={{ width: w, height: h }}
      className={`rounded-lg bg-[var(--cp-skeleton)] ${className ?? ""}`}
    />
  );
}

/**
 * PageSkeleton — state-agnostic on purpose.
 *
 * It deliberately does NOT resemble the Active layout. If it did, a creator
 * whose connection has dropped would watch a plausible dashboard paint and then
 * be replaced by a takeover — which reads as the app losing their data rather
 * than as loading. Two neutral panels say "something is coming" without
 * promising which something.
 */
export function PageSkeleton() {
  return (
    <CreatorArea className="animate-pulse">
      <Bar w="120px" h="13px" />
      <Bar w="min(380px, 80%)" h="30px" className="mt-4" />
      <Bar w="min(520px, 95%)" h="15px" className="mt-3.5" />

      <div className="mt-9 flex flex-col gap-5 rounded-[14px] border border-[var(--cp-card-border)] bg-[var(--cp-card)] p-7 sm:flex-row">
        <div className="flex-1">
          <Bar w="70%" h="15px" />
          <Bar w="40%" h="38px" className="mt-5" />
          <Bar w="100%" h="10px" className="mt-[22px]" />
        </div>
        <div aria-hidden className="hidden w-px bg-[var(--cp-hairline-soft)] sm:block" />
        <div className="flex-1">
          <Bar w="70%" h="15px" />
          <Bar w="40%" h="38px" className="mt-5" />
          <Bar w="100%" h="10px" className="mt-[22px]" />
        </div>
      </div>
    </CreatorArea>
  );
}
