import AsyncStorage from "@react-native-async-storage/async-storage";
import { TIERS, type TierId } from "@/data/types";

export const READ_SECONDS = 5;
export const ANSWER_SECONDS = 25;
export const REVEAL_MS = 2400;
export const MAX_SCORE = 700;
export const LAUNCH_DAY = "2026-11-09"; // Game #1

/** TESTING: lets you replay as many times as you want. Set to false before launch. */
export const UNLIMITED_PLAY = true;

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
  { min: 560, title: "Certified Ball Knower" },
  { min: 420, title: "You're a Die Hard" },
  { min: 280, title: "You're a Film Watcher" },
  { min: 140, title: "You're a Fan" },
  { min: 0, title: "You're a Casual" },
];

export function titleForScore(score: number): string {
  return RESULT_TITLES.find((t) => score >= t.min)!.title;
}

export type Venue = { id: string; name: string; emoji: string; start: number; end: number };

export const VENUES: Venue[] = [
  { id: "football", name: "Football Field", emoji: "🏈", start: 0, end: 140 },
  { id: "baseball", name: "Baseball Diamond", emoji: "⚾", start: 140, end: 280 },
  { id: "hockey", name: "Hockey Rink", emoji: "🏒", start: 280, end: 420 },
  { id: "basketball", name: "Basketball Court", emoji: "🏀", start: 420, end: 560 },
  { id: "golf", name: "Golf Course", emoji: "⛳", start: 560, end: 680 },
  { id: "hall", name: "Hall of Fame", emoji: "🏛️", start: 680, end: 701 },
];

export function venueForScore(score: number): Venue {
  return VENUES.find((v) => score >= v.start && score < v.end) ?? VENUES[VENUES.length - 1];
}

export function totalScore(results: PromptResult[]) {
  return results.reduce((s, r) => s + r.points, 0);
}

export function shareText(day: string, results: PromptResult[]): string {
  const score = totalScore(results);
  const row = results.map((r) => (r.tier ? TIERS[r.tier].emoji : "❌")).join("");
  const venue = venueForScore(score);
  return [
    `LearnBall #${gameNumber(day)} · ${titleForScore(score)}`,
    `${row} ${score}/${MAX_SCORE}`,
    `Reached the ${venue.name} ${venue.emoji}`,
    "learnball.io",
  ].join("\n");
}

// ---------- Saving progress ----------

const gameKey = (day: string) => `learnball:game:${day}`;
const STREAK_KEY = "learnball:streak";

export async function loadGame(day: string): Promise<SavedGame | null> {
  try {
    const raw = await AsyncStorage.getItem(gameKey(day));
    return raw ? (JSON.parse(raw) as SavedGame) : null;
  } catch {
    return null;
  }
}

export async function saveGame(game: SavedGame) {
  try {
    await AsyncStorage.setItem(gameKey(game.day), JSON.stringify(game));
  } catch {}
}

export async function clearGame(day: string) {
  try {
    await AsyncStorage.removeItem(gameKey(day));
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
