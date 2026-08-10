import type { Card, GameState } from "./gameTypes";
import { drawAmount, isWildCard } from "./gameTypes";

/** Can this card legally be played given the current table state? */
export function isValidMove(state: GameState, card: Card): boolean {
  const top = state.discardTop;
  if (!top) return true;

  // Under a draw penalty you may only stack another draw card.
  if (state.pendingDraw > 0) {
    return drawAmount(card) > 0;
  }

  if (isWildCard(card)) return true;
  if (card.color === state.activeColor) return true;
  if (card.kind === top.kind) {
    if (card.kind === "number") return card.value === top.value;
    return true;
  }
  return false;
}

export function playableCardIds(state: GameState, hand: Card[]): string[] {
  return hand.filter((c) => isValidMove(state, c)).map((c) => c.id);
}

/** Why a card can't be played — used for clear player feedback. */
export function invalidReason(state: GameState, card: Card): string | null {
  if (isValidMove(state, card)) return null;
  if (state.pendingDraw > 0) return `STACK A DRAW CARD OR TAKE ${state.pendingDraw}`;
  return `DOESN'T MATCH ${String(state.activeColor ?? "").toUpperCase()} OR ${
    state.discardTop?.kind === "number"
      ? String(state.discardTop.value)
      : String(state.discardTop?.kind ?? "").toUpperCase()
  }`;
}
