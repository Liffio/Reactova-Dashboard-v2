import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { hoverLift } from "@/lib/motion";
import { cn } from "@/lib/utils";

type MotionCardProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
};

export function MotionCard({ children, className, interactive = false }: MotionCardProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion || !interactive) {
    return (
      <div className={cn("surface-card", className)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn("surface-card", className)}
      variants={hoverLift}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
    >
      {children}
    </motion.div>
  );
}
