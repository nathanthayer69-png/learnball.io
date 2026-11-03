import { BATCH3_PROMPTS } from "./prompts-batch3";
import { MORE_PROMPTS } from "./prompts-more";
import { PROMPTS as DAY1 } from "./prompts";
import type { Prompt } from "./types";

export const ALL_PROMPTS: Prompt[] = [...DAY1, ...MORE_PROMPTS, ...BATCH3_PROMPTS];

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
  [
    "nfl-mvp",
    "ballon-dor",
    "nba-1200-games",
    "olympic-ball-sports",
    "fbs-teams",
    "tennis-world-no1",
    "major-courses-1950",
  ],
  [
    "nba-mvp",
    "nfl-top3-picks-2010",
    "pl-or-european-cup-clubs",
    "golf-world-no1",
    "olympic-host-cities",
    "nba-1500-blocks",
    "mlb-ped-suspensions",
  ],
  [
    "no1-picks-2000",
    "open-era-slams",
    "dpoy-nba-nfl",
    "color-team-names",
    "ap-no1-college-football",
    "nba-1500-steals",
    "olympians-5-golds",
  ],
];

/** Prompts built but not yet in a day. */
export const BANKED: string[] = [];

export function promptsForSet(set: number): string[] {
  return DAYS[((set % DAYS.length) + DAYS.length) % DAYS.length];
}
