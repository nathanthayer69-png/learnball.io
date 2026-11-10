import { BATCH3_PROMPTS } from "./prompts-batch3";
import { BATCH4_PROMPTS } from "./prompts-batch4";
import { BATCH5_PROMPTS } from "./prompts-batch5";
import { BATCH6_PROMPTS } from "./prompts-batch6";
import { BATCH7_PROMPTS } from "./prompts-batch7";
import { BATCH8_PROMPTS } from "./prompts-batch8";
import { BATCH9_PROMPTS } from "./prompts-batch9";
import { BATCH10_PROMPTS } from "./prompts-batch10";
import { BATCH11_PROMPTS } from "./prompts-batch11";
import { BATCH12_PROMPTS } from "./prompts-batch12";
import { MORE_PROMPTS } from "./prompts-more";
import { PROMPTS as DAY1 } from "./prompts";
import type { Prompt } from "./types";

export const ALL_PROMPTS: Prompt[] = [...DAY1, ...MORE_PROMPTS, ...BATCH3_PROMPTS, ...BATCH4_PROMPTS, ...BATCH5_PROMPTS, ...BATCH6_PROMPTS, ...BATCH7_PROMPTS, ...BATCH8_PROMPTS, ...BATCH9_PROMPTS, ...BATCH10_PROMPTS, ...BATCH11_PROMPTS, ...BATCH12_PROMPTS];

const byId = new Map(ALL_PROMPTS.map((p) => [p.id, p]));
export const promptById = (id: string) => byId.get(id);

/**
 * Each day is 7 prompts, mixed across sports and question types.
 * The game cycles through these in order, one set per day.
 */
export const DAYS: string[][] = [
  ["epl-managers-2020", "qb-playoff-start-2010", "nba-finals-mvp", "golf-majors-1950", "heisman", "nhl-500-goals", "super-bowl-mvp"],
  ["current-venues", "grand-slam-2000", "title-coaches-2000", "winter-medal-nations", "relocated-teams", "solo-no-hitters-2000", "ucl-managers"],
  ["nhl-700-assists", "kentucky-derby", "ryder-cup-captains", "nfl-100-sacks", "pl-100-goals", "tour-de-france", "world-cup-final-venues"],
  ["fbs-teams", "tennis-world-no1", "nfl-mvp", "ballon-dor", "major-courses-1950", "nba-1200-games", "olympic-ball-sports"],
  ["nfl-top3-picks-2010", "olympic-host-cities", "golf-world-no1", "nba-mvp", "mlb-ped-suspensions", "nba-1500-blocks", "pl-or-european-cup-clubs"],
  ["open-era-slams", "dpoy-nba-nfl", "no1-picks-2000", "olympians-5-golds", "nba-1500-steals", "color-team-names", "ap-no1-college-football"],
  ["mascots", "world-cup-5-goals", "si-sportsperson", "nba-roy", "wwe-champions", "f1-champions", "perfect-games"],
  ["ufc-champions", "game-covers", "qb-35k-yards", "nba-60-point-games", "ucl-finalists", "nascar-champions", "super-bowl-stadiums"],
  ["heavyweight-champs", "masters-champions", "hr-derby", "nba-hs-draftees", "pl-relegated-2010", "dunk-contest", "nfl-and-mlb"],
  ["penalties", "title-teams-2000", "ws-mvp", "elite-eight", "f1-circuits", "open-champs", "wc26-host-cities"],
  ["mnf-broadcasters", "us-open-champs", "cat-schools", "cricket-positions", "nba-asg-2026", "dropped-olympic", "daytona-500"],
  ["cy-young", "nba-20k", "conn-smythe", "snl-hosts", "wc-final-scorers", "bowl-games", "wnba-mvp"],
  ["ryder-cup-players", "final-four-mop", "indy-500", "hart", "nfl-oroy", "horseback-sports", "pl-golden-boot"],
  ["rivalry-trophies", "pga-champs", "royal-rumble", "mlb-500hr", "nba-6moy", "olympic-100m", "nfl-10k-rush"],
  ["mlb-mvp-1960", "cbb-coach-700", "ucl-30-goals", "nfl-12k-rec", "nba-3pt", "norris", "ali-opponents"],
  ["dwts-athletes", "calder-1970", "nfl-droy", "mlb-3000h", "f1-winners-2000", "nba-mip", "pl-pots"],
  ["nfl-wpmoy", "nba-10k-reb", "players-champs", "nfl-cpoy", "monaco-gp", "wsop-champs", "mls-mvp"],
  ["nba-asg-mvp", "sports-tv-shows", "nfl-coach-100", "olympic-mascots", "tyson-opponents", "art-ross", "mlb-300w"],
  ["nfl-r1-qb-2000", "mlb-roy-1970", "nba-coach-500", "wbb-final-four", "nascar-20-wins", "liv-golfers", "vezina-1982"],
  ["ws-managers", "pga-winners-2026", "wnba-no1", "nhl-300w-goalie", "nba-coaches-2026", "nfl-50-int", "hbcu"],
  ["wc-nations", "wrestlemania", "nfl-coy", "mlb-50hr", "womens-major-2010", "nba-4-rings", "milan-us-medalists"],
  ["sb-halftime", "nba-50-playoff", "japanese-mlb", "fedex-dubai", "nfl-coaches-2026", "mlb-300sv", "dream-redeem"],
  ["la28-sports", "f1-teams-1990", "mlb-asg-mvp", "gg-shortstop", "cfb-coach-200", "mls-clubs", "nfl-100-td"],
  ["atp-top10-2000", "usmnt-50", "former-ballparks", "30-for-30", "preakness-belmont-2000", "motogp-champs", "nhl-50-goals-2000"],
  ["video-games", "skating-medalists", "track-events", "golden-spikes", "bundesliga-clubs", "never-won-title", "nascar-tracks"],
  ["football-films", "solheim-players", "olympic-tennis-1988", "uswnt-100", "us-flag-bearers", "college-stadium-75k", "real-barca"],
  ["finishers", "baseball-films", "mlb-asg-2026", "pga-events-2026", "nba-no1-pre2000", "gym-aa-women", "ucl-final-cities"],
  ["club-nicknames", "trophies", "cws-champs", "cycling-events", "pitch-types", "nfl-r1-2026", "ncaa-covers"],
  ["basketball-films", "stat-abbrevs", "winter-disciplines", "golf-brands", "bc-classic", "formations", "fifa-covers"],
  ["former-arenas", "pl-grounds", "naismith", "apparel", "combat-sports", "mlb-managers-2026", "walkoff-ws"],
];

export const BANKED: string[] = [];

export function promptsForSet(set: number): string[] {
  return DAYS[((set % DAYS.length) + DAYS.length) % DAYS.length];
}
