import type { Card, CardColor } from "./gameTypes";

const COLORS: Exclude<CardColor, "wild">[] = ["red", "yellow", "green", "blue"];

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}_${Math.random().toString(36).slice(2, 8)}`;
}

/** ONO No Mercy style deck: standard cards plus the brutal extras. */
export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const color of COLORS) {
    deck.push({ id: uid("c"), color, kind: "number", value: 0 });
    for (let v = 1; v <= 9; v++) {
      deck.push({ id: uid("c"), color, kind: "number", value: v });
      deck.push({ id: uid("c"), color, kind: "number", value: v });
    }
    for (let i = 0; i < 2; i++) {
      deck.push({ id: uid("c"), color, kind: "skip" });
      deck.push({ id: uid("c"), color, kind: "reverse" });
      deck.push({ id: uid("c"), color, kind: "draw2" });
    }
    deck.push({ id: uid("c"), color, kind: "skipall" });
    deck.push({ id: uid("c"), color, kind: "discardall" });
  }

  for (let i = 0; i < 4; i++) {
    deck.push({ id: uid("c"), color: "wild", kind: "wild" });
    deck.push({ id: uid("c"), color: "wild", kind: "draw4" });
  }
  for (let i = 0; i < 3; i++) {
    deck.push({ id: uid("c"), color: "wild", kind: "draw6" });
    deck.push({ id: uid("c"), color: "wild", kind: "reversedraw4" });
  }
  for (let i = 0; i < 2; i++) {
    deck.push({ id: uid("c"), color: "wild", kind: "draw10" });
  }

  return deck;
}

export function shuffleDeck<T>(cards: T[]): T[] {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
