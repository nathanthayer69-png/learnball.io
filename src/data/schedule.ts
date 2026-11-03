import { MORE_PROMPTS } from "./prompts-more";
import { PROMPTS as DAY1 } from "./prompts";
import type { Prompt } from "./types";

export const ALL_PROMPTS: Prompt[] = [...DAY1, ...MORE_PROMPTS];

const byId = new Map(ALL_PROMPTS.map((p) => [p.id, p]));
export const promptById = (id: string) => byId.get(id);

/**
 * Each day is 7 prompts, mixed across sports and question types.
 * The game cycles through these in order, one set per day.
 */
export const DAYS: string[][] = [
  [
    "epl-managers-2020",
    "qb-playoff-start-2010",
    "nba-finals-mvp",
    "golf-majors-1950",
    "heisman",
    "nhl-500-goals",
    "super-bowl-mvp",
  ],
  [
    "title-coaches-2000",
    "ucl-managers",
    "solo-no-hitters-2000",
    "current-venues",
    "grand-slam-2000",
    "winter-medal-nations",
    "relocated-teams",
  ],
  [
    "ryder-cup-captains",
    "pl-100-goals",
    "nhl-700-assists",
    "world-cup-final-venues",
    "kentucky-derby",
    "tour-de-france",
    "nfl-100-sacks",
  ],
];

/** Ready to use once there are 4 more prompts to fill a day. */
export const BANKED = ["nba-1200-games", "major-courses-1950", "pl-or-european-cup-clubs"];

export function promptsForSet(set: number): string[] {
  return DAYS[((set % DAYS.length) + DAYS.length) % DAYS.length];
}
