import type { Variants } from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: "easeOut" } },
};

export const slideRight: Variants = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export const staggerItem: Variants = {
  hidden: { y: 18 },
  show: { y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18, ease: "easeIn" } },
};

/**
 * Phone variant of `pageVariants`: opacity only, and short enough that a crossfade reads as one
 * continuous surface rather than two pages trading places. No `y` — translating the page while a
 * sticky topbar and a fixed tab bar hold still is what makes the desktop transition feel loose on
 * a small screen.
 */
export const mobilePageVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: "easeIn" } },
};

export const cardHover = {
  rest: { scale: 1, boxShadow: "var(--shadow-soft)" },
  hover: {
    scale: 1.012,
    boxShadow: "var(--shadow-glow)",
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
};
