import { COLORS, type Card, type CardColor } from "./cardTypes";
import { shuffle as shuffleWith, type Rng } from "./rng";

/**
 * Official UNO Show 'Em No Mercy deck — exactly 168 cards.
 *
 * Per colour: 2x each number 0-9 (20), 3x Draw Two, 2x Draw Four, 3x Reverse,
 * 3x Skip, 2x Skip Everyone, 3x Discard All  => 36 per colour, 144 total.
 * Wilds: 8x Wild Reverse Draw Four, 4x Wild Draw Six, 4x Wild Draw Ten,
 * 8x Wild Color Roulette => 24. 144 + 24 = 168.
 */
export const DECK_SIZE = 168;

export const COLORED_COUNTS = {
  numberEach: 2,
  draw2: 3,
  draw4: 2,
  reverse: 3,
  skip: 3,
  skipall: 2,
  discardall: 3,
} as const;

export const WILD_COUNTS = {
  wildreversedraw4: 8,
  wilddraw6: 4,
  wilddraw10: 4,
  wildroulette: 8,
} as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const color of COLORS as CardColor[]) {
    for (let value = 0; value <= 9; value++) {
      for (let copy = 1; copy <= COLORED_COUNTS.numberEach; copy++) {
        deck.push({ id: `${color}_${value}_${pad(copy)}`, color, type: "number", value });
      }
    }
    const actions = [
      ["draw2", COLORED_COUNTS.draw2],
      ["draw4", COLORED_COUNTS.draw4],
      ["reverse", COLORED_COUNTS.reverse],
      ["skip", COLORED_COUNTS.skip],
      ["skipall", COLORED_COUNTS.skipall],
      ["discardall", COLORED_COUNTS.discardall],
    ] as const;
    for (const [type, count] of actions) {
      for (let copy = 1; copy <= count; copy++) {
        deck.push({ id: `${color}_${type}_${pad(copy)}`, color, type });
      }
    }
  }

  for (const [type, count] of Object.entries(WILD_COUNTS)) {
    for (let copy = 1; copy <= count; copy++) {
      deck.push({ id: `wild_${type}_${pad(copy)}`, color: "wild", type: type as Card["type"] });
    }
  }

  return deck;
}

export function shuffleDeck(cards: Card[], rng: Rng): Card[] {
  return shuffleWith(cards, rng);
}
