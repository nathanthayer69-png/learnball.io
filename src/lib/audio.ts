/**
 * 8-bit sound effects and chiptune music, generated live with the Web Audio API.
 * No audio files: everything is synthesized, so it loads instantly and stays tiny.
 * Native (iOS/Android) builds just stay silent for now.
 */
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

// ---------- Preferences (sound / music on-off), remembered per browser ----------

export type AudioPrefs = { sound: boolean; music: boolean };
const PREFS_KEY = "learnball:audio";
let prefs: AudioPrefs = { sound: true, music: true };
try {
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
  }
} catch {}

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useAudioPrefs(): AudioPrefs {
  return useSyncExternalStore(subscribe, () => prefs, () => prefs);
}

export function setAudioPref(key: keyof AudioPrefs, value: boolean) {
  prefs = { ...prefs, [key]: value };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
  listeners.forEach((fn) => fn());
  if (key === "music") applyMusicGain();
  if (key === "sound" && value) sfx.click();
}

// ---------- Audio graph ----------

let ctx: AudioContext | null = null;
let sfxBus: GainNode;
let musicBus: GainNode;
let noiseBuf: AudioBuffer;

function ensure(): AudioContext | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Browsers only allow audio after a tap or key press. Any one unlocks it for the session. */
if (Platform.OS === "web" && typeof window !== "undefined") {
  const unlock = () => {
    if (ensure()) {
      applyMusicGain();
      if (musicWanted()) startScheduler();
    }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function tone(
  freq: number,
  at: number,
  dur: number,
  o: { type?: OscillatorType; vol?: number; slideTo?: number; bus?: GainNode } = {},
) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? "square";
  osc.frequency.setValueAtTime(freq, at);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, at + dur);
  const vol = o.vol ?? 0.15;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g);
  g.connect(o.bus ?? sfxBus);
  osc.start(at);
  osc.stop(at + dur + 0.03);
}

function noise(at: number, dur: number, vol: number, highpass: number, bus: GainNode) {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = highpass;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f);
  f.connect(g);
  g.connect(bus);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

/** Run a sound effect only when sound is on and audio is unlocked. */
function play(fn: (t: number) => void) {
  if (!prefs.sound) return;
  const c = ensure();
  if (!c) return;
  fn(c.currentTime + 0.01);
}

// ---------- Sound effects ----------

export const sfx = {
  click: () => play((t) => tone(midi(84), t, 0.05, { vol: 0.07 })),
  /** Countdown tick. `urgent` = last seconds of the answer clock. */
  tick: (urgent = false) => play((t) => tone(midi(urgent ? 88 : 79), t, 0.07, { vol: urgent ? 0.12 : 0.07 })),
  /** Question unlocks: you can type. */
  go: () =>
    play((t) => {
      [72, 79, 84].forEach((n, i) => tone(midi(n), t + i * 0.06, 0.09, { vol: 0.12 }));
    }),
  /** Wrong guess: low double buzz. */
  wrong: () =>
    play((t) => {
      tone(midi(46), t, 0.11, { type: "sawtooth", vol: 0.13 });
      tone(midi(41), t + 0.12, 0.2, { type: "sawtooth", vol: 0.13 });
    }),
  /** "Which one did you mean?" picker pops up. */
  choose: () => play((t) => tone(520, t, 0.1, { slideTo: 1040, vol: 0.1 })),
  /** Correct answer. tier 0 (casual) to 4 (ball knower): rarer = longer and brighter. */
  hit: (tier: number) =>
    play((t) => {
      const run = [72, 76, 79, 84, 88, 91, 96].slice(0, 2 + tier);
      run.forEach((n, i) => tone(midi(n), t + i * 0.065, 0.11, { vol: 0.13 }));
      const end = t + run.length * 0.065;
      if (tier >= 3) {
        [84, 88, 91].forEach((n) => tone(midi(n), end, 0.45, { type: "triangle", vol: 0.12 }));
        noise(end, 0.3, 0.05, 6000, sfxBus);
      }
      if (tier === 4) [100, 103, 108].forEach((n, i) => tone(midi(n), end + 0.12 + i * 0.05, 0.08, { type: "triangle", vol: 0.06 }));
    }),
  /** Time ran out with no answer. */
  timesUp: () =>
    play((t) => {
      tone(midi(55), t, 0.18, { type: "square", vol: 0.1 });
      tone(midi(48), t + 0.2, 0.45, { type: "square", vol: 0.1, slideTo: midi(40) });
    }),
  /** One footstep on the stairs. */
  step: (i: number) => play((t) => tone(midi(64 + (i % 4) * 3), t, 0.035, { type: "triangle", vol: 0.05 })),
  /** Runner slips. */
  slip: () => play((t) => tone(700, t, 0.28, { slideTo: 160, vol: 0.06 })),
  /** New level reached. Hall of Fame gets the big version. */
  levelUp: (level: number) =>
    play((t) => {
      const big = level >= 5;
      const notes = big ? [67, 72, 76, 79, 84, 88] : [67, 72, 76, 79];
      notes.forEach((n, i) => tone(midi(n), t + i * 0.09, 0.12, { vol: 0.13 }));
      const end = t + notes.length * 0.09;
      const chord = big ? [72, 76, 79, 84, 91] : [76, 79, 84];
      chord.forEach((n) => tone(midi(n), end, big ? 1.1 : 0.55, { type: "square", vol: 0.07 }));
      chord.forEach((n) => tone(midi(n - 12), end, big ? 1.1 : 0.55, { type: "triangle", vol: 0.08 }));
      noise(end, big ? 0.9 : 0.4, 0.06, 5000, sfxBus);
    }),
  /** Final whistle on the results screen. */
  finish: () =>
    play((t) => {
      tone(2600, t, 0.12, { type: "sine", vol: 0.08 });
      tone(2600, t + 0.16, 0.5, { type: "sine", vol: 0.08 });
    }),
};

/** Short buzz on phones that support it (Android Chrome). iPhones ignore it. */
export function buzz(ms: number | number[]) {
  try {
    if (prefs.sound && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {}
}

// ---------- Music: one chiptune loop that adds instruments as you climb ----------
// Level 0 Backyard: drums + bass · 1 High School: + snare, busier bass · 2 College: + arpeggios
// 3 Pros: + lead melody · 4 All-Star: + harmony and crashes · 5 Hall of Fame: + brass chords

export type MusicMode = "off" | "menu" | "game" | "answer" | "results";
let mode: MusicMode = "off";
let level = 0;
const MODE_VOL: Record<MusicMode, number> = { off: 0, menu: 0.9, game: 0.6, answer: 0, results: 0.9 };

const BPM = 132;
const STEP = 60 / BPM / 4; // 16th note
const CHORDS = [
  { root: 48, tones: [60, 64, 67] }, // C
  { root: 45, tones: [57, 60, 64] }, // Am
  { root: 41, tones: [53, 57, 60] }, // F
  { root: 43, tones: [55, 59, 62] }, // G
];
const _ = 0;
const MELODY = [
  76, _, 79, _, 84, _, 79, _, 76, _, 74, _, 72, _, _, _,
  72, _, 76, _, 81, _, 76, _, 72, _, 71, _, 69, _, _, _,
  69, _, 72, _, 77, _, 72, _, 81, _, 79, _, 77, _, 76, _,
  74, _, _, 79, _, _, 83, _, 81, _, 79, _, 77, _, 74, _,
];

let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let stepIndex = 0;

function scheduleStep(s: number, at: number) {
  const bar = Math.floor(s / 16) % 4;
  const i = s % 16;
  const chord = CHORDS[bar];
  const L = level;
  const b = musicBus;
  // Drums
  if (i % 8 === 0) tone(150, at, 0.12, { type: "sine", vol: 0.5, slideTo: 45, bus: b });
  if (i % 4 === 2) noise(at, 0.04, 0.12, 7000, b);
  if (L >= 1 && i % 8 === 4) noise(at, 0.12, 0.2, 1800, b);
  if (L >= 4 && s % 64 === 0) noise(at, 0.8, 0.12, 4000, b);
  // Bass
  if (L === 0 && i % 4 === 0) tone(midi(chord.root), at, STEP * 3, { type: "triangle", vol: 0.28, bus: b });
  if (L >= 1 && i % 2 === 0) tone(midi(chord.root + (i % 4 === 2 ? 12 : 0)), at, STEP * 1.6, { type: "triangle", vol: 0.3, bus: b });
  // Arpeggio
  if (L >= 2) tone(midi(chord.tones[i % 3] + 12), at, STEP * 0.8, { type: "square", vol: 0.025, bus: b });
  // Lead melody (+ a harmony a third above at All-Star)
  const note = MELODY[s % 64];
  if (L >= 3 && note) {
    tone(midi(note), at, STEP * 1.8, { type: "square", vol: 0.06, bus: b });
    if (L >= 4) tone(midi(note + 4), at, STEP * 1.8, { type: "square", vol: 0.03, bus: b });
  }
  // Hall of Fame brass
  if (L >= 5 && i === 0) chord.tones.forEach((n) => tone(midi(n), at, STEP * 14, { type: "sawtooth", vol: 0.025, bus: b }));
}

function startScheduler() {
  if (timer || !ctx) return;
  nextTime = ctx.currentTime + 0.05;
  timer = setInterval(() => {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.15) {
      scheduleStep(stepIndex, nextTime);
      stepIndex++;
      nextTime += STEP;
    }
  }, 25);
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

const musicWanted = () => prefs.music && MODE_VOL[mode] > 0;

function applyMusicGain() {
  if (!ctx) return;
  const target = prefs.music ? MODE_VOL[mode] * 0.5 : 0;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(target, ctx.currentTime, 0.25);
  if (target > 0) startScheduler();
  else setTimeout(() => !musicWanted() && stopScheduler(), 1200);
}

export const music = {
  setMode(m: MusicMode) {
    if (m === mode) return;
    mode = m;
    if (ensureQuiet()) applyMusicGain();
  },
  setLevel(l: number) {
    level = Math.max(0, Math.min(5, l));
  },
};

/** Only touch the audio graph if it already exists (never create it outside a tap). */
function ensureQuiet() {
  if (!ctx) return false;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return true;
}
