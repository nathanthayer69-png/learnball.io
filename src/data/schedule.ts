import { BATCH3_PROMPTS } from "./prompts-batch3";
import { BATCH4_PROMPTS } from "./prompts-batch4";
import { BATCH5_PROMPTS } from "./prompts-batch5";
import { BATCH6_PROMPTS } from "./prompts-batch6";
import { BATCH7_PROMPTS } from "./prompts-batch7";
import { BATCH8_PROMPTS } from "./prompts-batch8";
import { BATCH9_PROMPTS } from "./prompts-batch9";
import { BATCH10_PROMPTS } from "./prompts-batch10";
import { MORE_PROMPTS } from "./prompts-more";
import { PROMPTS as DAY1 } from "./prompts";
import type { Prompt } from "./types";

export const ALL_PROMPTS: Prompt[] = [...DAY1, ...MORE_PROMPTS, ...BATCH3_PROMPTS, ...BATCH4_PROMPTS, ...BATCH5_PROMPTS, ...BATCH6_PROMPTS, ...BATCH7_PROMPTS, ...BATCH8_PROMPTS, ...BATCH9_PROMPTS, ...BATCH10_PROMPTS];

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
  [
    "wwe-champions",
    "world-cup-5-goals",
    "perfect-games",
    "nba-roy",
    "f1-champions",
    "mascots",
    "si-sportsperson",
  ],
  [
    "ufc-champions",
    "qb-35k-yards",
    "nba-60-point-games",
    "ucl-finalists",
    "nascar-champions",
    "super-bowl-stadiums",
    "game-covers",
  ],
  [
    "heavyweight-champs",
    "masters-champions",
    "nba-hs-draftees",
    "hr-derby",
    "pl-relegated-2010",
    "nfl-and-mlb",
    "dunk-contest",
  ],
  [
    "elite-eight",
    "f1-circuits",
    "darts-champs",
    "penalties",
    "ws-mvp",
    "open-champs",
    "rwc-nations",
  ],
  [
    "cat-schools",
    "daytona-500",
    "snooker-champs",
    "dropped-olympic",
    "mnf-broadcasters",
    "us-open-champs",
    "cricket-positions",
  ],
  ["bowl-games", "nba-20k", "cy-young", "conn-smythe", "wc-final-scorers", "snl-hosts", "wnba-mvp"],
  ["nfl-oroy", "final-four-mop", "hart", "pl-golden-boot", "indy-500", "horseback-sports", "ryder-cup-players"],
  ["nfl-10k-rush", "nba-6moy", "mlb-500hr", "royal-rumble", "olympic-100m", "rivalry-trophies", "pga-champs"],
  ["nfl-12k-rec", "nba-3pt", "mlb-mvp-1960", "norris", "ucl-30-goals", "ali-opponents", "cbb-coach-700"],
  ["nfl-droy", "nba-mip", "mlb-3000h", "calder-1970", "pl-pots", "f1-winners-2000", "dwts-athletes"],
  ["nfl-wpmoy", "nba-10k-reb", "players-champs", "mls-mvp", "monaco-gp", "wsop-champs", "nfl-cpoy"],
  ["nfl-coach-100", "nba-asg-mvp", "mlb-300w", "art-ross", "uefa-cup-winners", "tyson-opponents", "olympic-mascots"],
  ["nfl-r1-qb-2000", "wbb-final-four", "nba-coach-500", "mlb-roy-1970", "vezina-1982", "liv-golfers", "nascar-20-wins"],
  ["nfl-50-int", "hbcu", "wnba-no1", "ws-managers", "nhl-300w-goalie", "african-poty", "indycar-champs"],
  ["nfl-coy", "nba-skills", "mlb-50hr", "jack-adams", "wc-nations", "wrestlemania", "womens-major-2010"],
  ["sb-halftime", "nba-50-playoff", "mlb-300sv", "le-mans-makes", "bundesliga-scorers", "japanese-mlb", "fedex-dubai"],
  ["cfb-coach-200", "mlb-asg-mvp", "gg-shortstop", "selke", "mls-clubs", "la28-sports", "f1-teams-1990"],
  ["nhl-50-goals-2000", "usmnt-50", "30-for-30", "preakness-belmont-2000", "atp-top10-2000", "former-ballparks", "nba-old-names"],
  ["nascar-tracks", "wwc-nations", "never-won-title", "ryder-cup-venues", "wta-top10-2000", "outdoor-venues", "track-events"],
  ["college-stadium-75k", "uswnt-100", "real-barca", "us-flag-bearers", "solheim-players", "olympic-tennis-1988", "former-nfl-stadiums"],
];

/** Prompts built but not yet in a day. */
export const BANKED: string[] = ["ucl-final-cities"];

export function promptsForSet(set: number): string[] {
  return DAYS[((set % DAYS.length) + DAYS.length) % DAYS.length];
}
