import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerHand } from "./PlayerHand";
import { TableSeats } from "./TableSeats";
import { CenterTable } from "./CenterTable";
import { EventFeed } from "./EventFeed";
import { GAME_CONFIG } from "@/game/config";
import { drawValue } from "@/game/cardTypes";
import { tableSizeFor, type TableSize } from "@/game/seats";
import type { Card, CardColor } from "@/game/gameTypes";
import type { FeedItem } from "@/hooks/useGameEventAnimations";
import type { GameRow, PlayerRow } from "@/hooks/useRoom";
import { playSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";

const TURN_SECONDS: number = GAME_CONFIG.TURN_SECONDS;
const MERCY = GAME_CONFIG.MERCY_LIMIT;

const COLOR_CHOICES: { color: Exclude<CardColor, "wild">; label: string; css: string }[] = [
  { color: "red", label: "Red", css: "var(--ono-red)" },
  { color: "yellow", label: "Yellow", css: "var(--ono-yellow)" },
  { color: "green", label: "Green", css: "var(--ono-green)" },
  { color: "blue", label: "Blue", css: "var(--ono-blue)" },
];

interface Props {
  game: GameRow;
  players: PlayerRow[];
  me: PlayerRow | null;
  hand: Card[];
  playable: string[];
  reactions: Record<string, string>;
  feed: FeedItem[];
  onPlay: (cardId: string, color?: Exclude<CardColor, "wild">) => void;
  onDraw: () => void;
  onTimeout: () => void;
  onChooseColor: (color: Exclude<CardColor, "wild">) => void;
  onChooseRouletteColor: (color: Exclude<CardColor, "wild">) => void;
  onChooseSwapTarget: (targetId: string) => void;
  onCallUno: () => void;
  onCatchUno: (targetId: string) => void;
  header: React.ReactNode;
  footer: React.ReactNode;
}

function useTableSize(): TableSize {
  const [size, setSize] = useState<TableSize>("desktop");
  useEffect(() => {
    const update = () => setSize(tableSizeFor(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

export function GameTable({
  game,
  players,
  me,
  hand,
  playable,
  reactions,
  feed,
  onPlay,
  onDraw,
  onTimeout,
  onChooseColor,
  onChooseRouletteColor,
  onChooseSwapTarget,
  onCallUno,
  onCatchUno,
  header,
  footer,
}: Props) {
  const [remaining, setRemaining] = useState(TURN_SECONDS);
  const size = useTableSize();
  const compact = size !== "desktop";

  const myTurn = !!me && game.current_player_id === me.id;
  const opponents = players.filter((p) => p.id !== me?.id);
  const current = players.find((p) => p.id === game.current_player_id);
  const phase = game.phase ?? "PLAYER_TURN";
  const uno = game.public_state?.uno ?? null;
  const pending = game.public_state?.pending ?? null;
  const mustPickColor = myTurn && phase === "CHOOSING_COLOR";
  // Roulette is answered by the VICTIM, who is not the current player.
  const mustPickRoulette = !!me && pending?.kind === "roulette" && pending.playerId === me.id;
  const rouletteVictim = pending?.kind === "roulette" ? players.find((p) => p.id === pending.playerId) : undefined;
  const mustPickTarget = myTurn && phase === "CHOOSING_SWAP_TARGET";
  const canCallUno = !!me && uno?.playerId === me.id && !uno.called;
  const catchTarget = uno && !uno.called && uno.playerId !== me?.id ? uno.playerId : null;
  const deckCount = game.public_state?.deckCount;

  // Can the local player legally continue the stack right now?
  const canStack = useMemo(() => {
    if (game.pending_draw <= 0) return false;
    return hand.some((c) => playable.includes(c.id) && drawValue(c) > 0);
  }, [game.pending_draw, hand, playable]);

  useEffect(() => {
    const tick = () => {
      const started = new Date(game.turn_started_at).getTime();
      const left = Math.max(0, TURN_SECONDS - Math.floor((Date.now() - started) / 1000));
      setRemaining(left);
      if (left === 0) onTimeout();
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [game.turn_started_at, game.turn_count, onTimeout]);

  // Turn hand-off cue for the local player.
  useEffect(() => {
    if (myTurn) playSound("turn");
  }, [myTurn, game.turn_count]);

  const urgent = remaining <= 10;
  const mercyWarning = (me?.card_count ?? hand.length) >= MERCY - 1;

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">{header}</div>

      {/* HUD */}
      <div className="mt-1 flex items-center justify-center gap-2 px-3 font-display text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>{players.filter((p) => !p.eliminated).length} alive</span>
        <span aria-hidden>·</span>
        <span style={{ color: `var(--ono-${game.active_color ?? "red"})` }}>
          {(game.active_color ?? "—").toUpperCase()}
        </span>
        {game.pending_draw > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span className="text-[var(--ono-red)]">STACK +{game.pending_draw}</span>
          </>
        ) : null}
      </div>

      {/* Mobile opponent strip */}
      {size === "mobile" ? (
        <div className="mt-2">
          <TableSeats
            players={players}
            meId={me?.id ?? null}
            currentPlayerId={game.current_player_id}
            reactions={reactions}
            size={size}
            unoPlayerId={uno?.playerId ?? null}
          />
        </div>
      ) : null}

      {/* Table */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-4">
        {size !== "mobile" ? (
          <TableSeats
            players={players}
            meId={me?.id ?? null}
            currentPlayerId={game.current_player_id}
            reactions={reactions}
            size={size}
            unoPlayerId={uno?.playerId ?? null}
          />
        ) : null}

        <EventFeed items={feed} className="absolute left-3 top-2 z-20 hidden sm:flex" />

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="text-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={game.current_player_id ?? "none"}
                initial={{ y: -14, opacity: 0, scale: myTurn ? 1.4 : 1 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 10, opacity: 0 }}
                className="font-display text-sm uppercase tracking-[0.3em]"
                style={{ color: myTurn ? "var(--ono-yellow)" : "var(--muted-foreground)" }}
              >
                {myTurn ? "Your turn" : `${current?.nickname ?? "…"}'s turn`}
              </motion.p>
            </AnimatePresence>
            <div className="mx-auto mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
              <motion.div
                animate={{ width: `${(remaining / TURN_SECONDS) * 100}%` }}
                transition={{ ease: "linear", duration: 1 }}
                className="h-full"
                style={{ background: urgent ? "var(--ono-red)" : "var(--ono-green)" }}
              />
            </div>
            <p
              className={cn(
                "mt-1 font-display text-xs tabular-nums",
                urgent ? "animate-pulse text-[var(--ono-red)]" : "text-muted-foreground",
              )}
            >
              {remaining}s
            </p>
          </div>

          <CenterTable
            top={game.discard_top}
            activeColor={game.active_color}
            direction={game.direction}
            pending={game.pending_draw}
            canStack={canStack}
            myTurn={myTurn}
            deckCount={deckCount}
            onDraw={onDraw}
            compact={compact}
          />
        </div>
      </div>

      {/* My hand */}
      <motion.div animate={{ opacity: myTurn ? 1 : 0.88 }} className="pb-2">
        <div className="mb-1 flex items-center justify-center gap-2 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>{me?.nickname ?? "You"}</span>
          <span className={cn(hand.length >= MERCY - 5 && "text-[var(--ono-red)]")}>· {hand.length} cards</span>
          {mercyWarning ? (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.9, repeat: Infinity }}
              className="text-[var(--ono-red)]"
            >
              · one card from mercy
            </motion.span>
          ) : null}
        </div>
        <PlayerHand
          hand={hand}
          playable={playable}
          myTurn={myTurn}
          touch={size === "mobile"}
          onPlay={onPlay}
          hint={
            myTurn
              ? game.pending_draw > 0 && !canStack
                ? `NO STACK — TAKE ${game.pending_draw}`
                : playable.length === 0
                  ? "NO MOVES — DRAW A CARD"
                  : null
              : null
          }
        />
      </motion.div>

      {/* UNO shout / catch */}
      {canCallUno || catchTarget ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center">
          <motion.button
            type="button"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: [1, 1.07, 1], opacity: 1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.9, repeat: Infinity }}
            onClick={() => {
              playSound("uno");
              if (canCallUno) onCallUno();
              else if (catchTarget) onCatchUno(catchTarget);
            }}
            className="pointer-events-auto min-h-11 rounded-full border-[3px] border-white/80 px-7 py-3 font-display text-lg uppercase tracking-[0.2em] text-white"
            style={{
              background: canCallUno ? "var(--ono-yellow)" : "var(--ono-red)",
              boxShadow: "var(--glow-yellow)",
            }}
          >
            {canCallUno
              ? "Call ONO!"
              : `Catch ${players.find((p) => p.id === catchTarget)?.nickname ?? "them"}!`}
          </motion.button>
        </div>
      ) : null}

      {mustPickColor ? (
        <Overlay title="Choose color">
          <div className="grid grid-cols-2 gap-3">
            {COLOR_CHOICES.map((c) => (
              <motion.button
                key={c.color}
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  playSound("select");
                  onChooseColor(c.color);
                }}
                className="h-20 min-h-11 rounded-2xl border-[3px] border-white/80 font-display text-sm uppercase tracking-widest text-white"
                style={{ background: c.css, boxShadow: "var(--shadow-card)" }}
              >
                {c.label}
              </motion.button>
            ))}
          </div>
        </Overlay>
      ) : null}

      {mustPickRoulette ? (
        <Overlay title="Color roulette — pick your poison">
          <p className="text-center font-display text-[10px] uppercase tracking-widest text-muted-foreground">
            You draw until this color shows up, then lose your turn.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {COLOR_CHOICES.map((c) => (
              <motion.button
                key={c.color}
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  playSound("roulette");
                  onChooseRouletteColor(c.color);
                }}
                className="h-20 min-h-11 rounded-2xl border-[3px] border-white/80 font-display text-sm uppercase tracking-widest text-white"
                style={{ background: c.css, boxShadow: "var(--shadow-card)" }}
              >
                {c.label}
              </motion.button>
            ))}
          </div>
        </Overlay>
      ) : pending?.kind === "roulette" ? (
        <Overlay title="Color roulette">
          <p className="text-center font-display text-sm uppercase tracking-widest text-[var(--ono-yellow)]">
            {rouletteVictim?.nickname ?? "Someone"} is picking a color…
          </p>
        </Overlay>
      ) : null}

      {mustPickTarget ? (
        <Overlay title="Choose a player">
          <div className="hide-scrollbar flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {opponents
              .filter((p) => !p.eliminated)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    playSound("swap");
                    onChooseSwapTarget(p.id);
                  }}
                  className="panel flex min-h-11 items-center justify-between px-4 py-3 font-display text-sm uppercase tracking-widest"
                >
                  <span>{p.nickname}</span>
                  <span className="text-[var(--ono-yellow)]">{p.card_count} cards</span>
                </button>
              ))}
          </div>
        </Overlay>
      ) : null}

      <div className="flex items-center justify-between gap-2 px-3 pb-3">{footer}</div>
    </div>
  );
}

function Overlay({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 grid place-items-center bg-background/85 px-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="panel w-full max-w-sm space-y-4 p-5"
      >
        <p className="text-center font-display text-sm uppercase tracking-[0.25em] text-[var(--ono-yellow)]">
          {title}
        </p>
        {children}
      </motion.div>
    </motion.div>
  );
}
