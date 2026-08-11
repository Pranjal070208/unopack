import { GAME_CONFIG } from "./config";
import { createDeck, shuffleDeck } from "./deck";
import { drawValue, isDrawCard, isWild, type Card, type CardColor } from "./cardTypes";
import { isPlayableCard, matchesTable } from "./playability";
import type {
  Command,
  CommandResult,
  EnginePlayer,
  GameEvent,
  GameState,
  GameStats,
  PublicGameState,
} from "./gameTypes";
import { makeSeed, type Rng } from "./rng";

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

function emptyStats(): GameStats {
  return {
    cardsPlayed: 0,
    cardsDrawn: 0,
    cardsDrawnFromStacks: 0,
    largestDrawPenalty: 0,
    successfulStacks: 0,
    failedStacks: 0,
    sevenSwaps: 0,
    zeroRotations: 0,
    discardAllUses: 0,
    cardsDiscardedByEffect: 0,
    colorRoulettes: 0,
    playersEliminated: 0,
    unoCalls: 0,
    unoCatches: 0,
  };
}

function rngOf(state: GameState): Rng {
  return { seed: state.seed, counter: state.rngCounter };
}

function commitRng(state: GameState, rng: Rng): void {
  state.rngCounter = rng.counter;
}

export function activePlayers(state: GameState): EnginePlayer[] {
  return state.players.filter((p) => !p.eliminated && p.finishedRank === null).sort((a, b) => a.seat - b.seat);
}

/** Step `steps` live players away from `fromId`, honouring the current direction. */
export function nextPlayerId(state: GameState, fromId: string | null, steps = 1): string | null {
  const seated = state.players.slice().sort((a, b) => a.seat - b.seat);
  const live = seated.filter((p) => !p.eliminated && p.finishedRank === null);
  if (live.length === 0) return null;
  if (live.length === 1) return live[0]!.id;

  let index = seated.findIndex((p) => p.id === fromId);
  if (index < 0) index = 0;

  let found = 0;
  let cursor = index;
  for (let guard = 0; guard < seated.length * (steps + 2); guard++) {
    cursor = (cursor + state.direction + seated.length) % seated.length;
    const candidate = seated[cursor]!;
    if (candidate.eliminated || candidate.finishedRank !== null) continue;
    found += 1;
    if (found === steps) return candidate.id;
  }
  return live[0]!.id;
}

function reshuffleIfNeeded(state: GameState, needed: number, events: GameEvent[]): void {
  if (state.deck.length >= needed) return;
  const top = state.discardTop;
  const recyclable = state.pile.filter((c) => !top || c.id !== top.id);
  if (recyclable.length === 0) return;
  const rng = rngOf(state);
  state.deck = state.deck.concat(shuffleDeck(recyclable, rng));
  commitRng(state, rng);
  state.pile = top ? [top] : [];
  events.push({ type: "DECK_RESHUFFLED", data: { deckCount: state.deck.length } });
}

function takeFromDeck(state: GameState, count: number, events: GameEvent[]): Card[] {
  const taken: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) reshuffleIfNeeded(state, 1, events);
    const card = state.deck.shift();
    if (!card) break; // genuinely no cards anywhere
    taken.push(card);
  }
  return taken;
}

function giveCards(state: GameState, playerId: string, cards: Card[]): void {
  state.hands[playerId] = (state.hands[playerId] ?? []).concat(cards);
}

/* -------------------------------------------------------------------------- */
/* mercy rule, elimination, winning                                            */
/* -------------------------------------------------------------------------- */

export function eliminatePlayer(
  state: GameState,
  playerId: string,
  reason: "MERCY_RULE",
  events: GameEvent[],
  causedByPlayerId?: string | null,
): void {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return;
  const hand = state.hands[playerId] ?? [];
  player.eliminated = true;
  player.eliminationCause = reason;
  player.eliminatedAt = state.turnCount;
  player.causedByPlayerId = causedByPlayerId ?? null;
  player.cardsAtElimination = hand.length;
  state.pile = state.pile.concat(hand);
  state.hands[playerId] = [];
  state.stats.playersEliminated += 1;
  if (state.uno?.playerId === playerId) state.uno = null;
  events.push({
    type: "PLAYER_ELIMINATED",
    playerId,
    data: { reason, cards: player.cardsAtElimination, causedByPlayerId: causedByPlayerId ?? null },
  });
}

/** Must run after every operation that changes any hand size. */
export function checkMercyRule(state: GameState, events: GameEvent[], causedByPlayerId?: string | null): void {
  for (const p of activePlayers(state)) {
    if ((state.hands[p.id]?.length ?? 0) >= GAME_CONFIG.MERCY_LIMIT) {
      eliminatePlayer(state, p.id, "MERCY_RULE", events, causedByPlayerId);
    }
  }
}

export function checkWinConditions(state: GameState, events: GameEvent[]): boolean {
  if (state.status === "finished") return true;
  const live = activePlayers(state);

  const emptied = live.find((p) => (state.hands[p.id]?.length ?? 0) === 0);
  if (emptied) {
    finish(state, emptied.id, "EMPTY_HAND", events);
    return true;
  }
  if (live.length <= 1) {
    finish(state, live[0]?.id ?? null, "LAST_PLAYER_STANDING", events);
    return true;
  }
  return false;
}

function finish(state: GameState, winnerId: string | null, reason: string, events: GameEvent[]): void {
  state.winnerId = winnerId;
  state.status = "finished";
  state.phase = "GAME_OVER";
  state.currentPlayerId = null;
  state.pending = null;
  state.uno = null;
  state.endedAt = Date.now();
  let rank = 1;
  const winner = state.players.find((p) => p.id === winnerId);
  if (winner) winner.finishedRank = rank++;
  for (const p of state.players.filter((x) => x.id !== winnerId && !x.eliminated)) p.finishedRank = rank++;
  if (winnerId) events.push({ type: "PLAYER_WON", playerId: winnerId, data: { reason } });
  events.push({ type: "GAME_ENDED", data: { winnerId, reason } });
}

/* -------------------------------------------------------------------------- */
/* setup                                                                       */
/* -------------------------------------------------------------------------- */

export function createGame(playerIds: string[], seed: number = makeSeed()): CommandResult {
  if (playerIds.length < GAME_CONFIG.MIN_PLAYERS) throw new Error("NEED_MORE_PLAYERS");
  if (playerIds.length > GAME_CONFIG.MAX_PLAYERS) throw new Error("TOO_MANY_PLAYERS");

  const state: GameState = {
    players: playerIds.map((id, seat) => ({
      id,
      seat,
      eliminated: false,
      finishedRank: null,
      eliminationCause: null,
      eliminatedAt: null,
      causedByPlayerId: null,
      cardsAtElimination: null,
    })),
    hands: {},
    deck: [],
    pile: [],
    discardTop: null,
    currentColor: null,
    currentPlayerId: playerIds[0] ?? null,
    direction: 1,
    drawStack: { active: false, totalPenalty: 0, lastCardValue: 0, initiatorId: null },
    pending: null,
    uno: null,
    phase: "DEALING",
    turnCount: 0,
    winnerId: null,
    status: "playing",
    seed,
    rngCounter: 0,
    stats: emptyStats(),
    processedActions: [],
    startedAt: Date.now(),
    endedAt: null,
  };

  const rng = rngOf(state);
  state.deck = shuffleDeck(createDeck(), rng);
  commitRng(state, rng);

  const events: GameEvent[] = [{ type: "GAME_STARTED", data: { seed, players: playerIds } }];

  for (const p of state.players) {
    state.hands[p.id] = state.deck.splice(0, GAME_CONFIG.STARTING_HAND_SIZE);
    events.push({ type: "CARD_DEALT", playerId: p.id, data: { count: GAME_CONFIG.STARTING_HAND_SIZE } });
  }

  initializeDiscardPile(state, events);
  state.phase = "PLAYER_TURN";
  return { state, events };
}

/**
 * Flip the opening card. Per the official sheet, if the revealed card is an
 * Action card it is ignored and the next card is flipped, so play always opens
 * on a plain number card.
 */
export function initializeDiscardPile(state: GameState, events: GameEvent[]): void {
  let first: Card | undefined;
  const buried: Card[] = [];
  for (let guard = 0; guard < GAME_CONFIG.MAX_REVEAL_ITERATIONS; guard++) {
    const candidate = takeFromDeck(state, 1, events)[0];
    if (!candidate) break;
    if (candidate.type !== "number") {
      buried.push(candidate);
      continue;
    }
    first = candidate;
    break;
  }
  // Ignored action cards go back into the draw pile.
  if (buried.length) {
    const rng = rngOf(state);
    state.deck = shuffleDeck(state.deck.concat(buried), rng);
    commitRng(state, rng);
  }
  if (!first) return;

  state.pile = [first];
  state.discardTop = first;
  state.currentColor = first.color as CardColor;
}

/* -------------------------------------------------------------------------- */
/* effects                                                                     */
/* -------------------------------------------------------------------------- */

function rotateHands(state: GameState, events: GameEvent[]): void {
  const live = activePlayers(state);
  if (live.length < 2) return;
  const snapshot: Record<string, Card[]> = {};
  for (const p of live) snapshot[p.id] = state.hands[p.id] ?? [];
  const ordered = state.direction === 1 ? live : live.slice().reverse();
  const mapping: Record<string, string> = {};
  for (let i = 0; i < ordered.length; i++) {
    const from = ordered[i]!;
    const to = ordered[(i + 1) % ordered.length]!;
    mapping[from.id] = to.id;
  }
  // Assign simultaneously from the snapshot.
  for (const from of ordered) state.hands[mapping[from.id]!] = snapshot[from.id]!;
  state.stats.zeroRotations += 1;
  events.push({
    type: "HANDS_ROTATED",
    data: {
      direction: state.direction,
      mapping,
      counts: Object.fromEntries(ordered.map((p) => [p.id, state.hands[p.id]?.length ?? 0])),
    },
  });
}

function swapHands(state: GameState, aId: string, bId: string, events: GameEvent[]): void {
  const a = state.hands[aId] ?? [];
  const b = state.hands[bId] ?? [];
  state.hands[aId] = b;
  state.hands[bId] = a;
  state.stats.sevenSwaps += 1;
  events.push({
    type: "HAND_SWAPPED",
    playerId: aId,
    data: { targetId: bId, counts: { [aId]: b.length, [bId]: a.length } },
  });
}

function resolveColorRoulette(state: GameState, victimId: string, color: CardColor, events: GameEvent[]): void {
  const revealed: Card[] = [];
  let matched = false;
  for (let guard = 0; guard < GAME_CONFIG.MAX_REVEAL_ITERATIONS; guard++) {
    if (state.deck.length === 0) reshuffleIfNeeded(state, 1, events);
    const card = state.deck.shift();
    if (!card) break;
    revealed.push(card);
    // Wild cards never satisfy the chosen colour.
    const hit = !isWild(card) && card.color === color;
    events.push({ type: "ROULETTE_CARD_REVEALED", playerId: victimId, data: { card, color, hit } });
    if (hit) {
      matched = true;
      break;
    }
  }
  giveCards(state, victimId, revealed);
  state.stats.colorRoulettes += 1;
  state.stats.cardsDrawn += revealed.length;
  const data = { color, revealed, count: revealed.length, matched };
  events.push({ type: "COLOR_ROULETTE_RESOLVED", playerId: victimId, data });
  events.push({ type: "ROULETTE_COMPLETED", playerId: victimId, data });
}

/* -------------------------------------------------------------------------- */
/* play resolution (effect queue)                                              */
/* -------------------------------------------------------------------------- */

type Stage = "start" | "afterColor" | "afterSwap";

interface PlayCtx {
  playerId: string;
  card: Card;
  color?: CardColor | undefined;
  targetId?: string | undefined;
  fromDraw?: boolean | undefined;
}

function resolvePlay(state: GameState, ctx: PlayCtx, stage: Stage, events: GameEvent[]): void {
  const { playerId, card } = ctx;

  if (stage === "start") {
    if (isWild(card)) {
      if (!ctx.color) {
        state.pending = { kind: "color", playerId, cardId: card.id, ...(ctx.fromDraw ? { fromDraw: true } : {}) };
        state.phase = "CHOOSING_COLOR";
        return;
      }
      state.currentColor = ctx.color;
      events.push({ type: "COLOR_SELECTED", playerId, data: { color: ctx.color, cardId: card.id } });
    } else {
      state.currentColor = card.color as CardColor;
    }
    stage = "afterColor";
  }

  if (stage === "afterColor") {
    // Direction changes.
    if (card.type === "reverse" || card.type === "wildreversedraw4") {
      state.direction = state.direction === 1 ? -1 : 1;
      events.push({ type: "DIRECTION_REVERSED", playerId, data: { direction: state.direction } });
    }

    // Draw stacking.
    if (isDrawCard(card)) {
      const amount = drawValue(card);
      const extending = state.drawStack.active;
      state.drawStack = {
        active: true,
        totalPenalty: state.drawStack.totalPenalty + amount,
        lastCardValue: amount,
        initiatorId: state.drawStack.initiatorId ?? playerId,
      };
      if (extending) state.stats.successfulStacks += 1;
      state.stats.largestDrawPenalty = Math.max(state.stats.largestDrawPenalty, state.drawStack.totalPenalty);
      events.push({
        type: extending ? "DRAW_STACK_EXTENDED" : "DRAW_STACK_STARTED",
        playerId,
        data: { amount, total: state.drawStack.totalPenalty },
      });
    }

    // Discard All: dump every card matching the played colour.
    if (card.type === "discardall") {
      const color = state.currentColor;
      const hand = state.hands[playerId] ?? [];
      const dumped = hand.filter((c) => c.color === color);
      state.hands[playerId] = hand.filter((c) => c.color !== color);
      state.pile = state.pile.concat(dumped);
      state.stats.discardAllUses += 1;
      state.stats.cardsDiscardedByEffect += dumped.length;
      events.push({
        type: "DISCARD_ALL_RESOLVED",
        playerId,
        data: { color, count: dumped.length, cards: dumped },
      });
    }

    // 7 — mandatory hand swap.
    if (card.type === "number" && card.value === 7 && GAME_CONFIG.ALLOW_SEVEN_SWAP) {
      const candidates = activePlayers(state).filter((p) => p.id !== playerId);
      if (candidates.length > 0) {
        if (!ctx.targetId) {
          state.pending = { kind: "swap", playerId, cardId: card.id, ...(ctx.fromDraw ? { fromDraw: true } : {}) };
          state.phase = "CHOOSING_SWAP_TARGET";
          return;
        }
        swapHands(state, playerId, ctx.targetId, events);
      }
    }

    // 0 — everyone passes their hand along.
    if (card.type === "number" && card.value === 0 && GAME_CONFIG.ALLOW_ZERO_ROTATION) {
      rotateHands(state, events);
    }

    stage = "afterSwap";
  }

  finishPlay(state, ctx, events);
}

function finishPlay(state: GameState, ctx: PlayCtx, events: GameEvent[]): void {
  const { playerId, card } = ctx;
  state.pending = null;

  checkMercyRule(state, events, playerId);
  if (checkWinConditions(state, events)) return;

  // UNO window opens for the player who just played down to one card.
  const myCount = state.hands[playerId]?.length ?? 0;
  if (myCount === GAME_CONFIG.UNO_REQUIRED_AT) {
    state.uno = {
      playerId,
      called: false,
      deadline: Date.now() + GAME_CONFIG.UNO_WINDOW_MS,
      turn: state.turnCount,
    };
    events.push({ type: "UNO_REQUIRED", playerId });
  } else if (state.uno?.playerId === playerId) {
    state.uno = null;
  }

  advanceTurn(state, ctx, events);
  state.turnCount += 1;
  state.stats.cardsPlayed += 1;
  if (state.status !== "finished" && !state.pending) state.phase = "PLAYER_TURN";
  expireUnoWindow(state);
  void card;
}

/** The catch window closes once the following player's turn has been played. */
function expireUnoWindow(state: GameState): void {
  if (state.uno && !state.uno.called && state.turnCount > state.uno.turn + 1) {
    state.uno = null;
  }
}

function advanceTurn(state: GameState, ctx: PlayCtx, events: GameEvent[]): void {
  const { playerId, card } = ctx;
  const live = activePlayers(state);
  const headsUp = live.length === 2;

  if (card.type === "skipall") {
    events.push({ type: "EVERYONE_SKIPPED", playerId });
    state.currentPlayerId = live.some((p) => p.id === playerId) ? playerId : nextPlayerId(state, playerId, 1);
    return;
  }

  if (card.type === "skip") {
    const skipped = nextPlayerId(state, playerId, 1);
    events.push({ type: "PLAYER_SKIPPED", playerId: skipped });
    state.currentPlayerId = nextPlayerId(state, playerId, 2);
    return;
  }

  if (card.type === "wildroulette") {
    const victim = nextPlayerId(state, playerId, 1);
    if (victim) {
      // The VICTIM names the colour; they then draw until it appears and lose the turn.
      state.phase = "RESOLVING_COLOR_ROULETTE";
      state.pending = { kind: "roulette", playerId: victim, cardId: card.id, sourcePlayerId: playerId };
      events.push({ type: "ROULETTE_STARTED", playerId: victim, data: { sourcePlayerId: playerId } });
      return;
    }
  }


  // Reverse with two live players behaves like a Skip: the player goes again.
  if ((card.type === "reverse" || card.type === "wildreversedraw4") && headsUp) {
    state.currentPlayerId = nextPlayerId(state, playerId, 2);
    return;
  }

  state.currentPlayerId = nextPlayerId(state, playerId, 1);
}

/* -------------------------------------------------------------------------- */
/* commands                                                                    */
/* -------------------------------------------------------------------------- */

function requireTurn(state: GameState, playerId: string): void {
  if (state.status === "finished") throw new Error("GAME_OVER");
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error("PLAYER_NOT_IN_GAME");
  if (player.eliminated) throw new Error("ELIMINATED");
  if (state.currentPlayerId !== playerId) throw new Error("NOT_YOUR_TURN");
}

function playCard(state: GameState, cmd: Extract<Command, { type: "PLAY_CARD" }>, events: GameEvent[]): void {
  requireTurn(state, cmd.playerId);
  if (state.pending) throw new Error("AWAITING_CHOICE");
  const hand = state.hands[cmd.playerId] ?? [];
  const card = hand.find((c) => c.id === cmd.cardId);
  if (!card) throw new Error("CARD_NOT_IN_HAND");
  const verdict = isPlayableCard(card, state, cmd.playerId);
  if (!verdict.playable) throw new Error("ILLEGAL_MOVE");

  state.hands[cmd.playerId] = hand.filter((c) => c.id !== cmd.cardId);
  state.pile = state.pile.concat([card]);
  state.discardTop = card;
  events.push({
    type: "CARD_PLAYED",
    playerId: cmd.playerId,
    data: { card, reason: verdict.reason },
  });

  resolvePlay(
    state,
    { playerId: cmd.playerId, card, color: cmd.color, targetId: cmd.targetId },
    "start",
    events,
  );
}

function drawCommand(state: GameState, playerId: string, events: GameEvent[]): void {
  requireTurn(state, playerId);
  if (state.pending) throw new Error("AWAITING_CHOICE");

  // 1) An active draw stack must be swallowed whole.
  if (state.drawStack.active) {
    const penalty = state.drawStack.totalPenalty;
    state.phase = "RESOLVING_DRAW_STACK";
    const cards = takeFromDeck(state, penalty, events);
    giveCards(state, playerId, cards);
    state.stats.cardsDrawn += cards.length;
    state.stats.cardsDrawnFromStacks += cards.length;
    state.stats.failedStacks += 1;
    events.push({
      type: "DRAW_STACK_RESOLVED",
      playerId,
      data: { count: cards.length, penalty, initiatorId: state.drawStack.initiatorId },
    });
    const initiator = state.drawStack.initiatorId;
    state.drawStack = { active: false, totalPenalty: 0, lastCardValue: 0, initiatorId: null };
    checkMercyRule(state, events, initiator);
    if (checkWinConditions(state, events)) return;
    state.currentPlayerId = nextPlayerId(state, playerId, 1);
    state.turnCount += 1;
    state.phase = "PLAYER_TURN";
    return;
  }

  // 2) No Mercy draw rule: keep drawing until a playable card appears, then play it.
  state.phase = "DRAWING_UNTIL_PLAYABLE";
  const drawn: Card[] = [];
  let playable: Card | null = null;
  for (let guard = 0; guard < GAME_CONFIG.MAX_REVEAL_ITERATIONS; guard++) {
    const [card] = takeFromDeck(state, 1, events);
    if (!card) break;
    drawn.push(card);
    giveCards(state, playerId, [card]);
    state.stats.cardsDrawn += 1;
    events.push({ type: "CARD_DRAWN", playerId, data: { card, count: 1 } });
    if ((state.hands[playerId]?.length ?? 0) >= GAME_CONFIG.MERCY_LIMIT) break;
    if (matchesTable(card, state).playable) {
      playable = card;
      break;
    }
  }
  events.push({ type: "DRAW_UNTIL_PLAYABLE", playerId, data: { count: drawn.length, found: !!playable } });

  checkMercyRule(state, events, null);
  if (checkWinConditions(state, events)) return;

  const stillIn = state.players.find((p) => p.id === playerId && !p.eliminated);
  if (playable && stillIn) {
    // The drawn playable card must be played immediately.
    state.hands[playerId] = (state.hands[playerId] ?? []).filter((c) => c.id !== playable!.id);
    state.pile = state.pile.concat([playable]);
    state.discardTop = playable;
    events.push({ type: "FORCED_PLAY", playerId, data: { card: playable } });
    events.push({ type: "CARD_PLAYED", playerId, data: { card: playable, forced: true } });
    resolvePlay(state, { playerId, card: playable, fromDraw: true }, "start", events);
    return;
  }

  state.currentPlayerId = nextPlayerId(state, playerId, 1);
  state.turnCount += 1;
  state.phase = "PLAYER_TURN";
}

function chooseColor(state: GameState, playerId: string, color: CardColor, events: GameEvent[]): void {
  const pending = state.pending;
  if (!pending || pending.kind !== "color") throw new Error("NO_COLOR_PENDING");
  if (pending.playerId !== playerId) throw new Error("NOT_YOUR_CHOICE");
  const card = state.discardTop;
  if (!card || card.id !== pending.cardId) throw new Error("STATE_DESYNC");
  state.currentColor = color;
  state.pending = null;
  events.push({ type: "COLOR_SELECTED", playerId, data: { color, cardId: card.id } });
  resolvePlay(state, { playerId, card, color, fromDraw: pending.fromDraw }, "afterColor", events);
}

function chooseSwapTarget(state: GameState, playerId: string, targetId: string, events: GameEvent[]): void {
  const pending = state.pending;
  if (!pending || pending.kind !== "swap") throw new Error("NO_SWAP_PENDING");
  if (pending.playerId !== playerId) throw new Error("NOT_YOUR_CHOICE");
  if (targetId === playerId) throw new Error("CANNOT_TARGET_SELF");
  const target = activePlayers(state).find((p) => p.id === targetId);
  if (!target) throw new Error("INVALID_TARGET");
  const card = state.discardTop;
  if (!card || card.id !== pending.cardId) throw new Error("STATE_DESYNC");

  state.pending = null;
  swapHands(state, playerId, targetId, events);
  resolvePlay(
    state,
    { playerId, card, color: state.currentColor ?? undefined, targetId, fromDraw: pending.fromDraw },
    "afterSwap",
    events,
  );
}

/**
 * Wild Color Roulette: the VICTIM (next player) names a colour, then reveals
 * cards until that colour appears, keeps every revealed card and loses the turn.
 */
function chooseRouletteColor(state: GameState, playerId: string, color: CardColor, events: GameEvent[]): void {
  const pending = state.pending;
  if (!pending || pending.kind !== "roulette") throw new Error("NO_ROULETTE_PENDING");
  if (pending.playerId !== playerId) throw new Error("NOT_YOUR_CHOICE");
  const source = pending.sourcePlayerId ?? state.currentPlayerId ?? playerId;

  state.pending = null;
  resolveColorRoulette(state, playerId, color, events);
  checkMercyRule(state, events, source);
  if (checkWinConditions(state, events)) return;

  events.push({ type: "PLAYER_SKIPPED", playerId });
  state.currentPlayerId = nextPlayerId(state, source, 2);
  state.turnCount += 1;
  state.phase = "PLAYER_TURN";
  expireUnoWindow(state);
}


function callUno(state: GameState, playerId: string, events: GameEvent[]): void {
  const uno = state.uno;
  if (!uno || uno.playerId !== playerId) throw new Error("NO_UNO_PENDING");
  if ((state.hands[playerId]?.length ?? 0) !== GAME_CONFIG.UNO_REQUIRED_AT) throw new Error("NO_UNO_PENDING");
  uno.called = true;
  state.stats.unoCalls += 1;
  events.push({ type: "UNO_CALLED", playerId });
}

function catchUno(state: GameState, playerId: string, targetId: string, events: GameEvent[]): void {
  const uno = state.uno;
  if (!uno || uno.playerId !== targetId) throw new Error("NOTHING_TO_CATCH");
  if (uno.called) throw new Error("ALREADY_CALLED");
  if (playerId === targetId) throw new Error("CANNOT_CATCH_SELF");
  // The window closes on time OR once the following player has finished a turn.
  if (Date.now() > uno.deadline || state.turnCount > uno.turn + 1) throw new Error("WINDOW_CLOSED");
  const catcher = state.players.find((p) => p.id === playerId && !p.eliminated);
  if (!catcher) throw new Error("NOT_IN_GAME");

  const cards = takeFromDeck(state, GAME_CONFIG.UNO_PENALTY_CARDS, events);
  giveCards(state, targetId, cards);
  state.stats.cardsDrawn += cards.length;
  state.stats.unoCatches += 1;
  state.uno = null;
  events.push({ type: "UNO_CAUGHT", playerId, data: { targetId, penalty: cards.length } });
  checkMercyRule(state, events, playerId);
  checkWinConditions(state, events);
}

function timeout(state: GameState, events: GameEvent[]): void {
  const current = state.currentPlayerId;
  if (!current || state.status === "finished") throw new Error("NOTHING_TO_ENFORCE");
  events.push({ type: "TURN_TIMEOUT", playerId: current });
  if (state.pending) {
    // Auto-resolve a stalled choice so the table never locks up.
    if (state.pending.kind === "roulette") {
      chooseRouletteColor(state, state.pending.playerId, state.currentColor ?? "red", events);
    } else if (state.pending.kind === "color") {
      chooseColor(state, current, state.currentColor ?? "red", events);
    } else {
      const target = activePlayers(state).find((p) => p.id !== current);
      if (target) chooseSwapTarget(state, current, target.id, events);
      else {
        state.pending = null;
        state.phase = "PLAYER_TURN";
      }
    }
    return;
  }
  drawCommand(state, current, events);
}

/** The single entry point for every mutation. Never trust the client. */
export function applyCommand(state: GameState, command: Command): CommandResult {
  const next: GameState = structuredClone(state);
  const events: GameEvent[] = [];

  if (command.actionId) {
    if (next.processedActions.includes(command.actionId)) return { state, events: [] };
    next.processedActions = next.processedActions.concat(command.actionId).slice(-60);
  }

  switch (command.type) {
    case "PLAY_CARD":
      playCard(next, command, events);
      break;
    case "DRAW_CARD":
      drawCommand(next, command.playerId, events);
      break;
    case "CHOOSE_COLOR":
      chooseColor(next, command.playerId, command.color, events);
      break;
    case "CHOOSE_ROULETTE_COLOR":
      chooseRouletteColor(next, command.playerId, command.color, events);
      break;
    case "CHOOSE_SWAP_TARGET":
      chooseSwapTarget(next, command.playerId, command.targetId, events);
      break;
    case "CALL_UNO":
      callUno(next, command.playerId, events);
      break;
    case "CATCH_UNO":
      catchUno(next, command.playerId, command.targetId, events);
      break;
    case "TIMEOUT":
      timeout(next, events);
      break;
    default:
      throw new Error("UNKNOWN_COMMAND");
  }

  return { state: next, events };
}

/* -------------------------------------------------------------------------- */
/* projections                                                                 */
/* -------------------------------------------------------------------------- */

export function toPublicState(state: GameState): PublicGameState {
  return {
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    currentColor: state.currentColor,
    direction: state.direction,
    discardTop: state.discardTop,
    drawStack: state.drawStack,
    pending: state.pending,
    uno: state.uno,
    deckCount: state.deck.length,
    pileCount: state.pile.length,
    cardCounts: Object.fromEntries(state.players.map((p) => [p.id, state.hands[p.id]?.length ?? 0])),
    turnCount: state.turnCount,
    winnerId: state.winnerId,
    status: state.status,
    stats: state.stats,
  };
}
