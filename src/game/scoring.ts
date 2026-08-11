/**
 * Optional Score Mode (official No Mercy scoring sheet).
 *
 * Number cards score face value, coloured action cards 20, wild action cards 50.
 * The winner of a hand scores every card left in the other players' hands plus
 * a 250 point knockout bonus for each player eliminated during that hand.
 * First player to reach SCORE_TARGET wins the match.
 */
import type { Card } from "./cardTypes";
import type { GameState } from "./gameTypes";
import { GAME_CONFIG } from "./config";

export const KNOCKOUT_BONUS = GAME_CONFIG.KNOCKOUT_BONUS;
export const SCORE_TARGET = GAME_CONFIG.SCORE_TARGET;

export function cardPoints(card: Card): number {
  if (card.type === "number") return card.value ?? 0;
  return card.color === "wild" ? 50 : 20;
}

export function handPoints(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + cardPoints(c), 0);
}

export interface HandScore {
  winnerId: string | null;
  /** Points from cards left in still-active opponents' hands. */
  cardPoints: number;
  knockouts: number;
  knockoutPoints: number;
  total: number;
}

/**
 * Score a finished hand. Cards held by eliminated players are ignored — the
 * winner is paid the 250 point knockout bonus for them instead.
 */
export function calculateScore(state: GameState, winnerId: string | null = state.winnerId): HandScore {
  let cards = 0;
  let knockouts = 0;
  for (const p of state.players) {
    if (p.id === winnerId) continue;
    if (p.eliminated) {
      knockouts += 1;
      continue;
    }
    cards += handPoints(state.hands[p.id] ?? []);
  }
  const knockoutPoints = knockouts * KNOCKOUT_BONUS;
  return { winnerId, cardPoints: cards, knockouts, knockoutPoints, total: cards + knockoutPoints };
}

export function reachedTarget(score: number): boolean {
  return score >= SCORE_TARGET;
}
