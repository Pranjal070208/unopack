import type { Card, CardColor } from "./cardTypes";

export type { Card, CardColor, CardPaint, CardType } from "./cardTypes";
export { CARD_LABEL, CARD_NAME, cardFace, describeCard, drawValue, isDrawCard, isWild } from "./cardTypes";

export type GamePhase =
  | "DEALING"
  | "PLAYER_TURN"
  | "CHOOSING_COLOR"
  | "CHOOSING_SWAP_TARGET"
  | "RESOLVING_DRAW_STACK"
  | "DRAWING_UNTIL_PLAYABLE"
  | "RESOLVING_COLOR_ROULETTE"
  | "ELIMINATION"
  | "GAME_OVER";

export type EliminationReason = "MERCY_RULE";

export interface EnginePlayer {
  id: string;
  seat: number;
  eliminated: boolean;
  finishedRank: number | null;
  eliminationCause: EliminationReason | null;
  eliminatedAt: number | null;
  causedByPlayerId: string | null;
  cardsAtElimination: number | null;
}

export interface DrawStack {
  active: boolean;
  totalPenalty: number;
  lastCardValue: number;
  initiatorId: string | null;
}

export interface PendingChoice {
  /** `roulette` is chosen by the *victim*, not by the player who played the card. */
  kind: "color" | "swap" | "roulette";
  playerId: string;
  cardId: string;
  /** Set when the pending card came from a forced draw-until-playable play. */
  fromDraw?: boolean;
  /** For roulette: the player whose turn produced the effect. */
  sourcePlayerId?: string;
}

export interface UnoState {
  playerId: string;
  called: boolean;
  deadline: number;
  /** Turn index when the window opened; the catch closes once the next turn ends. */
  turn: number;
}

export interface GameStats {
  cardsPlayed: number;
  cardsDrawn: number;
  cardsDrawnFromStacks: number;
  largestDrawPenalty: number;
  successfulStacks: number;
  failedStacks: number;
  sevenSwaps: number;
  zeroRotations: number;
  discardAllUses: number;
  cardsDiscardedByEffect: number;
  colorRoulettes: number;
  playersEliminated: number;
  unoCalls: number;
  unoCatches: number;
}

export interface GameState {
  players: EnginePlayer[];
  hands: Record<string, Card[]>;
  deck: Card[];
  pile: Card[];
  discardTop: Card | null;
  currentColor: CardColor | null;
  currentPlayerId: string | null;
  direction: 1 | -1;
  drawStack: DrawStack;
  pending: PendingChoice | null;
  uno: UnoState | null;
  phase: GamePhase;
  turnCount: number;
  winnerId: string | null;
  status: "playing" | "finished";
  seed: number;
  rngCounter: number;
  stats: GameStats;
  processedActions: string[];
  startedAt: number;
  endedAt: number | null;
}

export type GameEventType =
  | "GAME_STARTED"
  | "CARD_DEALT"
  | "CARD_PLAYED"
  | "CARD_DRAWN"
  | "DRAW_UNTIL_PLAYABLE"
  | "FORCED_PLAY"
  | "DRAW_STACK_STARTED"
  | "DRAW_STACK_EXTENDED"
  | "DRAW_STACK_UPDATED"
  | "DRAW_STACK_RESOLVED"
  | "COLOR_SELECTED"
  | "HAND_SWAPPED"
  | "HANDS_ROTATED"
  | "HANDS_PASSED"
  | "DISCARD_ALL_RESOLVED"
  | "ROULETTE_STARTED"
  | "ROULETTE_CARD_REVEALED"
  | "ROULETTE_COMPLETED"
  | "COLOR_ROULETTE_RESOLVED"
  | "PLAYER_SKIPPED"
  | "EVERYONE_SKIPPED"
  | "DIRECTION_REVERSED"
  | "DECK_RESHUFFLED"
  | "PLAYER_ELIMINATED"
  | "UNO_REQUIRED"
  | "UNO_CALLED"
  | "UNO_CAUGHT"
  | "TURN_TIMEOUT"
  | "PLAYER_WON"
  | "GAME_ENDED";

export interface GameEvent {
  type: GameEventType;
  playerId?: string | null;
  data?: Record<string, unknown>;
}

export type Command =
  | { type: "PLAY_CARD"; playerId: string; cardId: string; color?: CardColor; targetId?: string; actionId?: string }
  | { type: "DRAW_CARD"; playerId: string; actionId?: string }
  | { type: "CHOOSE_COLOR"; playerId: string; color: CardColor; actionId?: string }
  | { type: "CHOOSE_ROULETTE_COLOR"; playerId: string; color: CardColor; actionId?: string }
  | { type: "CHOOSE_SWAP_TARGET"; playerId: string; targetId: string; actionId?: string }
  | { type: "CALL_UNO"; playerId: string; actionId?: string }
  | { type: "CATCH_UNO"; playerId: string; targetId: string; actionId?: string }
  | { type: "TIMEOUT"; playerId: string; actionId?: string };

export interface CommandResult {
  state: GameState;
  events: GameEvent[];
}

/** Redacted view safe to broadcast to every client. */
export interface PublicGameState {
  phase: GamePhase;
  currentPlayerId: string | null;
  currentColor: CardColor | null;
  direction: 1 | -1;
  discardTop: Card | null;
  drawStack: DrawStack;
  pending: PendingChoice | null;
  uno: UnoState | null;
  deckCount: number;
  pileCount: number;
  cardCounts: Record<string, number>;
  turnCount: number;
  winnerId: string | null;
  status: "playing" | "finished";
  stats: GameStats;
}
