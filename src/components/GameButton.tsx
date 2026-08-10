import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { playSound } from "@/hooks/useSound";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--ono-red)] text-white border-[var(--ono-red)] shadow-[0_10px_0_-2px_oklch(0.36_0.16_26),var(--glow-red)]",
  secondary:
    "bg-[var(--ono-yellow)] text-[oklch(0.16_0.012_285)] border-[var(--ono-yellow)] shadow-[0_10px_0_-2px_oklch(0.62_0.15_96),var(--glow-yellow)]",
  ghost: "bg-transparent text-foreground border-border hover:border-[var(--ono-yellow)]",
  danger: "bg-transparent text-[var(--ono-red)] border-[var(--ono-red)]/60 hover:bg-[var(--ono-red)]/10",
};

interface Props {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  pulse?: boolean;
}

export function GameButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  className,
  type = "button",
  pulse,
}: Props) {
  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-9 py-4 text-lg sm:text-xl",
  };
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        playSound("click");
        onClick?.();
      }}
      whileHover={disabled ? {} : { scale: 1.03 }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      animate={pulse && !disabled ? { scale: [1, 1.035, 1] } : { scale: 1 }}
      transition={pulse ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}
      className={cn(
        "relative rounded-xl border-2 font-display uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ono-yellow)]/70",
        VARIANTS[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
