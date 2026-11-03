export type TierId = "casual" | "fan" | "film" | "diehard" | "cbk";

export type Tier = {
  id: TierId;
  name: string;
  points: number;
  emoji: string;
  color: string;
};

export const TIERS: Record<TierId, Tier> = {
  casual: { id: "casual", name: "Casual", points: 10, emoji: "⚪", color: "#c9d1dc" },
  fan: { id: "fan", name: "Fan", points: 30, emoji: "🔵", color: "#4da3ff" },
  film: { id: "film", name: "Film Watcher", points: 60, emoji: "🟢", color: "#3ddc84" },
  diehard: { id: "diehard", name: "Die Hard", points: 85, emoji: "🟠", color: "#ff9a3c" },
  cbk: { id: "cbk", name: "Certified Ball Knower", points: 100, emoji: "🏆", color: "#ffd23f" },
};

export const TIER_ORDER: TierId[] = ["casual", "fan", "film", "diehard", "cbk"];

/**
 * One prompt. Each answer is a string: "Canonical Name|alias|alias".
 * Last names are matched automatically when only one answer has that last name,
 * so aliases are only needed for nicknames and short forms ("Pep", "RG3").
 */
export type Prompt = {
  id: string;
  sport: string;
  text: string;
  rule: string;
  /** Also accept a venue's first word when it's unique ("Fenway", "Oakmont"). */
  matchFirstWord?: boolean;
  answers: Record<TierId, string[]>;
};
