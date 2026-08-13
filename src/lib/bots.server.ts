/**
 * Server-side bot driver. Bots never touch the client: the server loads the
 * authoritative state, asks the pure bot brain for one command at a time and
 * pushes each command through the very same engine humans use.
 */
import { applyCommand } from "@/game/engine";
import { botReaction, chooseBotMove, type BotDifficulty } from "@/game/bot";
import type { GameState } from "@/game/gameTypes";
import { currentGame, loadState, logEvents, saveState } from "./game.server";

const MAX_STEPS = 20;
/** Hard wall so a bot-vs-bot chain never outlives the request. */
const MAX_ELAPSED_MS = 11_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface BotRow {
  id: string;
  nickname: string;
  bot_difficulty: BotDifficulty | null;
}

/** Advance the game while it is a bot's move. Safe to call at any time. */
export async function runBots(db: any, roomId: string): Promise<{ steps: number }> {
  const { data: botRows } = await db
    .from("players")
    .select("id, nickname, bot_difficulty")
    .eq("room_id", roomId)
    .eq("is_bot", true)
    .eq("eliminated", false);

  const bots = (botRows ?? []) as BotRow[];
  if (bots.length === 0) return { steps: 0 };

  const game = await currentGame(db, roomId);
  if (!game || game.status !== "playing") return { steps: 0 };

  let state: GameState;
  try {
    ({ state } = await loadState(db, game.id));
  } catch {
    return { steps: 0 };
  }

  const started = Date.now();
  let steps = 0;

  for (let i = 0; i < MAX_STEPS; i++) {
    if (state.status === "finished") break;
    if (Date.now() - started > MAX_ELAPSED_MS) break;

    let acted = false;
    for (const bot of bots) {
      const move = chooseBotMove(state, bot.id, bot.bot_difficulty ?? "normal");
      if (!move) continue;

      await sleep(Math.min(move.delayMs, 1100));

      let result;
      try {
        result = applyCommand(state, {
          ...move.command,
          playerId: bot.id,
          actionId: `bot_${bot.id}_${state.turnCount}_${i}_${Date.now().toString(36)}`,
        } as never);
      } catch {
        continue; // Illegal for any reason: the engine stays authoritative.
      }
      if (result.events.length === 0 && result.state === state) continue;

      state = result.state;
      await saveState(db, game.id, roomId, state);
      await logEvents(db, roomId, game.id, result.events);

      const emote = botReaction();
      if (emote) {
        await logEvents(db, roomId, game.id, [
          { type: "reaction", playerId: bot.id, data: { text: emote, nickname: bot.nickname } },
        ]);
      }
      steps += 1;
      acted = true;
      break;
    }
    if (!acted) break;
  }

  return { steps };
}
