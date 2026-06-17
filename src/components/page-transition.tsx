import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { pageVariants, staggerContainer, staggerItem } from "@/lib/motion";

export function PageTransition({ children, keyProp }: { children: ReactNode; keyProp?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={keyProp}
        variants={pageVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        className="flex-1"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function AnimatedGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
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
