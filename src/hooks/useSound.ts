import { useCallback, useEffect, useRef, useState } from "react";

export type SoundName =
  | "hover"
  | "select"
  | "play"
  | "draw"
  | "click"
  | "special"
  | "turn"
  | "join"
  | "leave"
  | "win"
  | "lose"
  | "countdown"
  | "reverse"
  | "skip"
  | "stack"
  | "swap"
  | "roulette"
  | "uno"
  | "eliminate";

interface Tone {
  freq: number;
  dur: number;
  type: OscillatorType;
  gain?: number;
  slide?: number;
  delay?: number;
}

const RECIPES: Record<SoundName, Tone[]> = {
  hover: [{ freq: 720, dur: 0.05, type: "sine", gain: 0.05 }],
  select: [{ freq: 880, dur: 0.07, type: "triangle", gain: 0.09 }],
  click: [{ freq: 420, dur: 0.06, type: "square", gain: 0.07 }],
  play: [
    { freq: 520, dur: 0.08, type: "triangle", gain: 0.12, slide: 780 },
    { freq: 240, dur: 0.12, type: "sine", gain: 0.1, delay: 0.05 },
  ],
  draw: [{ freq: 300, dur: 0.14, type: "sawtooth", gain: 0.07, slide: 160 }],
  special: [
    { freq: 180, dur: 0.28, type: "sawtooth", gain: 0.16, slide: 60 },
    { freq: 900, dur: 0.18, type: "square", gain: 0.09, delay: 0.04, slide: 1400 },
  ],
  turn: [
    { freq: 660, dur: 0.1, type: "sine", gain: 0.11 },
    { freq: 990, dur: 0.12, type: "sine", gain: 0.11, delay: 0.09 },
  ],
  join: [
    { freq: 500, dur: 0.09, type: "triangle", gain: 0.1 },
    { freq: 760, dur: 0.11, type: "triangle", gain: 0.1, delay: 0.08 },
  ],
  leave: [{ freq: 420, dur: 0.18, type: "triangle", gain: 0.09, slide: 180 }],
  win: [
    { freq: 523, dur: 0.13, type: "square", gain: 0.12 },
    { freq: 659, dur: 0.13, type: "square", gain: 0.12, delay: 0.12 },
    { freq: 784, dur: 0.13, type: "square", gain: 0.12, delay: 0.24 },
    { freq: 1046, dur: 0.3, type: "square", gain: 0.13, delay: 0.36 },
  ],
  lose: [
    { freq: 380, dur: 0.2, type: "sawtooth", gain: 0.11, slide: 180 },
    { freq: 180, dur: 0.32, type: "sawtooth", gain: 0.1, delay: 0.16, slide: 80 },
  ],
  countdown: [{ freq: 620, dur: 0.1, type: "square", gain: 0.12 }],
};

let ctx: AudioContext | null = null;
let sfxOn = true;
let musicOn = false;
let musicTimer: ReturnType<typeof setInterval> | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(t: Tone) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + (t.delay ?? 0);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = t.type;
  osc.frequency.setValueAtTime(t.freq, start);
  if (t.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, t.slide), start + t.dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(t.gain ?? 0.1, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + t.dur + 0.05);
}

export function playSound(name: SoundName) {
  if (!sfxOn) return;
  for (const t of RECIPES[name]) tone(t);
}

const BASS = [98, 98, 131, 110];

function startMusic() {
  if (musicTimer) return;
  let step = 0;
  musicTimer = setInterval(() => {
    if (!musicOn) return;
    const f = BASS[step % BASS.length]!;
    tone({ freq: f, dur: 0.36, type: "sawtooth", gain: 0.035 });
    if (step % 2 === 1) tone({ freq: f * 3, dur: 0.09, type: "square", gain: 0.018 });
    step += 1;
  }, 420);
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

export function useSound() {
  const [sfx, setSfx] = useState(true);
  const [music, setMusic] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const storedSfx = localStorage.getItem("ono_sfx");
    const storedMusic = localStorage.getItem("ono_music");
    if (storedSfx !== null) setSfx(storedSfx === "1");
    if (storedMusic !== null) setMusic(storedMusic === "1");
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    sfxOn = sfx;
    localStorage.setItem("ono_sfx", sfx ? "1" : "0");
  }, [sfx]);

  useEffect(() => {
    musicOn = music;
    localStorage.setItem("ono_music", music ? "1" : "0");
    if (music) startMusic();
    else stopMusic();
    return () => {
      if (!musicOn) stopMusic();
    };
  }, [music]);

  const play = useCallback((name: SoundName) => playSound(name), []);

  return { play, sfx, music, setSfx, setMusic };
}
