import AsyncStorage from "@react-native-async-storage/async-storage";
import { TIERS, type TierId } from "@/data/types";

export const READ_SECONDS = 5;
export const ANSWER_SECONDS = 25;
export const REVEAL_MS = 2400;
/** Bonus for getting something on all 7 prompts, however common. */
export const PERFECT_BONUS = 50;
export const PROMPTS_PER_GAME = 7;
export const MAX_SCORE = 700 + PERFECT_BONUS;
export const LAUNCH_DAY = "2026-11-09"; // Game #1

/**
 * Testing mode: replay as often as you like and pick any day.
 * Off for players. Turn it on in your browser with learnball.io/?test=1 (and off with ?test=0).
 * It's remembered on that browser only.
 */
function readTestMode(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search).get("test");
    if (q === "1") window.localStorage.setItem("learnball:test", "1");
    if (q === "0") window.localStorage.removeItem("learnball:test");
    return window.localStorage.getItem("learnball:test") === "1";
  } catch {
    return false;
  }
}
export const UNLIMITED_PLAY = readTestMode();

export type PromptResult = {
  promptId: string;
  input: string;
  name?: string; // matched canonical name
  tier?: TierId;
  points: number;
};

export type SavedGame = {
  day: string;
  set: number; // which set of 7 prompts (see data/schedule.ts)
  promptIds: string[];
  index: number; // current prompt
  phase: "read" | "answer";
  phaseStart: number; // ms timestamp, so a refresh can't buy extra time
  results: PromptResult[];
  done: boolean;
  archive?: number; // set when this is a past game played from the archive (its game number)
};

/** Today's date in Eastern Time, "YYYY-MM-DD". New game at midnight ET. */
export function todayET(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function gameNumber(day = todayET()): number {
  const ms = Date.parse(day) - Date.parse(LAUNCH_DAY);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

// ---------- Score -> title and venue ----------

export const RESULT_TITLES = [
  { min: 460, title: "Certified Ball Knower" },
  { min: 380, title: "You're a Die Hard" },
  { min: 220, title: "You're a Film Watcher" },
  { min: 90, title: "You're a Fan" },
  { min: 0, title: "You're a Casual" },
];

export function titleForScore(score: number): string {
  return RESULT_TITLES.find((t) => score >= t.min)!.title;
}

export type Level = { id: string; name: string; emoji: string; start: number; end: number };

/**
 * The climb: Backyard to the Hall of Fame. Early levels come fast, the top stays special.
 * Tuned on the first 70 real games (Nov 2026): typical game → The Pros / All-Star with 4–5 level-ups,
 * about 1 in 7 games reaches the Hall of Fame.
 */
export const LEVELS: Level[] = [
  { id: "backyard", name: "Backyard", emoji: "🏡", start: 0, end: 40 },
  { id: "rec", name: "Rec League", emoji: "🧢", start: 40, end: 90 },
  { id: "highschool", name: "High School", emoji: "🏫", start: 90, end: 150 },
  { id: "college", name: "College", emoji: "🎓", start: 150, end: 220 },
  { id: "pros", name: "The Pros", emoji: "🏟️", start: 220, end: 300 },
  { id: "allstar", name: "All-Star", emoji: "⭐", start: 300, end: 380 },
  { id: "mvp", name: "MVP", emoji: "🥇", start: 380, end: 460 },
  { id: "hall", name: "Hall of Fame", emoji: "🏆", start: 460, end: MAX_SCORE + 1 },
];

export function levelIndexForScore(score: number): number {
  const i = LEVELS.findIndex((v) => score >= v.start && score < v.end);
  return i < 0 ? LEVELS.length - 1 : i;
}

export function levelForScore(score: number): Level {
  return LEVELS[levelIndexForScore(score)];
}

/** Something on every prompt: all 7 answered, no misses or timeouts. */
export function isPerfectGame(results: PromptResult[]) {
  return results.length >= PROMPTS_PER_GAME && results.every((r) => r.points > 0);
}

export function totalScore(results: PromptResult[]) {
  return results.reduce((s, r) => s + r.points, 0) + (isPerfectGame(results) ? PERFECT_BONUS : 0);
}

export function shareText(day: string, results: PromptResult[], rank?: { players: number; topPct: number } | null): string {
  const score = totalScore(results);
  const row = results.map((r) => (r.tier ? TIERS[r.tier].emoji : "❌")).join("");
  const level = levelForScore(score);
  return [
    `LearnBall #${gameNumber(day)} · ${titleForScore(score)}`,
    `${row} ${score}/${MAX_SCORE}`,
    `Made it to ${level.name} ${level.emoji}`,
    ...(isPerfectGame(results) ? ["🔥 Perfect game"] : []),
    ...(rank && rank.players >= 10 ? [`Top ${rank.topPct}% today`] : []),
    "learnball.io",
  ].join("\n");
}

// ---------- Saving progress ----------

const gameKey = (day: string, archive?: number) => (archive ? `learnball:archive:${archive}` : `learnball:game:${day}`);

/** The calendar day (ET) of game #n. */
export function dayForGame(n: number): string {
  const d = new Date(Date.parse(LAUNCH_DAY + "T12:00:00Z") + (n - 1) * 86400000);
  return d.toISOString().slice(0, 10);
}
const STREAK_KEY = "learnball:streak";

export async function loadGame(day: string, archive?: number): Promise<SavedGame | null> {
  try {
    const raw = await AsyncStorage.getItem(gameKey(day, archive));
    return raw ? (JSON.parse(raw) as SavedGame) : null;
  } catch {
    return null;
  }
}

export async function saveGame(game: SavedGame) {
  try {
    await AsyncStorage.setItem(gameKey(game.day, game.archive), JSON.stringify(game));
  } catch {}
}

export async function clearGame(day: string, archive?: number) {
  try {
    await AsyncStorage.removeItem(gameKey(day, archive));
  } catch {}
}

type Streak = { last: string; count: number };

export async function loadStreak(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    if (!raw) return 0;
    const s = JSON.parse(raw) as Streak;
    const today = todayET();
    const yesterday = todayET(new Date(Date.now() - 86400000));
    return s.last === today || s.last === yesterday ? s.count : 0;
  } catch {
    return 0;
  }
}

export async function recordFinish(day: string) {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    const s: Streak | null = raw ? JSON.parse(raw) : null;
    if (s?.last === day) return;
    const yesterday = todayET(new Date(Date.parse(day) - 86400000 + 12 * 3600000));
    const count = s && s.last === yesterday ? s.count + 1 : 1;
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ last: day, count }));
  } catch {}
}

// ---------- Stats (kept on this device) ----------

export type PlayRecord = { day: string; score: number; level: number };
const HISTORY_KEY = "learnball:history";
const BEST_STREAK_KEY = "learnball:bestStreak";

export async function loadHistory(): Promise<PlayRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as PlayRecord[]) : [];
  } catch {
    return [];
  }
}

/** Save a finished game (once per day; test replays overwrite that day). */
export async function recordPlay(day: string, score: number) {
  try {
    const list = (await loadHistory()).filter((r) => r.day !== day);
    list.push({ day, score, level: levelIndexForScore(score) });
    list.sort((a, b) => a.day.localeCompare(b.day));
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    const streak = await loadStreak();
    const best = Number((await AsyncStorage.getItem(BEST_STREAK_KEY)) ?? 0);
    if (streak > best) await AsyncStorage.setItem(BEST_STREAK_KEY, String(streak));
  } catch {}
}

export async function loadBestStreak(): Promise<number> {
  try {
    return Number((await AsyncStorage.getItem(BEST_STREAK_KEY)) ?? 0);
  } catch {
    return 0;
  }
}
