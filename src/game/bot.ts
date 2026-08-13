/**
 * Pure bot decision logic. Given the authoritative state it returns the single
 * next command the bot wants to issue, or null when it has nothing to do.
 *
 * The engine remains the only authority: every command produced here goes
 * through the exact same validation a human command does.
 */
import { COLORS, drawValue, isWild, type Card, type CardColor } from "./cardTypes";
import type { GameState } from "./gameTypes";
import { playableCardIds } from "./playability";

export type BotDifficulty = "easy" | "normal" | "hard";

export type BotCommand =
  | { type: "PLAY_CARD"; cardId: string; color?: CardColor; targetId?: string }
  | { type: "DRAW_CARD" }
  | { type: "CHOOSE_COLOR"; color: CardColor }
  | { type: "CHOOSE_ROULETTE_COLOR"; color: CardColor }
  | { type: "CHOOSE_SWAP_TARGET"; targetId: string }
  | { type: "CALL_UNO" }
  | { type: "CATCH_UNO"; targetId: string };

export const BOT_NAMES = [
  "BRUTUS",
  "VIPER",
  "NOVA",
  "HEX",
  "RAZOR",
  "OMEGA",
  "BLITZ",
  "KARMA",
  "SHADE",
];

export const BOT_AVATARS = ["skull", "ghost", "alien", "robot", "flame", "bolt"];

/** Chance the bot remembers to call/catch ONO. */
const DISCIPLINE: Record<BotDifficulty, { call: number; catch: number; blunder: number }> = {
  easy: { call: 0.35, catch: 0.1, blunder: 0.45 },
  normal: { call: 0.85, catch: 0.5, blunder: 0.15 },
  hard: { call: 1, catch: 1, blunder: 0 },
};

function countByColor(hand: Card[]): Record<CardColor, number> {
  const out: Record<CardColor, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of hand) if (c.color !== "wild") out[c.color] += 1;
  return out;
}

/** Colour the bot holds the most of — the one it can keep playing into. */
export function dominantColor(hand: Card[]): CardColor {
  const counts = countByColor(hand);
  return COLORS.reduce((best, c) => (counts[c] > counts[best] ? c : best), COLORS[0]!);
}

/** Colour the bot holds the least of — likeliest to surface fast in a roulette. */
function scarcestColor(hand: Card[]): CardColor {
  const counts = countByColor(hand);
  return COLORS.reduce((best, c) => (counts[c] < counts[best] ? c : best), COLORS[0]!);
}

/** Higher is better. Aggression rises as opponents get close to going out. */
function scoreCard(card: Card, state: GameState, botId: string, pressure: boolean): number {
  if (state.drawStack.active) {
    // Stack as cheaply as legally possible so the big guns stay in hand.
    return 100 - drawValue(card);
  }
  const base: Partial<Record<Card["type"], number>> = {
    number: 10,
    reverse: 26,
    skip: 30,
    draw2: 34,
    skipall: 36,
    draw4: 44,
    discardall: 48,
    wildroulette: 52,
    wildreversedraw4: 56,
    wilddraw6: 60,
    wilddraw10: 66,
  };
  let score = base[card.type] ?? 10;
  // Hold wilds back until they actually hurt someone.
  if (isWild(card) && !pressure) score -= 30;
  // A 7 or 0 is only worth burning when the bot's hand is big.
  const hand = state.hands[botId] ?? [];
  if (card.type === "number" && card.value === 0) score += hand.length > 6 ? 22 : -4;
  if (card.type === "number" && card.value === 7) score += hand.length > 6 ? 26 : -4;
  return score;
}

function smallestOpponent(state: GameState, botId: string): string | null {
  const rivals = state.players.filter((p) => p.id !== botId && !p.eliminated);
  if (rivals.length === 0) return null;
  return rivals.reduce((best, p) =>
    (state.hands[p.id]?.length ?? 99) < (state.hands[best.id]?.length ?? 99) ? p : best,
  ).id;
}

function biggestOpponent(state: GameState, botId: string): string | null {
  const rivals = state.players.filter((p) => p.id !== botId && !p.eliminated);
  if (rivals.length === 0) return null;
  return rivals.reduce((best, p) =>
    (state.hands[p.id]?.length ?? 0) > (state.hands[best.id]?.length ?? 0) ? p : best,
  ).id;
}

export interface BotMove {
  command: BotCommand;
  /** Rough "thinking" time in ms the driver should wait before applying it. */
  delayMs: number;
}

export function chooseBotMove(
  state: GameState,
  botId: string,
  difficulty: BotDifficulty = "normal",
  rand: () => number = Math.random,
): BotMove | null {
  if (state.status === "finished") return null;
  const me = state.players.find((p) => p.id === botId);
  if (!me || me.eliminated) return null;
  const hand = state.hands[botId] ?? [];
  const skill = DISCIPLINE[difficulty];

  // 1. ONO discipline runs off-turn.
  if (state.uno && !state.uno.called) {
    if (state.uno.playerId === botId && rand() < skill.call) {
      return { command: { type: "CALL_UNO" }, delayMs: 400 + rand() * 500 };
    }
    if (state.uno.playerId !== botId && rand() < skill.catch) {
      return {
        command: { type: "CATCH_UNO", targetId: state.uno.playerId },
        delayMs: 700 + rand() * 900,
      };
    }
  }

  // 2. Pending choices belong to whoever the engine is waiting on.
  const pending = state.pending;
  if (pending) {
    if (pending.playerId !== botId) return null;
    if (pending.kind === "color") {
      return { command: { type: "CHOOSE_COLOR", color: dominantColor(hand) }, delayMs: 600 + rand() * 500 };
    }
    if (pending.kind === "roulette") {
      const color = difficulty === "easy" ? COLORS[Math.floor(rand() * 4)]! : scarcestColor(hand);
      return { command: { type: "CHOOSE_ROULETTE_COLOR", color }, delayMs: 700 + rand() * 600 };
    }
    const target =
      difficulty === "easy"
        ? biggestOpponent(state, botId) ?? smallestOpponent(state, botId)
        : smallestOpponent(state, botId);
    if (!target) return null;
    return { command: { type: "CHOOSE_SWAP_TARGET", targetId: target }, delayMs: 700 + rand() * 600 };
  }

  // 3. Normal turn.
  if (state.currentPlayerId !== botId) return null;
  const playable = playableCardIds(state, botId);
  if (playable.length === 0) return { command: { type: "DRAW_CARD" }, delayMs: 700 + rand() * 700 };

  // A weaker bot sometimes chickens out of a stack and just eats the penalty.
  if (state.drawStack.active && rand() < skill.blunder * 0.5) {
    return { command: { type: "DRAW_CARD" }, delayMs: 900 + rand() * 700 };
  }

  const rivalsClose = state.players.some(
    (p) => p.id !== botId && !p.eliminated && (state.hands[p.id]?.length ?? 9) <= 2,
  );
  const options = hand.filter((c) => playable.includes(c.id));
  let pick: Card;
  if (rand() < skill.blunder) {
    pick = options[Math.floor(rand() * options.length)]!;
  } else {
    pick = options.reduce((best, c) =>
      scoreCard(c, state, botId, rivalsClose) > scoreCard(best, state, botId, rivalsClose) ? c : best,
    );
  }

  const command: BotCommand = { type: "PLAY_CARD", cardId: pick.id };
  if (isWild(pick) && pick.type !== "wildroulette") {
    const rest = hand.filter((c) => c.id !== pick.id);
    command.color = dominantColor(rest.length > 0 ? rest : hand);
  }
  if (pick.type === "number" && pick.value === 7) {
    const target = smallestOpponent(state, botId);
    if (target) command.targetId = target;
  }
  return { command, delayMs: 650 + rand() * 800 };
}

/** Occasional trash talk so the table feels alive. */
const TAUNTS = ["😂", "🔥", "💀", "😈", "🤯"];
export function botReaction(rand: () => number = Math.random): string | null {
  return rand() < 0.18 ? TAUNTS[Math.floor(rand() * TAUNTS.length)]! : null;
}
