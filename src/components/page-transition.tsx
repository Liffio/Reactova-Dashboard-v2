import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { mobilePageVariants, pageVariants, staggerContainer, staggerItem } from "@/lib/motion";

/**
 * Route-change animation.
 *
 * `mode="wait"` serialises the two halves — the outgoing page must finish before the incoming
 * one starts — so the desktop timings cost 0.18s + 0.3s of dead time on every navigation. On a
 * phone, where taps come faster and the paint budget is smaller, that reads as lag rather than
 * polish, and the 10px slide compounds it by moving content the thumb is already reaching for.
 *
 * Mobile therefore crossfades: no `mode="wait"`, so the halves overlap, and opacity only, so
 * nothing translates under a fixed topbar or tab bar. Reduced-motion gets the same treatment at
 * zero duration, which is a cut rather than an animation.
 */
export function PageTransition({ children, keyProp }: { children: ReactNode; keyProp?: string }) {
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  const crossfade = isMobile || reduced;

  return (
    <AnimatePresence mode={crossfade ? "sync" : "wait"} initial={false}>
      <motion.div
        key={keyProp}
        variants={crossfade ? mobilePageVariants : pageVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        transition={reduced ? { duration: 0 } : undefined}
        className="flex-1"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function AnimatedGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function AnimatedItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

export function FadeUp({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
