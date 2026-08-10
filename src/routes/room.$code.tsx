import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { LogOut, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { GameLobby } from "@/components/GameLobby";
import { GameTable } from "@/components/GameTable";
import { VictoryScreen } from "@/components/VictoryScreen";
import { EffectLayer, type Effect } from "@/components/EffectLayer";
import { GameButton } from "@/components/GameButton";
import { GameChat, ReactionPicker, type ChatMessage } from "@/components/Social";
import { AVATARS } from "@/lib/avatars";
import { useRoom, type EventRow } from "@/hooks/useRoom";
import { playSound, useSound } from "@/hooks/useSound";
import {
  enforceTimeout,
  joinRoom,
  kickPlayer,
  leaveRoom,
  playAgain,
  returnToLobby,
  sendCommand,
  sendRoomEvent,
  startGame,
} from "@/lib/game.functions";

import { clearCreds, getSessionId, loadCreds, loadProfile, saveCreds, saveProfile } from "@/lib/session";
import type { CardColor } from "@/game/gameTypes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — ONO No Mercy` },
      { name: "description", content: `Join private ONO No Mercy room ${params.code} and play in real time.` },
      { property: "og:title", content: `Join ONO No Mercy room ${params.code}` },
      { property: "og:description", content: "Private real-time card chaos. Tap to join the table." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomPage,
});

function effectFor(e: EventRow): Effect | null {
  const data = e.event_data as { card?: { kind?: string; color?: string }; count?: number; nickname?: string };
  switch (e.event_type) {
    case "play": {
      const kind = data.card?.kind;
      if (!kind || kind === "number") return null;
      const map: Record<string, string> = {
        skip: "SKIPPED!",
        reverse: "REVERSE!",
        draw2: "+2!",
        draw4: "+4!",
        draw6: "+6!",
        draw10: "+10 NO MERCY!",
        reversedraw4: "REVERSE +4!",
        skipall: "SKIP EVERYONE!",
        discardall: "DISCARD ALL!",
        wild: "WILD!",
      };
      const text = map[kind];
      return text ? { id: e.id, text, tone: kind === "draw10" ? "red" : "yellow" } : null;
    }
    case "eliminated":
      return { id: e.id, text: "ELIMINATED!", tone: "red" };
    case "timeout":
      return { id: e.id, text: "TOO SLOW!", tone: "red" };
    case "shuffle":
      return { id: e.id, text: "RESHUFFLE", tone: "blue" };
    default:
      return null;
  }
}

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [creds, setCreds] = useState(() => loadCreds(code));
  const room = useRoom(code, creds);
  const { sfx: soundOn, setSfx } = useSound();
  const toggleSound = () => setSfx((v) => !v);

  const [effect, setEffect] = useState<Effect | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const seenRef = useRef<number>(0);

  const players = room.players;
  const me = room.me;

  // React to new events: effects, sounds, reactions, notices.
  useEffect(() => {
    const fresh = room.events.filter((e) => e.id > seenRef.current);
    if (fresh.length === 0) return;
    const initial = seenRef.current === 0;
    seenRef.current = room.events[room.events.length - 1]?.id ?? 0;
    if (initial) return;

    for (const e of fresh) {
      const data = e.event_data as { nickname?: string; text?: string; count?: number };
      if (e.event_type === "reaction" && e.player_id) {
        const pid = e.player_id;
        setReactions((r) => ({ ...r, [pid]: String(data.text ?? "🔥") }));
        setTimeout(() => setReactions((r) => ({ ...r, [pid]: "" })), 2500);
        continue;
      }
      if (e.event_type === "player_join") setNotice(`${data.nickname ?? "SOMEONE"} JOINED`);
      if (e.event_type === "player_leave") setNotice(`${data.nickname ?? "SOMEONE"} LEFT`);
      if (e.event_type === "player_kick") setNotice(`${data.nickname ?? "SOMEONE"} WAS KICKED`);
      if (e.event_type === "play") playSound(effectFor(e) ? "special" : "play");
      if (e.event_type === "draw") playSound("draw");
      if (e.event_type === "eliminated") playSound("lose");
      if (e.event_type === "game_over") playSound("win");
      if (e.event_type === "game_start") playSound("turn");
      const fx = effectFor(e);
      if (fx) setEffect(fx);
    }
    const t = setTimeout(() => setEffect(null), 1200);
    return () => clearTimeout(t);
  }, [room.events]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  const chat: ChatMessage[] = useMemo(
    () =>
      room.events
        .filter((e) => e.event_type === "chat")
        .slice(-40)
        .map((e) => ({
          id: e.id,
          nickname: String((e.event_data as { nickname?: string }).nickname ?? "???"),
          text: String((e.event_data as { text?: string }).text ?? ""),
        })),
    [room.events],
  );

  const act = useCallback(
    async (fn: (args: { data: Record<string, unknown> }) => Promise<unknown>, extra: Record<string, unknown> = {}) => {
      if (!creds) return;
      try {
        await fn({ data: { ...creds, ...extra } });
      } catch (err) {
        const msg = String((err as Error).message ?? "");
        toast.error(
          msg.includes("HOST_ONLY")
            ? "ONLY THE HOST CAN DO THAT"
            : msg.includes("NOT_YOUR_TURN")
              ? "NOT YOUR TURN"
              : msg.includes("ILLEGAL_MOVE")
                ? "YOU CAN'T PLAY THAT"
                : msg.includes("NOT_ENOUGH_PLAYERS")
                  ? "NEED AT LEAST 2 PLAYERS"
                  : "ACTION FAILED",
        );
      }
    },
    [creds],
  );

  /** Every game move goes through the single authoritative command endpoint. */
  const cmd = useCallback(
    (command: Record<string, unknown>) =>
      act(sendCommand as never, {
        command,
        actionId: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
      }),
    [act],
  );

  const onTimeout = useCallback(() => {
    if (!creds) return;
    void enforceTimeout({ data: creds }).catch(() => undefined);
  }, [creds]);


  const handleLeave = async () => {
    await act(leaveRoom as never);
    clearCreds(code);
    void navigate({ to: "/" });
  };

  const share = async () => {
    const url = `${window.location.origin}/room/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "ONO No Mercy", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("INVITE LINK COPIED!");
      }
    } catch {
      /* dismissed */
    }
  };

  if (room.missing) {
    return (
      <Centered
        title="Room not found"
        body="This room expired or never existed. Start a fresh one."
        action={<GameButton onClick={() => navigate({ to: "/" })}>Back home</GameButton>}
      />
    );
  }

  if (!creds) {
    return <JoinPanel code={code} onJoined={(c) => setCreds(c)} />;
  }

  if (!room.room || (!me && players.length === 0)) {
    return <Centered title="Loading…" body="Shuffling the deck." action={null} />;
  }

  if (creds && room.room && !me && players.length > 0) {
    return (
      <Centered
        title="You're not in this room"
        body="You may have been kicked or left. Rejoin with the code."
        action={
          <GameButton
            onClick={() => {
              clearCreds(code);
              setCreds(null);
            }}
          >
            Rejoin
          </GameButton>
        }
      />
    );
  }

  const statusBar = (
    <>
      <div className="flex items-center gap-2">
        <span className="font-display text-sm text-[var(--ono-red)]">
          ONO <span className="text-[var(--ono-yellow)]">{room.room?.code}</span>
        </span>
        <span
          className={cn(
            "flex items-center gap-1 font-display text-[9px] uppercase tracking-widest",
            room.connection === "connected" ? "text-[var(--ono-green)]" : "text-[var(--ono-red)]",
          )}
        >
          {room.connection === "connected" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {room.connection}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <GameButton variant="ghost" size="sm" onClick={toggleSound}>
          {soundOn ? <Volume2 className="h-4 w-4" aria-label="Mute" /> : <VolumeX className="h-4 w-4" aria-label="Unmute" />}
        </GameButton>
        <GameButton variant="danger" size="sm" onClick={handleLeave}>
          <LogOut className="h-4 w-4" aria-label="Leave room" />
        </GameButton>
      </div>
    </>
  );

  const social = (
    <>
      <ReactionPicker onSend={(emoji) => void act(sendRoomEvent as never, { type: "reaction", payload: emoji })} />
      <GameChat messages={chat} onSend={(text) => void act(sendRoomEvent as never, { type: "chat", payload: text })} />
    </>
  );

  const game = room.game;
  const finished = game?.status === "finished";

  return (
    <main className="relative min-h-[100dvh] bg-background">
      <EffectLayer effect={effect} />

      {finished && game ? (
        <VictoryScreen
          players={players}
          winnerId={game.winner_id}
          events={room.events}
          isHost={me?.is_host ?? false}
          onPlayAgain={() => void act(playAgain as never)}
          onLobby={() => void act(returnToLobby as never)}
          onShare={share}
        />
      ) : game && game.status === "playing" && room.room?.status === "playing" ? (
        <GameTable
          game={game}
          players={players}
          me={me}
          hand={room.hand}
          playable={room.playable}
          reactions={reactions}
          onPlay={(cardId, color) =>
            void act(playCardFn as never, color ? { cardId, color } : { cardId })
          }
          onDraw={() => void act(drawCardFn as never)}
          onTimeout={onTimeout}
          header={statusBar}
          footer={
            <>
              <span className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                Turn {game.turn_count}
              </span>
              <div className="flex items-center gap-2">{social}</div>
            </>
          }
        />
      ) : room.room ? (
        <>
          <GameLobby
            room={room.room}
            players={players}
            me={me}
            notice={notice}
            onStart={() => void act(startGame as never)}
            onLeave={handleLeave}
            onKick={(id) => void act(kickPlayer as never, { targetId: id })}
          />
          <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2">{social}</div>
        </>
      ) : null}
    </main>
  );
}

function Centered({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-6 text-center">
      <div>
        <motion.h1 initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-3xl uppercase text-[var(--ono-red)]">
          {title}
        </motion.h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex justify-center">{action}</div>
      </div>
    </main>
  );
}

function JoinPanel({ code, onJoined }: { code: string; onJoined: (c: { playerId: string; secret: string }) => void }) {
  const saved = loadProfile();
  const [nickname, setNickname] = useState(saved.nickname);
  const [avatar, setAvatar] = useState(saved.avatar);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const name = nickname.trim().slice(0, 16);
    if (!name) {
      toast.error("PICK A NAME FIRST");
      return;
    }
    setBusy(true);
    saveProfile(name, avatar);
    try {
      const res = await joinRoom({ data: { nickname: name, avatar, sessionId: getSessionId(), code } });
      const creds = { playerId: res.playerId, secret: res.secret };
      saveCreds(res.code, creds);
      playSound("special");
      onJoined(creds);
    } catch (err) {
      const msg = String((err as Error).message ?? "");
      toast.error(
        msg.includes("ROOM_NOT_FOUND")
          ? "NO ROOM WITH THAT CODE"
          : msg.includes("ROOM_FULL")
            ? "THAT ROOM IS FULL"
            : msg.includes("GAME_IN_PROGRESS")
              ? "GAME ALREADY STARTED"
              : "COULDN'T JOIN — TRY AGAIN",
      );
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4">
      <div className="panel w-full max-w-md p-5 text-center">
        <h1 className="font-display text-2xl uppercase text-[var(--ono-yellow)]">Join room {code}</h1>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={16}
          placeholder="NICKNAME"
          aria-label="Nickname"
          className="mt-4 w-full rounded-xl border border-border bg-[var(--surface)] px-3 py-3 font-display text-base uppercase tracking-wider outline-none focus:border-[var(--ono-yellow)]"
        />
        <div className="hide-scrollbar mt-3 grid max-h-40 grid-cols-6 gap-2 overflow-y-auto">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAvatar(a.id)}
              aria-label={a.label}
              className={cn(
                "grid aspect-square place-items-center rounded-xl border-2 text-xl",
                avatar === a.id ? "border-[var(--ono-yellow)] bg-white/10" : "border-border bg-[var(--surface)]",
              )}
            >
              <span aria-hidden>{a.emoji}</span>
            </button>
          ))}
        </div>
        <div className="mt-5">
          <GameButton size="lg" pulse={!busy} disabled={busy} onClick={join}>
            {busy ? "…" : "Join the chaos"}
          </GameButton>
        </div>
      </div>
    </main>
  );
}
