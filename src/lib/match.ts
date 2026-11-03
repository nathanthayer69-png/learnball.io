import { TIERS, TIER_ORDER, type Prompt, type TierId } from "@/data/types";

export type Answer = {
  name: string; // canonical, shown to players
  tier: TierId;
  keys: string[]; // full name + aliases, normalized
  surname: string; // normalized last name
};

export type MatchResult =
  | { kind: "hit"; answer: Answer; points: number }
  | { kind: "choose"; options: Answer[] } // surname shared by several answers
  | { kind: "miss" }
  | { kind: "empty" };

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

/** "José María Olazábal Jr." -> ["jose", "maria", "olazabal"] */
function words(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/['’.]/g, "") // O'Neil -> oneil, J.J. -> jj
    .replace(/[^a-z0-9]+/g, " ") // hyphens and other punctuation -> space
    .trim()
    .split(" ")
    .filter((w) => w && !SUFFIXES.has(w));
}

export const normalize = (s: string) => words(s).join("");

function surnameOf(name: string): string {
  const w = words(name);
  return w[w.length - 1] ?? "";
}

/** Build the lookup list for one prompt (cached per prompt id). */
const cache = new Map<string, Answer[]>();
export function answersFor(prompt: Prompt): Answer[] {
  const hit = cache.get(prompt.id);
  if (hit) return hit;
  const list: Answer[] = [];
  for (const tier of TIER_ORDER) {
    for (const line of prompt.answers[tier]) {
      const [name, ...aliases] = line.split("|").map((s) => s.trim());
      list.push({
        name,
        tier,
        keys: [name, ...aliases].map(normalize).filter(Boolean),
        surname: surnameOf(name),
      });
    }
  }
  cache.set(prompt.id, list);
  return list;
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** How many typos we forgive: none under 5 letters, 1 up to 8, 2 beyond. */
function allowedTypos(len: number) {
  if (len < 5) return 0;
  if (len <= 8) return 1;
  return 2;
}

const hit = (answer: Answer): MatchResult => ({
  kind: "hit",
  answer,
  points: TIERS[answer.tier].points,
});

export function matchAnswer(prompt: Prompt, raw: string): MatchResult {
  const input = normalize(raw);
  if (!input) return { kind: "empty" };
  const list = answersFor(prompt);

  // 1. Exact full name or alias
  const exact = list.find((a) => a.keys.includes(input));
  if (exact) return hit(exact);

  // 2. Last name only
  const bySurname = list.filter((a) => a.surname === input);
  if (bySurname.length === 1) return hit(bySurname[0]);
  if (bySurname.length > 1) return { kind: "choose", options: bySurname };

  // 3. Small typos, against full names, aliases and unique last names
  const limit = allowedTypos(input.length);
  if (limit === 0) return { kind: "miss" };

  const surnameCount = new Map<string, number>();
  for (const a of list) surnameCount.set(a.surname, (surnameCount.get(a.surname) ?? 0) + 1);

  let best: Answer[] = [];
  let bestDist = limit + 1;
  for (const a of list) {
    const targets = [...a.keys];
    if (surnameCount.get(a.surname) === 1 && a.surname.length >= 5) targets.push(a.surname);
    const d = Math.min(...targets.map((t) => editDistance(input, t)));
    if (d < bestDist) {
      bestDist = d;
      best = [a];
    } else if (d === bestDist && !best.includes(a)) {
      best.push(a);
    }
  }
  if (best.length === 1 && bestDist <= limit) return hit(best[0]);
  if (best.length > 1 && bestDist <= limit) return { kind: "choose", options: best.slice(0, 4) };
  return { kind: "miss" };
}

/** A few of the best deep cuts to show on the results screen. */
export function deepCuts(prompt: Prompt, n = 3, exclude?: string): string[] {
  const names = [...prompt.answers.cbk, ...prompt.answers.diehard].map((l) => l.split("|")[0]);
  return names.filter((name) => name !== exclude).slice(0, n);
}
