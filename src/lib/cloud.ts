/**
 * Supabase: logs guesses and scores, and gives the "top X% today" rank.
 * Uses the plain REST API (no SDK). Everything is fire-and-forget: if Supabase isn't
 * set up yet, or the network fails, the game carries on exactly the same.
 *
 * Project: Learnball.io (schema in supabase/schema.sql).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

// Publishable key: safe to ship in the app. Row-level security only lets players add rows.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://rgjuievgykevjmbmtcla.supabase.co";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_q8o12LZqX4y6AcGM9PvguQ_YAW3dSs-";

export const cloudEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

const headers = () => ({
  apikey: SUPABASE_ANON_KEY,
  "Content-Type": "application/json",
});

/** An anonymous id for this browser, so one player counts once per day. */
let playerId: string | null = null;
async function getPlayer(): Promise<string> {
  if (playerId) return playerId;
  try {
    let id = await AsyncStorage.getItem("learnball:player");
    if (!id) {
      id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) as string;
      await AsyncStorage.setItem("learnball:player", id);
    }
    playerId = id;
    return id;
  } catch {
    return "unknown";
  }
}

async function insert(table: string, row: object, upsert = false) {
  if (!cloudEnabled) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}${upsert ? "?on_conflict=day,player" : ""}`, {
      method: "POST",
      headers: { ...headers(), Prefer: upsert ? "resolution=ignore-duplicates,return=minimal" : "return=minimal" },
      body: JSON.stringify(row),
      keepalive: true,
    });
  } catch {}
}

/** Every guess: hits and misses. Misses show us real answers missing from the lists. */
export async function logGuess(g: { day: string; promptId: string; guess: string; matched?: string; tier?: string; test?: boolean }) {
  if (!g.guess.trim()) return;
  insert("guesses", {
    day: g.day,
    prompt_id: g.promptId,
    guess: g.guess.trim().slice(0, 120),
    matched: g.matched ?? null,
    tier: g.tier ?? null,
    player: await getPlayer(),
    test: !!g.test,
  });
}

/** A finished game. Only the first one per player per day counts. */
export async function submitPlay(p: { day: string; game: number; set: number; score: number; results: object[]; test?: boolean }) {
  if (p.test) return; // test replays never touch the rankings
  insert("plays", { day: p.day, game: p.game, set_index: p.set, score: p.score, results: p.results, player: await getPlayer() }, true);
}

/** "I think this should count": a player flags their answer. */
export async function reportAnswer(r: { day: string; promptId: string; guess: string }) {
  insert("reports", { day: r.day, prompt_id: r.promptId, guess: r.guess.trim().slice(0, 120), player: await getPlayer() });
}

export type Rank = { players: number; topPct: number };

/** Where this score ranks among everyone who played today. */
export async function fetchRank(day: string, score: number): Promise<Rank | null> {
  if (!cloudEnabled) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/score_rank`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ p_day: day, p_score: score }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const row = Array.isArray(j) ? j[0] : j;
    if (!row || !row.players) return null;
    return { players: Number(row.players), topPct: Number(row.top_pct) };
  } catch {
    return null;
  }
}
