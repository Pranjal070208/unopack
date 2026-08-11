/**
 * Dynamic seat placement for 2–10 players.
 *
 * The local player is always anchored at the bottom of the table; every other
 * player is distributed along the remaining circumference. Nothing here is
 * hard-coded per player count — the same maths serves 2 and 10 players.
 */

export interface SeatPosition {
  /** Horizontal position as a percentage of the table width. */
  x: number;
  /** Vertical position as a percentage of the table height. */
  y: number;
  scale: number;
  rotation: number;
}

export type TableSize = "desktop" | "tablet" | "mobile";

/** Arc (degrees) the opponents are spread across. 90° is the bottom seat. */
const ARC_START = 150;
const ARC_SWEEP = 240;

const RADIUS: Record<TableSize, { rx: number; ry: number }> = {
  desktop: { rx: 40, ry: 33 },
  tablet: { rx: 40, ry: 30 },
  mobile: { rx: 38, ry: 26 },
};

export function calculatePlayerScale(totalPlayers: number, size: TableSize = "desktop"): number {
  const base = totalPlayers <= 4 ? 1 : totalPlayers <= 7 ? 0.86 : 0.72;
  const shrink = size === "desktop" ? 1 : size === "tablet" ? 0.92 : 0.82;
  return Number((base * shrink).toFixed(3));
}

/**
 * @param playerIndex      index of the player in the ordered seat list
 * @param totalPlayers     number of players at the table (2–10)
 * @param localPlayerIndex index of the viewing player, -1 when spectating
 */
export function getPlayerSeatPosition(
  playerIndex: number,
  totalPlayers: number,
  localPlayerIndex: number,
  size: TableSize = "desktop",
): SeatPosition {
  const total = Math.max(1, totalPlayers);
  const scale = calculatePlayerScale(total, size);
  const { rx, ry } = RADIUS[size];

  if (playerIndex === localPlayerIndex) {
    return { x: 50, y: 92, scale: 1, rotation: 0 };
  }

  // Relative index around the circle, with the local player as origin.
  const origin = localPlayerIndex < 0 ? 0 : localPlayerIndex;
  const rel = (playerIndex - origin + total) % total;
  const opponents = localPlayerIndex < 0 ? total : total - 1;
  const slot = localPlayerIndex < 0 ? rel : rel - 1;

  // Centre each opponent inside its own slice so a single opponent sits on top.
  const angle = ARC_START + ((slot + 0.5) * ARC_SWEEP) / Math.max(1, opponents);
  const rad = (angle * Math.PI) / 180;

  return {
    x: Number((50 + Math.cos(rad) * rx).toFixed(2)),
    y: Number((48 + Math.sin(rad) * ry).toFixed(2)),
    scale,
    // Gentle tilt away from centre; kept small so text stays readable.
    rotation: Number((Math.cos(rad) * -4).toFixed(2)),
  };
}

export function tableSizeFor(width: number): TableSize {
  if (width < 700) return "mobile";
  if (width < 1100) return "tablet";
  return "desktop";
}
