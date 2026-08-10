import { describe, expect, it } from "vitest";
import { createDeck, DECK_SIZE } from "@/game/deck";
import { GAME_CONFIG } from "@/game/config";
import { applyCommand, createGame, nextPlayerId, toPublicState } from "@/game/engine";
import { isPlayableCard } from "@/game/playability";
import type { Card, CardColor, GameState } from "@/game/gameTypes";

function card(id: string, color: Card["color"], type: Card["type"], value?: number): Card {
  return value === undefined ? { id, color, type } : { id, color, type, value };
}

function newGame(count: number, seed = 42) {
  const ids = Array.from({ length: count }, (_, i) => `p${i + 1}`);
  return createGame(ids, seed).state;
}

/** Deterministic table: everyone empty-handed, plain red 5 on top. */
function table(count: number, opts: Partial<GameState> = {}): GameState {
  const state = newGame(count);
  for (const p of state.players) state.hands[p.id] = filler(p.id, 3);
  state.discardTop = card("top_red5", "red", "number", 5);
  state.pile = [state.discardTop];
  state.currentColor = "red";
  state.currentPlayerId = "p1";
  state.direction = 1;
  state.drawStack = { active: false, totalPenalty: 0, lastCardValue: 0, initiatorId: null };
  state.pending = null;
  state.uno = null;
  state.turnCount = 0;
  return { ...state, ...opts };
}

function filler(playerId: string, n: number): Card[] {
  return Array.from({ length: n }, (_, i) => card(`${playerId}_f${i}`, "blue", "number", 9));
}

/* ------------------------------- deck --------------------------------- */

describe("deck", () => {
  const deck = createDeck();

  it("has exactly 168 cards", () => {
    expect(deck).toHaveLength(DECK_SIZE);
    expect(deck).toHaveLength(168);
  });

  it("has unique ids", () => {
    expect(new Set(deck.map((c) => c.id)).size).toBe(168);
  });

  it("has 80 number cards, two of each value per colour", () => {
    const numbers = deck.filter((c) => c.type === "number");
    expect(numbers).toHaveLength(80);
    for (const color of ["red", "yellow", "green", "blue"] as CardColor[]) {
      for (let v = 0; v <= 9; v++) {
        expect(numbers.filter((c) => c.color === color && c.value === v)).toHaveLength(2);
      }
    }
  });

  it("has the official colored action counts", () => {
    const per = (type: string, color: string) => deck.filter((c) => c.type === type && c.color === color).length;
    for (const color of ["red", "yellow", "green", "blue"]) {
      expect(per("draw2", color)).toBe(3);
      expect(per("draw4", color)).toBe(2);
      expect(per("reverse", color)).toBe(3);
      expect(per("skip", color)).toBe(3);
      expect(per("skipall", color)).toBe(2);
      expect(per("discardall", color)).toBe(3);
    }
    expect(deck.filter((c) => c.type === "draw2")).toHaveLength(12);
    expect(deck.filter((c) => c.type === "draw4")).toHaveLength(8);
    expect(deck.filter((c) => c.type === "reverse")).toHaveLength(12);
    expect(deck.filter((c) => c.type === "skip")).toHaveLength(12);
    expect(deck.filter((c) => c.type === "skipall")).toHaveLength(8);
    expect(deck.filter((c) => c.type === "discardall")).toHaveLength(12);
  });

  it("has 24 wilds in the official split", () => {
    expect(deck.filter((c) => c.color === "wild")).toHaveLength(24);
    expect(deck.filter((c) => c.type === "wildreversedraw4")).toHaveLength(8);
    expect(deck.filter((c) => c.type === "wilddraw6")).toHaveLength(4);
    expect(deck.filter((c) => c.type === "wilddraw10")).toHaveLength(4);
    expect(deck.filter((c) => c.type === "wildroulette")).toHaveLength(8);
  });
});

/* ------------------------------- setup -------------------------------- */

describe("setup", () => {
  it("deals 7 cards to each player and keeps the rest", () => {
    const state = newGame(6);
    for (const p of state.players) expect(state.hands[p.id]).toHaveLength(GAME_CONFIG.STARTING_HAND_SIZE);
    const total = state.deck.length + state.pile.length + Object.values(state.hands).flat().length;
    expect(total).toBe(168);
    expect(state.deck.length).toBe(168 - 6 * 7 - 1);
  });

  it("never opens on a wild", () => {
    for (let seed = 0; seed < 25; seed++) {
      const state = newGame(4, seed);
      expect(state.discardTop?.color).not.toBe("wild");
      expect(state.currentColor).not.toBeNull();
    }
  });

  it("has no duplicate card ids in play", () => {
    const state = newGame(4);
    const all = [...state.deck, ...state.pile, ...Object.values(state.hands).flat()];
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
  });

  it("is deterministic for a given seed", () => {
    expect(JSON.stringify(newGame(4, 7).hands)).toBe(JSON.stringify(newGame(4, 7).hands));
  });

  it("rejects fewer than the minimum players", () => {
    expect(() => createGame(["a"])).toThrow();
  });
});

/* ---------------------------- playability ----------------------------- */

describe("playability", () => {
  it("accepts colour, number, symbol and wild matches", () => {
    const state = table(3);
    expect(isPlayableCard(card("a", "red", "number", 2), state, "p1").reason).toBe("MATCHES_COLOR");
    expect(isPlayableCard(card("b", "blue", "number", 5), state, "p1").reason).toBe("MATCHES_NUMBER");
    expect(isPlayableCard(card("c", "green", "number", 3), state, "p1").playable).toBe(false);
    expect(isPlayableCard(card("d", "wild", "wilddraw6"), state, "p1").reason).toBe("WILD");
    state.discardTop = card("t", "red", "skip");
    expect(isPlayableCard(card("e", "green", "skip"), state, "p1").reason).toBe("MATCHES_SYMBOL");
  });

  it("uses the chosen colour, not the physical colour of a wild top card", () => {
    const state = table(3);
    state.discardTop = card("top", "wild", "wilddraw6");
    state.currentColor = "green";
    expect(isPlayableCard(card("g", "green", "number", 1), state, "p1").playable).toBe(true);
    expect(isPlayableCard(card("r", "red", "number", 1), state, "p1").playable).toBe(false);
  });

  it("blocks players who are not on turn", () => {
    const state = table(3);
    expect(isPlayableCard(card("a", "red", "number", 2), state, "p2").reason).toBe("NOT_YOUR_TURN");
  });
});

/* ------------------------------ stacking ------------------------------ */

describe("draw stacking", () => {
  const stackCase = (first: Card, second: Card) => {
    const state = table(3);
    state.hands["p1"] = [first, ...filler("p1", 2)];
    state.hands["p2"] = [second, ...filler("p2", 3)];
    const afterFirst = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: first.id, color: "red" }).state;
    return { afterFirst, verdict: isPlayableCard(second, afterFirst, "p2") };
  };

  it("allows equal or greater stacks", () => {
    const pairs: [Card, Card][] = [
      [card("a", "red", "draw2"), card("b", "blue", "draw2")],
      [card("a", "red", "draw2"), card("b", "blue", "draw4")],
      [card("a", "red", "draw2"), card("b", "wild", "wilddraw6")],
      [card("a", "red", "draw2"), card("b", "wild", "wilddraw10")],
      [card("a", "red", "draw4"), card("b", "wild", "wilddraw6")],
      [card("a", "wild", "wilddraw6"), card("b", "wild", "wilddraw10")],
      [card("a", "wild", "wilddraw10"), card("b", "wild", "wilddraw10")],
    ];
    for (const [x, y] of pairs) expect(stackCase(x, y).verdict.playable).toBe(true);
  });

  it("rejects downward stacks and non-draw cards", () => {
    const pairs: [Card, Card][] = [
      [card("a", "red", "draw4"), card("b", "blue", "draw2")],
      [card("a", "wild", "wilddraw6"), card("b", "blue", "draw4")],
      [card("a", "wild", "wilddraw10"), card("b", "wild", "wilddraw6")],
      [card("a", "red", "draw2"), card("b", "red", "number", 5)],
      [card("a", "red", "draw2"), card("b", "wild", "wildroulette")],
    ];
    for (const [x, y] of pairs) expect(stackCase(x, y).verdict.playable).toBe(false);
  });

  it("accumulates the penalty and dumps it on the player who cannot stack", () => {
    let state = table(5);
    state.hands["p1"] = [card("c1", "red", "draw2"), ...filler("p1", 2)];
    state.hands["p2"] = [card("c2", "blue", "draw4"), ...filler("p2", 2)];
    state.hands["p3"] = [card("c3", "wild", "wilddraw6"), ...filler("p3", 2)];
    state.hands["p4"] = [card("c4", "wild", "wilddraw10"), ...filler("p4", 2)];
    state.hands["p5"] = filler("p5", 3);

    state = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "c1" }).state;
    expect(state.drawStack.totalPenalty).toBe(2);
    state = applyCommand(state, { type: "PLAY_CARD", playerId: "p2", cardId: "c2" }).state;
    expect(state.drawStack.totalPenalty).toBe(6);
    state = applyCommand(state, { type: "PLAY_CARD", playerId: "p3", cardId: "c3", color: "green" }).state;
    expect(state.drawStack.totalPenalty).toBe(12);
    state = applyCommand(state, { type: "PLAY_CARD", playerId: "p4", cardId: "c4", color: "blue" }).state;
    expect(state.drawStack.totalPenalty).toBe(22);
    expect(state.currentPlayerId).toBe("p5");

    const resolved = applyCommand(state, { type: "DRAW_CARD", playerId: "p5" });
    state = resolved.state;
    expect(resolved.events.find((e) => e.type === "DRAW_STACK_RESOLVED")?.data?.["count"]).toBe(22);
    // 3 filler + 22 penalty = 25 -> mercy rule
    expect(state.players.find((p) => p.id === "p5")?.eliminated).toBe(true);
    expect(state.drawStack.active).toBe(false);
  });

  it("keeps the colour chosen on the last wild draw card of a stack", () => {
    let state = table(3);
    state.hands["p1"] = [card("c1", "red", "draw2"), ...filler("p1", 2)];
    state.hands["p2"] = [card("c2", "wild", "wilddraw6"), ...filler("p2", 2)];
    state.hands["p3"] = filler("p3", 2);
    state = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "c1" }).state;
    state = applyCommand(state, { type: "PLAY_CARD", playerId: "p2", cardId: "c2", color: "green" }).state;
    state = applyCommand(state, { type: "DRAW_CARD", playerId: "p3" }).state;
    expect(state.currentColor).toBe("green");
  });
});

/* -------------------------- draw until playable ------------------------ */

describe("draw rule", () => {
  it("keeps drawing until a playable card appears and plays it immediately", () => {
    const state = table(3);
    state.hands["p1"] = [card("x", "green", "number", 1)];
    state.deck = [
      card("d1", "blue", "number", 3),
      card("d2", "yellow", "number", 8),
      card("d3", "red", "skip"),
      card("d4", "blue", "number", 2),
    ];
    const { state: next, events } = applyCommand(state, { type: "DRAW_CARD", playerId: "p1" });
    expect(next.hands["p1"]!.map((c) => c.id)).toEqual(["x", "d1", "d2"]);
    expect(next.discardTop?.id).toBe("d3");
    expect(events.some((e) => e.type === "FORCED_PLAY")).toBe(true);
    // red skip played: p2 skipped, so p3 is next
    expect(next.currentPlayerId).toBe("p3");
  });

  it("rebuilds the draw pile from the discard without the top card", () => {
    const state = table(2);
    state.hands["p1"] = [card("x", "green", "number", 1)];
    state.deck = [];
    state.pile = [card("old1", "blue", "number", 3), card("old2", "yellow", "number", 4), state.discardTop!];
    const next = applyCommand(state, { type: "DRAW_CARD", playerId: "p1" }).state;
    expect(next.pile.some((c) => c.id === "top_red5")).toBe(true);
    expect([...next.deck, ...next.hands["p1"]!].some((c) => c.id === "top_red5")).toBe(false);
  });
});

/* ------------------------------- effects ------------------------------ */

describe("action cards", () => {
  it("skip jumps the next player", () => {
    const state = table(4);
    state.hands["p1"] = [card("s", "red", "skip"), ...filler("p1", 1)];
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "s" }).state;
    expect(next.currentPlayerId).toBe("p3");
  });

  it("skip everyone returns the turn to the same player", () => {
    const state = table(5);
    state.hands["p1"] = [card("sa", "red", "skipall"), ...filler("p1", 1)];
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "sa" }).state;
    expect(next.currentPlayerId).toBe("p1");
  });

  it("reverse flips direction", () => {
    const state = table(4);
    state.hands["p1"] = [card("r", "red", "reverse"), ...filler("p1", 1)];
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "r" }).state;
    expect(next.direction).toBe(-1);
    expect(next.currentPlayerId).toBe("p4");
  });

  it("reverse with two players acts as a skip", () => {
    const state = table(2);
    state.hands["p1"] = [card("r", "red", "reverse"), ...filler("p1", 1)];
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "r" }).state;
    expect(next.currentPlayerId).toBe("p1");
  });

  it("discard all removes only the matching colour", () => {
    const state = table(3);
    state.hands["p1"] = [
      card("da", "red", "discardall"),
      card("h1", "red", "number", 2),
      card("h2", "red", "number", 8),
      card("h3", "red", "skip"),
      card("h4", "blue", "number", 4),
      card("h5", "green", "number", 7),
      card("h6", "yellow", "draw2"),
    ];
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "da" }).state;
    expect(next.hands["p1"]!.map((c) => c.id).sort()).toEqual(["h4", "h5", "h6"]);
    expect(next.discardTop?.id).toBe("da");
    expect(next.stats.cardsDiscardedByEffect).toBe(3);
  });
});

/* ------------------------------- 7 and 0 ------------------------------- */

describe("seven swap", () => {
  it("pauses for a target and swaps hands atomically", () => {
    const state = table(3);
    state.hands["p1"] = [card("seven", "red", "number", 7), ...filler("p1", 4)];
    state.hands["p2"] = filler("p2", 12);
    const played = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "seven" }).state;
    expect(played.phase).toBe("CHOOSING_SWAP_TARGET");
    expect(played.currentPlayerId).toBe("p1");
    const swapped = applyCommand(played, { type: "CHOOSE_SWAP_TARGET", playerId: "p1", targetId: "p2" }).state;
    expect(swapped.hands["p1"]).toHaveLength(12);
    expect(swapped.hands["p2"]).toHaveLength(4);
    expect(swapped.currentPlayerId).toBe("p2");
  });

  it("cannot target itself or an eliminated player", () => {
    const state = table(3);
    state.hands["p1"] = [card("seven", "red", "number", 7), ...filler("p1", 2)];
    state.players.find((p) => p.id === "p3")!.eliminated = true;
    const played = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "seven" }).state;
    expect(() => applyCommand(played, { type: "CHOOSE_SWAP_TARGET", playerId: "p1", targetId: "p1" })).toThrow();
    expect(() => applyCommand(played, { type: "CHOOSE_SWAP_TARGET", playerId: "p1", targetId: "p3" })).toThrow();
  });

  it("applies the mercy rule after the swap", () => {
    const state = table(3);
    state.hands["p1"] = [card("seven", "red", "number", 7), ...filler("p1", 2)];
    state.hands["p2"] = filler("p2", 25);
    state.hands["p3"] = filler("p3", 4);
    const played = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "seven" }).state;
    const swapped = applyCommand(played, { type: "CHOOSE_SWAP_TARGET", playerId: "p1", targetId: "p2" }).state;
    expect(swapped.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(swapped.players.find((p) => p.id === "p2")?.eliminated).toBe(false);
  });
});

describe("zero rotation", () => {
  it("passes every hand one seat along in the direction of play", () => {
    const state = table(4);
    state.hands["p1"] = [card("zero", "red", "number", 0), card("a1", "blue", "number", 1)];
    state.hands["p2"] = filler("p2", 2);
    state.hands["p3"] = filler("p3", 3);
    state.hands["p4"] = filler("p4", 4);
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "zero" }).state;
    expect(next.hands["p2"]).toHaveLength(1); // p1's remaining hand
    expect(next.hands["p3"]).toHaveLength(2);
    expect(next.hands["p4"]).toHaveLength(3);
    expect(next.hands["p1"]).toHaveLength(4);
  });

  it("rotates the other way when direction is reversed", () => {
    const state = table(4);
    state.direction = -1;
    state.hands["p1"] = [card("zero", "red", "number", 0), card("a1", "blue", "number", 1)];
    state.hands["p2"] = filler("p2", 2);
    state.hands["p3"] = filler("p3", 3);
    state.hands["p4"] = filler("p4", 4);
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "zero" }).state;
    expect(next.hands["p4"]).toHaveLength(1);
    expect(next.hands["p1"]).toHaveLength(2);
  });

  it("checks the mercy rule only after every hand has moved", () => {
    const state = table(3);
    state.hands["p1"] = [card("zero", "red", "number", 0), ...filler("p1", 25)];
    state.hands["p2"] = filler("p2", 3);
    state.hands["p3"] = filler("p3", 3);
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "zero" }).state;
    expect(next.players.find((p) => p.id === "p2")?.eliminated).toBe(true);
    expect(next.players.find((p) => p.id === "p1")?.eliminated).toBe(false);
  });
});

/* --------------------------- wild behaviours --------------------------- */

describe("wild reverse draw four", () => {
  it("reverses and penalises the next player in the new direction", () => {
    let state = table(4);
    state.hands["p1"] = [card("w", "wild", "wildreversedraw4"), ...filler("p1", 1)];
    state.hands["p4"] = filler("p4", 2);
    state = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "w", color: "green" }).state;
    expect(state.direction).toBe(-1);
    expect(state.currentPlayerId).toBe("p4");
    expect(state.drawStack.totalPenalty).toBe(4);
    expect(state.currentColor).toBe("green");
  });

  it("returns the penalty to the player in a two player game", () => {
    let state = table(2);
    state.hands["p1"] = [card("w", "wild", "wildreversedraw4"), card("keep", "blue", "number", 1)];
    state.hands["p2"] = filler("p2", 3);
    state = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "w", color: "green" }).state;
    expect(state.currentPlayerId).toBe("p1");
    expect(state.drawStack.totalPenalty).toBe(4);
    // p1 may still stack if able, otherwise takes the four
    state = applyCommand(state, { type: "DRAW_CARD", playerId: "p1" }).state;
    expect(state.hands["p1"]).toHaveLength(5);
  });

  it("asks for a colour when none was supplied", () => {
    const state = table(3);
    state.hands["p1"] = [card("w", "wild", "wilddraw6"), ...filler("p1", 1)];
    const played = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "w" }).state;
    expect(played.phase).toBe("CHOOSING_COLOR");
    expect(played.currentPlayerId).toBe("p1");
    const chosen = applyCommand(played, { type: "CHOOSE_COLOR", playerId: "p1", color: "yellow" }).state;
    expect(chosen.currentColor).toBe("yellow");
    expect(chosen.drawStack.totalPenalty).toBe(6);
    expect(chosen.currentPlayerId).toBe("p2");
  });
});

describe("wild color roulette", () => {
  it("reveals until the chosen colour, ignoring wilds, and skips the victim", () => {
    const state = table(3);
    state.hands["p1"] = [card("wr", "wild", "wildroulette"), ...filler("p1", 1)];
    state.hands["p2"] = filler("p2", 1);
    state.deck = [
      card("r1", "wild", "wilddraw6"),
      card("r2", "blue", "number", 4),
      card("r3", "green", "reverse"),
      card("r4", "wild", "wilddraw10"),
      card("r5", "yellow", "number", 7),
      card("r6", "red", "number", 3),
      card("r7", "blue", "number", 1),
    ];
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "wr", color: "red" }).state;
    expect(next.hands["p2"]).toHaveLength(1 + 6);
    expect(next.hands["p2"]!.some((c) => c.id === "r6")).toBe(true);
    expect(next.pile.some((c) => c.id === "r6")).toBe(false);
    expect(next.currentPlayerId).toBe("p3");
    expect(next.currentColor).toBe("red");
  });

  it("cannot be used to stack on a draw penalty", () => {
    let state = table(3);
    state.hands["p1"] = [card("d", "red", "draw2"), ...filler("p1", 2)];
    state.hands["p2"] = [card("wr", "wild", "wildroulette"), ...filler("p2", 2)];
    state = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "d" }).state;
    expect(isPlayableCard(state.hands["p2"]![0]!, state, "p2").playable).toBe(false);
  });

  it("eliminates the victim when the reveal pushes them to 25", () => {
    const state = table(3);
    state.hands["p1"] = [card("wr", "wild", "wildroulette"), ...filler("p1", 1)];
    state.hands["p2"] = filler("p2", 22);
    state.deck = [
      card("k1", "blue", "number", 1),
      card("k2", "blue", "number", 2),
      card("k3", "red", "number", 3),
      card("k4", "blue", "number", 4),
    ];
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "wr", color: "red" }).state;
    expect(next.players.find((p) => p.id === "p2")?.eliminated).toBe(true);
  });
});

/* ----------------------------- mercy rule ------------------------------ */

describe("mercy rule", () => {
  const drawTo = (target: number) => {
    const state = table(3);
    state.hands["p1"] = [card("x", "green", "number", 1), ...filler("p1", target - 2)];
    state.hands["p2"] = filler("p2", 2);
    state.deck = [card("n1", "blue", "number", 3)];
    state.pile = [state.discardTop!];
    return applyCommand(state, { type: "DRAW_CARD", playerId: "p1" }).state;
  };

  it("keeps a player with 24 cards alive", () => {
    const next = drawTo(24);
    expect(next.hands["p1"]!.length).toBe(24);
    expect(next.players.find((p) => p.id === "p1")?.eliminated).toBe(false);
  });

  it("eliminates at 25 and above", () => {
    for (const target of [25, 26]) {
      const next = drawTo(target);
      expect(next.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
      expect(next.players.find((p) => p.id === "p1")?.eliminationCause).toBe("MERCY_RULE");
    }
  });
});

/* ------------------------------ winning -------------------------------- */

describe("winning", () => {
  it("wins immediately on an empty hand", () => {
    const state = table(3);
    state.hands["p1"] = [card("last", "red", "number", 3)];
    state.hands["p2"] = filler("p2", 4);
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "last" }).state;
    expect(next.winnerId).toBe("p1");
    expect(next.status).toBe("finished");
    expect(next.phase).toBe("GAME_OVER");
  });

  it("wins as the last player standing", () => {
    const state = table(3);
    state.players.find((p) => p.id === "p3")!.eliminated = true;
    state.hands["p2"] = filler("p2", 3);
    state.hands["p1"] = [card("zero", "red", "number", 0), ...filler("p1", 25)];
    const next = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "zero" }).state;
    // p2 receives 25 cards from p1 -> eliminated, leaving p1 alone
    expect(next.status).toBe("finished");
    expect(next.winnerId).toBe("p1");
  });
});

/* -------------------------------- uno ---------------------------------- */

describe("uno", () => {
  const setup = () => {
    const state = table(3);
    state.hands["p1"] = [card("a", "red", "number", 3), card("b", "blue", "number", 9)];
    state.hands["p2"] = filler("p2", 3);
    return applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "a" }).state;
  };

  it("opens a window when a player reaches one card", () => {
    const state = setup();
    expect(state.uno?.playerId).toBe("p1");
    expect(state.uno?.called).toBe(false);
  });

  it("records a successful call", () => {
    const called = applyCommand(setup(), { type: "CALL_UNO", playerId: "p1" }).state;
    expect(called.uno?.called).toBe(true);
    expect(called.stats.unoCalls).toBe(1);
  });

  it("penalises a caught player and rejects catching after the call", () => {
    const state = setup();
    const caught = applyCommand(state, { type: "CATCH_UNO", playerId: "p2", targetId: "p1" }).state;
    expect(caught.hands["p1"]).toHaveLength(1 + GAME_CONFIG.UNO_PENALTY_CARDS);
    const called = applyCommand(state, { type: "CALL_UNO", playerId: "p1" }).state;
    expect(() => applyCommand(called, { type: "CATCH_UNO", playerId: "p2", targetId: "p1" })).toThrow();
  });
});

/* ------------------------ commands and integrity ----------------------- */

describe("command validation", () => {
  it("rejects moves from the wrong player and illegal cards", () => {
    const state = table(3);
    state.hands["p1"] = [card("ok", "red", "number", 1), ...filler("p1", 1)];
    state.hands["p2"] = [card("bad", "green", "number", 2)];
    expect(() => applyCommand(state, { type: "PLAY_CARD", playerId: "p2", cardId: "bad" })).toThrow("NOT_YOUR_TURN");
    expect(() => applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "bad" })).toThrow("CARD_NOT_IN_HAND");
    state.hands["p1"] = [card("green3", "green", "number", 3), ...filler("p1", 1)];
    expect(() => applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "green3" })).toThrow("ILLEGAL_MOVE");
  });

  it("ignores duplicate actions with the same id", () => {
    const state = table(3);
    state.hands["p1"] = [card("c1", "red", "number", 1), card("c2", "red", "number", 2)];
    state.hands["p2"] = filler("p2", 2);
    const first = applyCommand(state, { type: "PLAY_CARD", playerId: "p1", cardId: "c1", actionId: "act-1" });
    const repeat = applyCommand(first.state, { type: "PLAY_CARD", playerId: "p1", cardId: "c1", actionId: "act-1" });
    expect(repeat.events).toHaveLength(0);
    expect(repeat.state.hands["p1"]).toHaveLength(1);
  });

  it("never leaks hands through the public projection", () => {
    const pub = toPublicState(newGame(4));
    expect(JSON.stringify(pub)).not.toContain('"hands"');
    expect(pub.cardCounts["p1"]).toBe(7);
  });

  it("skips eliminated players in the turn order", () => {
    const state = table(4);
    state.players.find((p) => p.id === "p2")!.eliminated = true;
    expect(nextPlayerId(state, "p1", 1)).toBe("p3");
  });
});
