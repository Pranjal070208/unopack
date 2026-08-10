import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PlayerAvatar } from "./PlayerAvatar";
import { PlayerHand } from "./PlayerHand";
import { DiscardPile, DrawPile } from "./Piles";
import { CardBack } from "./Card";
import { GAME_CONFIG } from "@/game/config";
import type { Card, CardColor } from "@/game/gameTypes";

const TURN_SECONDS: number = GAME_CONFIG.TURN_SECONDS;

import type { GameRow, PlayerRow } from "@/hooks/useRoom";
import { cn } from "@/lib/utils";

interface Props {
  game: GameRow;
  players: PlayerRow[];
  me: PlayerRow | null;
  hand: Card[];
  playable: string[];
  reactions: Record<string, string>;
  onPlay: (cardId: string, color?: Exclude<CardColor, "wild">) => void;
  onDraw: () => void;
  onTimeout: () => void;
  header: React.ReactNode;
  footer: React.ReactNode;
}

export function GameTable({
  game,
  players,
  me,
  hand,
  playable,
  reactions,
  onPlay,
  onDraw,
  onTimeout,
  header,
  footer,
}: Props) {
  const [remaining, setRemaining] = useState(TURN_SECONDS);
  const myTurn = !!me && game.current_player_id === me.id;
  const opponents = players.filter((p) => p.id !== me?.id);
  const current = players.find((p) => p.id === game.current_player_id);

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

  const urgent = remaining <= 10;

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">{header}</div>

      {/* Opponents */}
      <div className="hide-scrollbar mt-3 flex justify-start gap-3 overflow-x-auto px-4 sm:justify-center">
        {opponents.map((p) => {
          const active = p.id === game.current_player_id;
          return (
            <motion.div
              key={p.id}
              layout
              className={cn(
                "panel flex min-w-[104px] flex-col items-center gap-1 p-2",
                active && "border-[var(--ono-yellow)]",
              )}
            >
              <PlayerAvatar
                avatar={p.avatar}
                nickname={p.nickname}
                isHost={p.is_host}
                connected={p.is_connected}
                active={active}
                eliminated={p.eliminated}
                cardCount={p.card_count}
                reaction={reactions[p.id] ?? null}
                size="md"
              />
              <div className="flex -space-x-3">
                {Array.from({ length: Math.min(p.card_count, 5) }).map((_, i) => (
                  <CardBack key={i} size="sm" className="!h-7 !w-5 rounded-md" />
                ))}
              </div>
              {p.card_count <= 2 && !p.eliminated ? (
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="font-display text-[9px] uppercase tracking-widest text-[var(--ono-red)]"
                >
                  Danger
                </motion.span>
              ) : null}
            </motion.div>
          );
        })}
      </div>

      {/* Table */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
        <div className="text-center">
          <motion.p
            key={game.current_player_id ?? "none"}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="font-display text-sm uppercase tracking-[0.3em]"
            style={{ color: myTurn ? "var(--ono-yellow)" : "var(--muted-foreground)" }}
          >
            {myTurn ? "Your turn" : `${current?.nickname ?? "…"}'s turn`}
          </motion.p>
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
              "mt-1 font-display text-xs",
              urgent ? "animate-pulse text-[var(--ono-red)]" : "text-muted-foreground",
            )}
          >
            {remaining}s
          </p>
        </div>

        <div className="flex items-center justify-center gap-8 sm:gap-14">
          <DrawPile
            onDraw={onDraw}
            disabled={!myTurn}
            pending={game.pending_draw}
            {...(me ? {} : {})}
          />
          <DiscardPile top={game.discard_top} activeColor={game.active_color} direction={game.direction} />
        </div>
      </div>

      {/* My hand */}
      <div className="pb-2">
        <div className="mb-1 flex items-center justify-center gap-2 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>{me?.nickname ?? "You"}</span>
          <span className={cn(hand.length >= 20 && "text-[var(--ono-red)]")}>· {hand.length} cards</span>
          {hand.length >= 20 ? <span className="text-[var(--ono-red)]">· ELIMINATION AT 25</span> : null}
        </div>
        <PlayerHand
          hand={hand}
          playable={playable}
          myTurn={myTurn}
          onPlay={onPlay}
          hint={
            myTurn
              ? game.pending_draw > 0 && playable.length === 0
                ? `NO STACK — TAKE ${game.pending_draw}`
                : playable.length === 0
                  ? "NO MOVES — DRAW A CARD"
                  : null
              : null
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2 px-3 pb-3">{footer}</div>
    </div>
  );
}
