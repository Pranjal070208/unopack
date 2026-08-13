# Rules Audit + Bots (1–3, per-bot difficulty)

## Short answer on the draw question

Draw penalties **add up, they never multiply**. Verified in the engine: each stacked card adds its own face value to a running total (`+2` then `+4` then `+10` = 16), and the player who gives in draws exactly that total once. Your current hand size has no effect on it. This is the correct No Mercy behaviour, and I'll add explicit tests so it can't regress.

## Rules audit — what's already correct

Confirmed by reading the engine, deck and playability code:

- 168-card deck with the official per-colour and wild distribution.
- Stacking is "equal or greater" and only with draw cards; totals accumulate.
- Giving in to a stack draws the whole total and forfeits the turn.
- Draw-until-playable, then the drawn card must be played.
- Mercy Rule: 25+ cards = immediate elimination, checked after every hand-size change.
- 7 = mandatory swap with a chosen player, 0 = everyone rotates hands in play direction.
- Discard All dumps every card of the active colour.
- Wild Color Roulette: the victim names the colour, reveals until it appears, keeps all revealed cards, loses the turn.
- Opening card skips action cards until a number is flipped.
- Deck reshuffles from the discard pile (top card kept) when it runs dry.

## Rules audit — bugs to fix

1. **Wild Reverse Draw 4 in a 2-player game.** The "reverse acts like a skip when only two players are live" shortcut is applied to this card too, so the player who just laid the +4 gets the turn back and has to answer their own penalty. Fix: when a draw stack is live, a reverse never returns the turn to the player who played it.
2. **ONO window only opens for the card-player.** If a 7-swap or a 0-rotation leaves *another* player holding exactly one card, no ONO window opens for them and they can never be caught. Fix: open/close the window for whoever ends up at one card after every hand change, not just the player who played.
3. **ONO window not re-evaluated after penalties.** Drawing a stack or a catch penalty can push the called player above one card; the stale window should close.
4. **Turn-timeout colour auto-pick** re-uses the colour already on the table, which for a wild can be `null` and silently falls back to red. Fix: pick the player's most-held colour.
5. **Elimination mid-turn.** When the player currently to move is eliminated by the Mercy Rule during their own draw, turn advancement is computed from an eliminated seat. It works today but is unguarded — I'll pin it with tests and make the seat walk explicit.
6. **Last card played onto a live stack.** Today, emptying your hand ends the hand immediately and voids the pending penalty. I'll keep that (hand ends when someone goes out) and document/test it so it's deliberate rather than accidental.
7. **Score Mode check.** Verify hand scoring actually adds the 250 knockout bonus per player you eliminated, on top of card points (numbers face value, actions 20, wilds 50), and that 1000 ends the match.

Each fix ships with a test in the existing engine suite (currently 50 tests), plus new tests for multi-card stack totals, 3+ player elimination ordering, and reverse/skip behaviour at 2 players.

## Bots

- Host can add **1–3 bots** in the lobby, each with its own difficulty: **Easy / Normal / Hard**. Bots get their own avatar, a name like "Rex (bot)", and a BOT badge on their seat.
- Host can remove a bot; bots can't be added once the game starts or when the room is full.
- Bots play through the exact same authoritative command path as humans — no shortcuts, no hidden-card peeking. Their brain only sees what a player in that seat would see.

Difficulty behaviour:

- **Easy** — plays a random legal card, gives in to stacks more often than it should, picks a random colour, forgets to call ONO, never catches.
- **Normal** — prefers keeping wilds, stacks when it can, picks its most-held colour, swaps 7 with the smallest hand, calls ONO most of the time, sometimes catches.
- **Hard** — always plays optimally among legal moves (dump big-value/penalty cards, weaponise 7 against the leader, target the roulette colour it holds least), always calls ONO, always catches a missed call.

Bots also drop occasional emotes on big moments (a +10 landing, an elimination, someone hitting one card, losing).

## Technical notes

- **Database:** add `is_bot`, `bot_difficulty`, `bot_persona` to `players`; bot rows have no session or secret. Grants and RLS follow the existing pattern (bot columns readable, writes server-only).
- **Server functions:** `addBot` / `removeBot` (host-only, lobby-only, cap 3, respects `max_players`) in `src/lib/game.functions.ts`.
- **Bot brain:** new pure module `src/game/bot.ts` exporting `chooseBotMove(state, botId, difficulty)` returning a normal `Command` (play / draw / colour / swap target / roulette colour / call ONO / catch). Pure and unit-testable, no I/O.
- **Bot driver:** new `src/lib/bots.server.ts` with `runBotTurns(db, roomId)` that loops while the seat to move — or the seat owning a pending choice — is a bot, applying one command per iteration through `applyCommand`, saving state and logging events, with a per-move think delay and a hard iteration cap. Called after `startGame`, after every human `sendCommand`, and after `enforceTimeout`. A lightweight `botTick` server function is polled by the room (already polling for turn timeouts) so bots still move if no human acts.
- **Client:** lobby gets an "Add bot" control with a difficulty picker and per-bot remove; `TableSeats`/`PlayerAvatar` get a bot badge; `useRoom` exposes the new player fields. No change to the animation pipeline — bot moves emit the same events as human moves, so all existing animations, announcements and sounds work unchanged.
