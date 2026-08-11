import { AnimatePresence, motion } from "framer-motion";
import { Copy, LogOut, UserX } from "lucide-react";
import { toast } from "sonner";
import { GameButton } from "./GameButton";
import { PlayerAvatar } from "./PlayerAvatar";
import { Particles } from "./EffectLayer";
import type { PlayerRow, RoomRow } from "@/hooks/useRoom";

interface Props {
  room: RoomRow;
  players: PlayerRow[];
  me: PlayerRow | null;
  notice: string | null;
  onStart: () => void;
  onLeave: () => void;
  onKick: (id: string) => void;
  onToggleScoreMode: (enabled: boolean) => void;
}

export function GameLobby({ room, players, me, notice, onStart, onLeave, onKick, onToggleScoreMode }: Props) {
  const isHost = me?.is_host ?? false;
  const canStart = players.length >= 2;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("COPY FAILED — SELECT IT MANUALLY");
    }
  };

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 pb-10 pt-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl leading-none text-[var(--ono-red)] sm:text-2xl">
            ONO <span className="text-[var(--ono-yellow)]">NO MERCY</span>
          </h1>
          <p className="mt-1 font-display text-[10px] uppercase tracking-widest text-muted-foreground">Lobby</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => copy(room.code, "ROOM CODE COPIED!")}
            className="panel flex items-center gap-2 px-3 py-2 font-display text-sm tracking-[0.3em] text-[var(--ono-yellow)]"
            aria-label="Copy room code"
          >
            {room.code}
            <Copy className="h-3.5 w-3.5" />
          </button>
          <GameButton variant="danger" size="sm" onClick={onLeave}>
            <LogOut className="h-4 w-4" aria-label="Leave room" />
          </GameButton>
        </div>
      </header>

      <div className="mt-8 text-center">
        <motion.h2
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-stroke-black font-display text-3xl uppercase leading-[0.95] sm:text-5xl"
        >
          Ready to cause <span className="text-[var(--ono-red)]">chaos?</span>
        </motion.h2>
        <p className="mt-3 font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">
          Room: {room.code} · {players.length}/{room.max_players}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <GameButton
            variant="secondary"
            size="sm"
            onClick={() => copy(`${window.location.origin}/room/${room.code}`, "INVITE LINK COPIED!")}
          >
            Copy invite link
          </GameButton>
          <GameButton variant="ghost" size="sm" onClick={() => copy(room.code, "ROOM CODE COPIED!")}>
            Copy code
          </GameButton>
        </div>
      </div>

      <div className="relative mt-8 flex-1">
        <Particles trigger={players.length} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence>
            {players.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 40, rotate: -6, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6, x: 60 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="panel relative flex flex-col items-center gap-2 p-4"
              >
                <PlayerAvatar
                  avatar={p.avatar}
                  nickname={p.nickname}
                  isHost={p.is_host}
                  connected={p.is_connected}
                  size="lg"
                />
                <span className="font-display text-[10px] uppercase tracking-widest text-[var(--ono-green)]">
                  {p.is_connected ? "Ready" : "Reconnecting…"}
                </span>
                {p.id === me?.id ? (
                  <span className="absolute left-2 top-2 rounded-full bg-[var(--ono-yellow)] px-2 py-0.5 font-display text-[9px] uppercase text-black">
                    You
                  </span>
                ) : null}
                {isHost && p.id !== me?.id ? (
                  <button
                    type="button"
                    onClick={() => onKick(p.id)}
                    aria-label={`Kick ${p.nickname}`}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-[var(--ono-red)]"
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                ) : null}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {notice ? (
          <motion.p
            key={notice}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 text-center font-display text-xs uppercase tracking-widest text-[var(--ono-yellow)]"
          >
            {notice}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {/* Optional Score Mode: play to 1000 points instead of a single hand. */}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          disabled={!isHost}
          onClick={() => onToggleScoreMode(!room.score_mode)}
          className="panel flex min-h-11 items-center gap-3 px-4 py-2 font-display text-[10px] uppercase tracking-[0.2em] disabled:opacity-60"
        >
          <span className={room.score_mode ? "text-[var(--ono-yellow)]" : "text-muted-foreground"}>
            Score mode — first to 1000
          </span>
          <span
            className="rounded-full border-2 border-white/70 px-2 py-0.5"
            style={{ background: room.score_mode ? "var(--ono-green)" : "transparent" }}
          >
            {room.score_mode ? "On" : "Off"}
          </span>
        </button>
      </div>

      <div className="sticky bottom-3 mt-6 flex justify-center">
        {isHost ? (
          <GameButton size="lg" pulse disabled={!canStart} onClick={onStart}>
            {canStart ? "Start game" : "Need 2+ players"}
          </GameButton>
        ) : (
          <p className="font-display text-sm uppercase tracking-widest text-muted-foreground">Waiting for host…</p>
        )}
      </div>
    </div>
  );
}
