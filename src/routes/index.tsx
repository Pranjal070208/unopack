import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { FloatingCards } from "@/components/FloatingCards";
import { GameButton } from "@/components/GameButton";
import { AVATARS } from "@/lib/avatars";
import { createRoom, joinRoom } from "@/lib/game.functions";
import { getSessionId, loadProfile, saveCreds, saveProfile } from "@/lib/session";
import { playSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UNO No Mercy — Real-Time Multiplayer Card Chaos" },
      {
        name: "description",
        content:
          "Play UNO No Mercy online with friends: private rooms, brutal +10 stacks, 25-card eliminations and real-time chaos in your browser.",
      },
      { property: "og:title", content: "UNO No Mercy — Real-Time Multiplayer Card Chaos" },
      {
        property: "og:description",
        content: "Create a private room, share the code and unleash no-mercy card warfare with up to 10 players.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

type Mode = "create" | "join" | null;

function Landing() {
  const navigate = useNavigate();
  const saved = loadProfile();
  const [mode, setMode] = useState<Mode>(null);
  const [nickname, setNickname] = useState(saved.nickname);
  const [avatar, setAvatar] = useState(saved.avatar);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = nickname.trim().slice(0, 16);
    if (!name) {
      toast.error("PICK A NAME FIRST");
      return;
    }
    if (mode === "join" && code.trim().length !== 5) {
      toast.error("ROOM CODES ARE 5 CHARACTERS");
      return;
    }
    setBusy(true);
    saveProfile(name, avatar);
    try {
      const payload = { nickname: name, avatar, sessionId: getSessionId() };
      const res =
        mode === "create"
          ? await createRoom({ data: payload })
          : await joinRoom({ data: { ...payload, code: code.trim().toUpperCase() } });
      saveCreds(res.code, { playerId: res.playerId, secret: res.secret });
      playSound("special");
      void navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (err) {
      const msg = String((err as Error).message ?? "");
      toast.error(
        msg.includes("ROOM_NOT_FOUND")
          ? "NO ROOM WITH THAT CODE"
          : msg.includes("ROOM_FULL")
            ? "THAT ROOM IS FULL"
            : msg.includes("GAME_IN_PROGRESS")
              ? "GAME ALREADY STARTED"
              : "SOMETHING BROKE — TRY AGAIN",
      );
      setBusy(false);
    }
  };

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background">
      <FloatingCards />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-5 py-12 text-center">
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-[10px] uppercase tracking-[0.5em] text-muted-foreground"
        >
          Real-time · Private rooms · Up to 10
        </motion.p>

        <motion.h1
          initial={{ scale: 0.7, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: -2 }}
          transition={{ type: "spring", stiffness: 220, damping: 16 }}
          className="text-stroke-black mt-4 font-display text-6xl uppercase leading-[0.85] sm:text-8xl"
        >
          <span className="block text-[var(--ono-red)] drop-shadow-[0_8px_40px_oklch(0.58_0.24_25/0.55)]">UNO</span>
          <span className="block text-[var(--ono-yellow)]">No Mercy</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-5 max-w-md text-sm text-muted-foreground sm:text-base"
        >
          Stack +2s into +10s. Skip everyone. Hit 25 cards and you're gone. Grab your friends and find out who folds
          first.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <GameButton size="lg" pulse onClick={() => setMode("create")}>
            Create room
          </GameButton>
          <GameButton size="lg" variant="secondary" onClick={() => setMode("join")}>
            Join room
          </GameButton>
        </motion.div>

        <div className="mt-12 grid w-full max-w-lg grid-cols-3 gap-3 text-left">
          {[
            { t: "+10 STACKS", d: "Chain draw cards until someone breaks." },
            { t: "25 = OUT", d: "Too many cards and you're eliminated." },
            { t: "35s TURNS", d: "Stall and the server draws for you." },
          ].map((f) => (
            <div key={f.t} className="panel p-3">
              <p className="font-display text-[11px] uppercase text-[var(--ono-yellow)]">{f.t}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {mode ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/85 px-4"
            onClick={() => !busy && setMode(null)}
          >
            <motion.div
              initial={{ y: 40, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 40, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="panel w-full max-w-md p-5"
            >
              <h2 className="font-display text-2xl uppercase text-[var(--ono-yellow)]">
                {mode === "create" ? "Create room" : "Join room"}
              </h2>

              <label className="mt-4 block text-left font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                Nickname
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={16}
                  placeholder="RUTHLESS"
                  className="mt-1 w-full rounded-xl border border-border bg-[var(--surface)] px-3 py-3 font-display text-base uppercase tracking-wider text-foreground outline-none focus:border-[var(--ono-yellow)]"
                />
              </label>

              {mode === "join" ? (
                <label className="mt-3 block text-left font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                  Room code
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))}
                    maxLength={5}
                    placeholder="X7K2P"
                    className="mt-1 w-full rounded-xl border border-border bg-[var(--surface)] px-3 py-3 text-center font-display text-2xl tracking-[0.5em] text-[var(--ono-yellow)] outline-none focus:border-[var(--ono-yellow)]"
                  />
                </label>
              ) : null}

              <p className="mt-4 text-left font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                Avatar
              </p>
              <div className="hide-scrollbar mt-2 grid max-h-40 grid-cols-6 gap-2 overflow-y-auto">
                {AVATARS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAvatar(a.id)}
                    aria-label={a.label}
                    className={cn(
                      "grid aspect-square place-items-center rounded-xl border-2 text-xl transition-transform hover:scale-110",
                      avatar === a.id ? "border-[var(--ono-yellow)] bg-white/10" : "border-border bg-[var(--surface)]",
                    )}
                  >
                    <span aria-hidden>{a.emoji}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <GameButton variant="ghost" onClick={() => setMode(null)} disabled={busy}>
                  Cancel
                </GameButton>
                <GameButton onClick={submit} disabled={busy} pulse={!busy}>
                  {busy ? "…" : mode === "create" ? "Let's go" : "Join"}
                </GameButton>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
