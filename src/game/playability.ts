import { drawValue, isDrawCard, isWild, type Card } from "./cardTypes";
import type { GameState } from "./gameTypes";
import { GAME_CONFIG } from "./config";

export type PlayabilityReason =
  | "MATCHES_COLOR"
  | "MATCHES_NUMBER"
  | "MATCHES_SYMBOL"
  | "WILD"
  | "VALID_DRAW_STACK"
  | "INVALID_DRAW_STACK"
  | "NO_MATCH"
  | "NOT_YOUR_TURN"
  | "ELIMINATED"
  | "GAME_OVER"
  | "AWAITING_CHOICE";

export interface Playability {
  playable: boolean;
  reason: PlayabilityReason;
}

/** Pure match test against the table, ignoring turn ownership and stacks. */
export function matchesTable(card: Card, state: GameState): Playability {
  if (isWild(card)) return { playable: true, reason: "WILD" };
  const top = state.discardTop;
  if (!top) return { playable: true, reason: "MATCHES_COLOR" };
  if (card.color === state.currentColor) return { playable: true, reason: "MATCHES_COLOR" };
  if (card.type === "number" && top.type === "number" && card.value === top.value) {
    return { playable: true, reason: "MATCHES_NUMBER" };
  }
  if (card.type !== "number" && card.type === top.type) {
    return { playable: true, reason: "MATCHES_SYMBOL" };
  }
  return { playable: false, reason: "NO_MATCH" };
}

/** The single authoritative playability check used by server and UI. */
export function isPlayableCard(card: Card, state: GameState, playerId: string): Playability {
  if (state.status === "finished") return { playable: false, reason: "GAME_OVER" };
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return { playable: false, reason: "ELIMINATED" };
  if (state.currentPlayerId !== playerId) return { playable: false, reason: "NOT_YOUR_TURN" };
  if (state.pending) return { playable: false, reason: "AWAITING_CHOICE" };

  if (state.drawStack.active && GAME_CONFIG.ALLOW_STACKING) {
    // Only draw cards of equal or greater value may extend the stack.
    if (!isDrawCard(card)) return { playable: false, reason: "INVALID_DRAW_STACK" };
    if (card.type === "wildroulette" && !GAME_CONFIG.ALLOW_COLOR_ROULETTE_STACKING) {
      return { playable: false, reason: "INVALID_DRAW_STACK" };
    }
    return drawValue(card) >= state.drawStack.lastCardValue
      ? { playable: true, reason: "VALID_DRAW_STACK" }
      : { playable: false, reason: "INVALID_DRAW_STACK" };
  }

  return matchesTable(card, state);
}

export function playableCardIds(state: GameState, playerId: string): string[] {
  const hand = state.hands[playerId] ?? [];
  return hand.filter((c) => isPlayableCard(c, state, playerId).playable).map((c) => c.id);
}

export function hasPlayableCard(state: GameState, playerId: string): boolean {
  return playableCardIds(state, playerId).length > 0;
}

/** Human-readable explanation shown to the player for an illegal tap. */
export function explain(reason: PlayabilityReason, state: GameState): string {
  switch (reason) {
    case "INVALID_DRAW_STACK":
      return `PLAY A +${state.drawStack.lastCardValue} OR HIGHER, OR TAKE ${state.drawStack.totalPenalty}`;
    case "NOT_YOUR_TURN":
      return "NOT YOUR TURN";
    case "ELIMINATED":
      return "YOU ARE OUT";
    case "GAME_OVER":
      return "GAME OVER";
    case "AWAITING_CHOICE":
      return "FINISH YOUR CHOICE FIRST";
    default:
      return `DOESN'T MATCH ${String(state.currentColor ?? "").toUpperCase()}`;
  }
}
