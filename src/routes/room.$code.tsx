import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { LogOut, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { GameLobby } from "@/components/GameLobby";
import { GameTable } from "@/components/GameTable";
import { VictoryScreen } from "@/components/VictoryScreen";
import { GameAnnouncement } from "@/components/GameAnnouncement";
import { EventFeed } from "@/components/EventFeed";
import { useGameEventAnimations } from "@/hooks/useGameEventAnimations";
import { useScreenShake } from "@/lib/fx";
import { GameButton } from "@/components/GameButton";
import { GameChat, ReactionPicker } from "@/components/Social";
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

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [creds, setCreds] = useState(() => loadCreds(code));
  const room = useRoom(code, creds);
  const { sfx: soundOn, setSfx } = useSound();
  const toggleSound = () => setSfx((v) => !v);

  const shake = useScreenShake();

  const players = room.players;
  const me = room.me;

  const { announcement, feed, reactions, notice, chat } = useGameEventAnimations({
    events: room.events,
    players,
    myId: me?.id ?? null,
  });

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
      <GameAnnouncement announcement={announcement} />
      {shake ? (
        <div
          key={shake.key}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[45] animate-chaos-shake bg-white/5"
          style={{ opacity: Math.min(0.5, 0.12 * shake.intensity) }}
        />
      ) : null}

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
          feed={feed}
          game={game}
          players={players}
          me={me}
          hand={room.hand}
          playable={room.playable}
          reactions={reactions}
          onPlay={(cardId, color) =>
            void cmd(color ? { type: "PLAY_CARD", cardId, color } : { type: "PLAY_CARD", cardId })
          }
          onDraw={() => void cmd({ type: "DRAW_CARD" })}
          onChooseColor={(color) => void cmd({ type: "CHOOSE_COLOR", color })}
          onChooseSwapTarget={(targetId) => void cmd({ type: "CHOOSE_SWAP_TARGET", targetId })}
          onCallUno={() => void cmd({ type: "CALL_UNO" })}
          onCatchUno={(targetId) => void cmd({ type: "CATCH_UNO", targetId })}


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
