import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { MessageSquare, Send, Smile, X } from "lucide-react";
import { GameButton } from "./GameButton";
import { cn } from "@/lib/utils";

export const EMOTES = ["😂", "😈", "😭", "🔥", "😱", "💀", "👀"];

export function ReactionPicker({ onSend }: { onSend: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            className="panel absolute bottom-14 right-0 z-30 flex gap-1 p-2"
          >
            {EMOTES.map((e) => (
              <motion.button
                key={e}
                type="button"
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  onSend(e);
                  setOpen(false);
                }}
                aria-label={`Send ${e}`}
                className="grid h-9 w-9 place-items-center rounded-lg text-xl hover:bg-white/10"
              >
                {e}
              </motion.button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <GameButton variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
        <Smile className="h-4 w-4" aria-label="Reactions" />
      </GameButton>
    </div>
  );
}

export interface ChatMessage {
  id: number;
  nickname: string;
  text: string;
}

export function GameChat({
  messages,
  onSend,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim().slice(0, 200);
    if (!text) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={cn(
              "panel fixed inset-x-3 bottom-3 z-40 flex max-h-[52vh] flex-col p-3",
              "sm:absolute sm:inset-auto sm:bottom-14 sm:right-0 sm:w-80",
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-xs uppercase tracking-widest text-[var(--ono-yellow)]">Trash talk</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="hide-scrollbar mb-2 flex-1 space-y-1.5 overflow-y-auto text-sm">
              {messages.length === 0 ? (
                <p className="text-xs text-muted-foreground">Say something ruthless.</p>
              ) : (
                messages.map((m) => (
                  <p key={m.id} className="break-words">
                    <span className="font-display text-[11px] uppercase text-[var(--ono-red)]">{m.nickname}</span>{" "}
                    <span className="text-foreground/90">{m.text}</span>
                  </p>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                maxLength={200}
                aria-label="Chat message"
                placeholder="Type…"
                className="min-w-0 flex-1 rounded-lg border border-border bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--ono-yellow)]"
              />
              <GameButton size="sm" onClick={submit}>
                <Send className="h-4 w-4" aria-label="Send" />
              </GameButton>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <GameButton variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
        <MessageSquare className="h-4 w-4" aria-label="Chat" />
      </GameButton>
    </div>
  );
}
