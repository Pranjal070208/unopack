/** Card model for the complete UNO Show 'Em No Mercy 168-card deck. */

export type CardColor = "red" | "yellow" | "green" | "blue";
export type CardPaint = CardColor | "wild";

export type CardType =
  | "number"
  | "skip"
  | "reverse"
  | "draw2"
  | "draw4"
  | "skipall"
  | "discardall"
  | "wildreversedraw4"
  | "wilddraw6"
  | "wilddraw10"
  | "wildroulette";

export interface Card {
  id: string;
  color: CardPaint;
  type: CardType;
  value?: number;
}

export const COLORS: CardColor[] = ["red", "yellow", "green", "blue"];

export const CARD_LABEL: Record<CardType, string> = {
  number: "",
  skip: "SKIP",
  reverse: "REV",
  draw2: "+2",
  draw4: "+4",
  skipall: "SKIP ALL",
  discardall: "DISCARD ALL",
  wildreversedraw4: "REV +4",
  wilddraw6: "+6",
  wilddraw10: "+10",
  wildroulette: "ROULETTE",
};

export const CARD_NAME: Record<CardType, string> = {
  number: "Number",
  skip: "Skip",
  reverse: "Reverse",
  draw2: "Draw Two",
  draw4: "Draw Four",
  skipall: "Skip Everyone",
  discardall: "Discard All",
  wildreversedraw4: "Wild Reverse Draw Four",
  wilddraw6: "Wild Draw Six",
  wilddraw10: "Wild Draw Ten",
  wildroulette: "Wild Color Roulette",
};

/** Penalty value of a draw card, 0 when the card is not a draw card. */
export function drawValue(card: Card): number {
  switch (card.type) {
    case "draw2":
      return 2;
    case "draw4":
    case "wildreversedraw4":
      return 4;
    case "wilddraw6":
      return 6;
    case "wilddraw10":
      return 10;
    default:
      return 0;
  }
}

/** Cards that may participate in the official draw stack. Roulette may not. */
export function isDrawCard(card: Card): boolean {
  return drawValue(card) > 0;
}

export function isWild(card: Card): boolean {
  return card.color === "wild";
}

/** Wild cards whose controller picks the colour that resumes play. */
export function needsColorChoice(card: Card): boolean {
  return isWild(card);
}

export function cardFace(card: Card): string {
  return card.type === "number" ? String(card.value ?? 0) : CARD_LABEL[card.type];
}

export function describeCard(card: Card): string {
  const color = card.color === "wild" ? "Wild" : card.color.toUpperCase();
  return card.type === "number" ? `${color} ${card.value}` : `${color} ${CARD_NAME[card.type]}`;
}
