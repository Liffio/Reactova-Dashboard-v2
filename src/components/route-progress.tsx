import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";

export function RouteProgress() {
  const isLoading = useRouterState({ select: (s) => s.status === "pending" });
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setProgress(10);
      timerRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 85) return p;
          return p + Math.random() * 12;
        });
      }, 220);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(100);
      const t = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 320);
      return () => clearTimeout(t);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-0 left-0 z-[9999] h-0.5 bg-transparent w-full pointer-events-none"
        >
          <motion.div
            className="h-full bg-brand-gradient rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ ease: "easeOut", duration: 0.22 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
