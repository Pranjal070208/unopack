import { createDeck, shuffleDeck } from "./deck";
import type { Card, CardColor, EngineEvent, EnginePlayer, GameState } from "./gameTypes";
import { ELIMINATION_LIMIT, drawAmount, isWildCard } from "./gameTypes";
import { isValidMove } from "./rules";

export const INITIAL_HAND_SIZE = 7;

export interface StepResult {
  state: GameState;
  events: EngineEvent[];
}

function activePlayers(state: GameState): EnginePlayer[] {
  return state.players
    .filter((p) => !p.eliminated && p.finishedRank === null)
    .sort((a, b) => a.seat - b.seat);
}

export function dealCards(players: EnginePlayer[]): GameState {
  let deck = shuffleDeck(createDeck());
  const hands: Record<string, Card[]> = {};
  const ordered = players.slice().sort((a, b) => a.seat - b.seat);
  for (const p of ordered) {
    hands[p.id] = deck.slice(0, INITIAL_HAND_SIZE);
    deck = deck.slice(INITIAL_HAND_SIZE);
  }

  // First non-wild, non-action card starts the discard pile.
  let startIndex = deck.findIndex((c) => c.kind === "number");
  if (startIndex < 0) startIndex = 0;
  const first = deck[startIndex]!;
  deck = deck.filter((_, i) => i !== startIndex);

  return {
    players: ordered,
    hands,
    deck,
    pile: [first],
    discardTop: first,
    activeColor: first.color === "wild" ? "red" : first.color,
    currentPlayerId: ordered[0]?.id ?? null,
    direction: 1,
    pendingDraw: 0,
    turnCount: 0,
    winnerId: null,
    status: "playing",
  };
}

function reshuffleIfNeeded(state: GameState, needed: number): void {
  if (state.deck.length >= needed) return;
  const top = state.pile[state.pile.length - 1];
  const recycled = shuffleDeck(state.pile.slice(0, -1));
  state.pile = top ? [top] : [];
  state.deck = state.deck.concat(recycled);
  if (state.deck.length < needed) {
    // Extreme case: top up with a fresh deck so the game never stalls.
    state.deck = state.deck.concat(shuffleDeck(createDeck()));
  }
}

function takeFromDeck(state: GameState, count: number): Card[] {
  reshuffleIfNeeded(state, count);
  const cards = state.deck.slice(0, count);
  state.deck = state.deck.slice(count);
  return cards;
}

export function calculateNextPlayer(state: GameState, fromId: string, steps = 1): string | null {
  const list = activePlayers(state);
  if (list.length === 0) return null;
  let index = list.findIndex((p) => p.id === fromId);
  if (index < 0) index = 0;
  const next = (index + state.direction * steps) % list.length;
  const wrapped = (next + list.length * Math.abs(steps || 1) + list.length) % list.length;
  return list[wrapped]?.id ?? null;
}

function checkElimination(state: GameState, events: EngineEvent[]): void {
  for (const p of state.players) {
    if (p.eliminated || p.finishedRank !== null) continue;
    if ((state.hands[p.id]?.length ?? 0) >= ELIMINATION_LIMIT) {
      p.eliminated = true;
      events.push({ type: "eliminated", playerId: p.id, data: { cards: state.hands[p.id]?.length } });
    }
  }
}

export function checkWinner(state: GameState, events: EngineEvent[]): void {
  const remaining = activePlayers(state);
  if (state.winnerId) return;
  const emptied = state.players.find(
    (p) => p.finishedRank === null && !p.eliminated && (state.hands[p.id]?.length ?? 0) === 0,
  );
  if (emptied) {
    state.winnerId = emptied.id;
    state.status = "finished";
    events.push({ type: "winner", playerId: emptied.id });
    return;
  }
  if (remaining.length <= 1) {
    state.winnerId = remaining[0]?.id ?? null;
    state.status = "finished";
    events.push({ type: "winner", playerId: state.winnerId });
  }
}

/** Apply the effect of a freshly played card and advance the turn. */
export function applyCardEffect(state: GameState, playerId: string, card: Card): EngineEvent[] {
  const events: EngineEvent[] = [];
  const amount = drawAmount(card);

  if (card.kind === "reverse" || card.kind === "reversedraw4") {
    state.direction = state.direction === 1 ? -1 : 1;
    events.push({ type: "reverse", playerId });
  }

  if (card.kind === "discardall" && state.activeColor) {
    const hand = state.hands[playerId] ?? [];
    const dumped = hand.filter((c) => c.color === state.activeColor);
    state.hands[playerId] = hand.filter((c) => c.color !== state.activeColor);
    state.pile = state.pile.concat(dumped);
    events.push({ type: "discardall", playerId, data: { count: dumped.length } });
  }

  if (amount > 0) {
    state.pendingDraw += amount;
    events.push({ type: "draw_stack", playerId, data: { amount, total: state.pendingDraw } });
  }

  checkWinner(state, events);
  if ((state.status as string) === "finished") return events;

  const list = activePlayers(state);

  if (card.kind === "skipall") {
    events.push({ type: "skipall", playerId });
    state.currentPlayerId = playerId; // everyone else is skipped
  } else if (card.kind === "skip") {
    const skipped = calculateNextPlayer(state, playerId, 1);
    events.push({ type: "skip", playerId: skipped });
    state.currentPlayerId = calculateNextPlayer(state, playerId, 2);
  } else if ((card.kind === "reverse" || card.kind === "reversedraw4") && list.length === 2) {
    state.currentPlayerId = calculateNextPlayer(state, playerId, 2);
  } else {
    state.currentPlayerId = calculateNextPlayer(state, playerId, 1);
  }

  state.turnCount += 1;
  return events;
}

export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  chosenColor?: Exclude<CardColor, "wild">,
): StepResult {
  if (state.status !== "playing") throw new Error("GAME_OVER");
  if (state.currentPlayerId !== playerId) throw new Error("NOT_YOUR_TURN");
  const hand = state.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) throw new Error("CARD_NOT_IN_HAND");
  if (!isValidMove(state, card)) throw new Error("INVALID_MOVE");

  state.hands[playerId] = hand.filter((c) => c.id !== cardId);
  state.pile = state.pile.concat([card]);
  state.discardTop = card;
  state.activeColor = isWildCard(card) ? (chosenColor ?? "red") : (card.color as Exclude<CardColor, "wild">);

  const events: EngineEvent[] = [{ type: "play", playerId, data: { card, color: state.activeColor } }];
  events.push(...applyCardEffect(state, playerId, card));
  return { state, events };
}

/** Draw: either takes the stacked penalty or a single card. */
export function drawCard(state: GameState, playerId: string): StepResult {
  if (state.status !== "playing") throw new Error("GAME_OVER");
  if (state.currentPlayerId !== playerId) throw new Error("NOT_YOUR_TURN");

  const events: EngineEvent[] = [];
  const count = state.pendingDraw > 0 ? state.pendingDraw : 1;
  const cards = takeFromDeck(state, count);
  state.hands[playerId] = (state.hands[playerId] ?? []).concat(cards);
  events.push({ type: "draw", playerId, data: { count, penalty: state.pendingDraw > 0 } });
  state.pendingDraw = 0;

  checkElimination(state, events);
  checkWinner(state, events);
  if ((state.status as string) === "finished") return { state, events };

  if (state.players.find((p) => p.id === playerId)?.eliminated) {
    state.currentPlayerId = calculateNextPlayer(state, playerId, 1);
  } else {
    const drewPlayable = cards.some((c) => isValidMove(state, c));
    // No Mercy: keep drawing is off — one draw then the turn passes.
    state.currentPlayerId = calculateNextPlayer(state, playerId, 1);
    if (drewPlayable) events.push({ type: "draw_playable", playerId });
  }
  state.turnCount += 1;
  return { state, events };
}
