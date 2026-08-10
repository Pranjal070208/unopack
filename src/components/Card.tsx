import { motion } from "framer-motion";
import type { Card as CardType } from "@/game/gameTypes";
import { cardFace } from "@/game/cardTypes";
import { cn } from "@/lib/utils";

const COLOR_VAR: Record<string, string> = {
  red: "var(--ono-red)",
  yellow: "var(--ono-yellow)",
  green: "var(--ono-green)",
  blue: "var(--ono-blue)",
  wild: "var(--surface-2)",
};

const SIZES = {
  sm: "w-12 h-[68px] text-base",
  md: "w-[74px] h-[110px] text-xl",
  lg: "w-[96px] h-[142px] text-2xl",
  xl: "w-[120px] h-[176px] text-3xl",
};

export { cardFace };


interface CardProps {
  card: CardType;
  size?: keyof typeof SIZES;
  disabled?: boolean;
  selected?: boolean;
  className?: string;
  onClick?: () => void;
  onHoverStart?: () => void;
}

export function GameCard({
  card,
  size = "md",
  disabled,
  selected,
  className,
  onClick,
  onHoverStart,
}: CardProps) {
  const isWild = card.color === "wild";
  const face = cardFace(card);
  const long = face.length > 3;

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onHoverStart={() => onHoverStart?.()}
      aria-label={`${card.color === "wild" ? "wild" : card.color} ${face || card.value}`}
      whileHover={disabled ? {} : { y: -18, rotate: -3, scale: 1.06 }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      animate={selected ? { y: -26, scale: 1.08 } : { y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className={cn(
        "relative shrink-0 select-none rounded-2xl border-[3px] font-display leading-none noise gloss",
        SIZES[size],
        disabled ? "opacity-45 grayscale-[0.5] cursor-not-allowed" : "cursor-pointer",
        selected ? "ring-4 ring-[var(--ono-yellow)]" : "",
        className,
      )}
      style={{
        background: isWild
          ? "conic-gradient(from 210deg, var(--ono-red), var(--ono-yellow), var(--ono-green), var(--ono-blue), var(--ono-red))"
          : `radial-gradient(circle at 30% 20%, color-mix(in oklab, ${COLOR_VAR[card.color]} 82%, white), ${COLOR_VAR[card.color]})`,
        borderColor: "oklch(0.98 0.004 90)",
        boxShadow: selected
          ? "0 22px 40px -12px oklch(0 0 0 / 0.9), 0 0 26px oklch(0.87 0.19 96 / 0.6)"
          : "var(--shadow-card)",
      }}
    >
      <span className="absolute inset-[6px] rounded-xl border border-white/25" />
      <span
        className={cn(
          "absolute inset-0 grid place-items-center px-1 text-center text-white",
          long ? "text-[0.62em]" : "text-[1.7em]",
        )}
        style={{ textShadow: "0 3px 0 oklch(0 0 0 / 0.45)" }}
      >
        {face}
      </span>
      <span className="absolute left-1.5 top-1 text-[0.5em] text-white/85">{face}</span>
      <span className="absolute bottom-1 right-1.5 rotate-180 text-[0.5em] text-white/85">{face}</span>
    </motion.button>
  );
}

export function CardBack({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-2xl border-[3px] border-white/90 noise",
        SIZES[size],
        className,
      )}
      style={{
        background: "linear-gradient(150deg, oklch(0.28 0.02 285), oklch(0.15 0.01 285))",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <span className="absolute inset-[8px] grid place-items-center rounded-xl border border-[var(--ono-red)]/60">
        <span className="font-display text-[0.55em] tracking-tight text-[var(--ono-yellow)]">ONO</span>
      </span>
    </div>
  );
}
