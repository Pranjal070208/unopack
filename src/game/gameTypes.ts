export type CardColor = "red" | "yellow" | "green" | "blue" | "wild";

export type CardKind =
  | "number"
  | "skip"
  | "reverse"
  | "draw2"
  | "skipall"
  | "discardall"
  | "wild"
  | "draw4"
  | "draw6"
  | "draw10"
  | "reversedraw4";

export interface Card {
  id: string;
  color: CardColor;
  kind: CardKind;
  value?: number;
}

export interface EnginePlayer {
  id: string;
  seat: number;
  eliminated: boolean;
  finishedRank: number | null;
}

export interface GameState {
  players: EnginePlayer[];
  hands: Record<string, Card[]>;
  deck: Card[];
  pile: Card[];
  discardTop: Card | null;
  activeColor: Exclude<CardColor, "wild"> | null;
  currentPlayerId: string | null;
  direction: 1 | -1;
  pendingDraw: number;
  turnCount: number;
  winnerId: string | null;
  status: "playing" | "finished";
}

export interface EngineEvent {
  type: string;
  playerId?: string | null;
  data?: Record<string, unknown>;
}

export const ELIMINATION_LIMIT = 25;
export const TURN_SECONDS = 35;

export const CARD_LABEL: Record<CardKind, string> = {
  number: "",
  skip: "SKIP",
  reverse: "REV",
  draw2: "+2",
  skipall: "SKIP ALL",
  discardall: "DISCARD ALL",
  wild: "WILD",
  draw4: "+4",
  draw6: "+6",
  draw10: "+10",
  reversedraw4: "REV +4",
};

export function drawAmount(card: Card): number {
  switch (card.kind) {
    case "draw2":
      return 2;
    case "draw4":
    case "reversedraw4":
      return 4;
    case "draw6":
      return 6;
    case "draw10":
      return 10;
    default:
      return 0;
  }
}

export function isWildCard(card: Card): boolean {
  return card.color === "wild";
}
