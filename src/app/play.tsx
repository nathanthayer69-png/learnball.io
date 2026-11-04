import type React from "react";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Chip, PixelButton, Scanlines } from "@/components/ui";
import { VenueMap } from "@/components/VenueMap";
import { promptById, promptsForSet } from "@/data/schedule";
import type { Prompt } from "@/data/types";
import { TIERS } from "@/data/types";
import {
  ANSWER_SECONDS,
  MAX_SCORE,
  UNLIMITED_PLAY,
  READ_SECONDS,
  REVEAL_MS,
  clearGame,
  gameNumber,
  loadGame,
  recordFinish,
  saveGame,
  shareText,
  titleForScore,
  todayET,
  totalScore,
  venueForScore,
  type PromptResult,
  type SavedGame,
} from "@/lib/game";
import { deepCuts, matchAnswer, type Answer } from "@/lib/match";
import { C, F } from "@/theme";

const freshGame = (day: string, set: number): SavedGame => ({
  day,
  set,
  promptIds: promptsForSet(set),
  index: 0,
  phase: "read",
  phaseStart: Date.now(),
  results: [],
  done: false,
});

/** Seconds until the next midnight in Eastern Time. */
function secondsToNextGame() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return 86400 - (get("hour") * 3600 + get("minute") * 60 + get("second"));
}

/** The question card. Memoized so the 10x-a-second clock never redraws it. */
const PromptCard = memo(function PromptCard({ prompt }: { prompt: Prompt }) {
  return (
    <View style={styles.card}>
      <Chip label={prompt.sport.toUpperCase()} color={C.border} />
      <Text style={styles.prompt}>{prompt.text}</Text>
      <Text style={styles.rule}>{prompt.rule}</Text>
    </View>
  );
});

export default function Play() {
  const router = useRouter();
  const params = useLocalSearchParams<{ reset?: string; set?: string }>();
  const day = todayET();
  const [game, setGame] = useState<SavedGame | null>(null);
  const [now, setNow] = useState(Date.now());
  const [input, setInput] = useState("");
  const [choices, setChoices] = useState<Answer[] | null>(null);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const submitting = useRef(false);
  const [wrong, setWrong] = useState<string[]>([]); // wrong guesses on this prompt
  const [notice, setNotice] = useState<string | null>(null);
  const shakeX = useRef(new Animated.Value(0)).current;

  const shake = useCallback(
    (message: string) => {
      setNotice(message);
      shakeX.setValue(0);
      Animated.sequence(
        [10, -10, 8, -8, 4, -4, 0].map((v) => Animated.timing(shakeX, { toValue: v, duration: 45, useNativeDriver: false })),
      ).start();
    },
    [shakeX],
  );

  // Load (or start) today's game
  useEffect(() => {
    (async () => {
      const daily = gameNumber(day) - 1;
      let saved = await loadGame(day);
      if (saved && !saved.promptIds) saved = { ...saved, set: 0, promptIds: promptsForSet(0) }; // older saves
      let g: SavedGame;
      const pick = Number(params.set);
      if (params.set && pick >= 1) {
        // Testing: jump straight to a chosen day (1-based)
        await clearGame(day);
        g = freshGame(day, pick - 1);
        await saveGame(g);
        router.setParams({ set: undefined });
      } else if (params.reset) {
        // Testing: each replay moves on to the next set of 7
        await clearGame(day);
        g = freshGame(day, (saved?.set ?? daily) + 1);
        await saveGame(g);
        router.setParams({ reset: undefined });
      } else if (saved) {
        g = saved;
      } else {
        g = freshGame(day, daily);
        await saveGame(g);
      }
      setGame(g);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, params.reset, params.set]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const prompts: Prompt[] = (game?.promptIds ?? []).map((id) => promptById(id)!).filter(Boolean);

  const update = useCallback((g: SavedGame) => {
    setGame(g);
    saveGame(g);
  }, []);

  const finish = useCallback(
    (result: PromptResult) => {
      if (!game || submitting.current) return;
      submitting.current = true;
      const results = [...game.results, result];
      const done = results.length >= game.promptIds.length;
      update({
        ...game,
        results,
        index: done ? game.index : game.index + 1,
        phase: "read",
        phaseStart: Date.now() + REVEAL_MS, // next read starts after the reveal
        done,
      });
      if (done) recordFinish(game.day);
      setInput("");
      setChoices(null);
      setWrong([]);
      setNotice(null);
      setTimeout(() => (submitting.current = false), 50);
    },
    [game, update],
  );

  const submit = useCallback(
    (text: string, timedOut = false) => {
      if (!game || game.done || game.phase !== "answer") return;
      const prompt = prompts[game.index];
      const r = matchAnswer(prompt, text);
      if (r.kind === "choose" && !timedOut) {
        setChoices(r.options);
        return;
      }
      if (r.kind === "hit") {
        finish({ promptId: prompt.id, input: text, name: r.answer.name, tier: r.answer.tier, points: r.points });
        return;
      }
      if (timedOut) {
        // Time's up: record the last thing they tried
        finish({ promptId: prompt.id, input: text.trim() || wrong[wrong.length - 1] || "", points: 0 });
        return;
      }
      // Wrong or empty: shake, keep the clock running, let them guess again
      if (r.kind === "empty") {
        shake("TYPE AN ANSWER FIRST");
        return;
      }
      setWrong((w) => [...w, text.trim()]);
      setInput("");
      shake("NOT ON THE LIST · KEEP GUESSING");
      setTimeout(() => inputRef.current?.focus(), 10);
    },
    [game, finish, shake, wrong, prompts],
  );

  const pick = (a: Answer) => {
    if (!game) return;
    finish({ promptId: prompts[game.index].id, input, name: a.name, tier: a.tier, points: TIERS[a.tier].points });
  };

  // Phase changes driven by the clock
  useEffect(() => {
    if (!game || game.done) return;
    const elapsed = now - game.phaseStart;
    if (game.phase === "read" && elapsed >= READ_SECONDS * 1000) {
      update({ ...game, phase: "answer", phaseStart: game.phaseStart + READ_SECONDS * 1000 });
      setTimeout(() => inputRef.current?.focus(), 30);
    } else if (game.phase === "answer" && elapsed >= ANSWER_SECONDS * 1000) {
      submit(input, true);
    }
  }, [now, game, input, submit, update]);

  if (!game) return <View style={{ flex: 1, backgroundColor: C.night }} />;

  const score = totalScore(game.results);
  const last = game.results[game.results.length - 1];
  const revealing = last && now < game.phaseStart;

  if (game.done && !revealing) {
    return <Results game={game} onHome={() => router.replace("/")} onReplay={() => router.replace("/play?reset=1")} />;
  }

  const prompt = revealing ? promptById(last.promptId)! : prompts[game.index];
  const elapsed = Math.max(0, now - game.phaseStart);
  const total = (game.phase === "read" ? READ_SECONDS : ANSWER_SECONDS) * 1000;
  const left = Math.max(0, total - elapsed);
  const reading = game.phase === "read" && !revealing;
  const answering = game.phase === "answer";

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Pressable onPress={() => router.replace("/")}>
              <Text style={styles.brand}>LEARNBALL</Text>
            </Pressable>
            <Text style={styles.topText}>
              PROMPT {Math.min(game.results.length + (revealing ? 0 : 1), prompts.length)}/{prompts.length}
            </Text>
            <Text style={styles.topText}>{score} PTS</Text>
          </View>

          <VenueMap score={score} />

          {/* Prompt */}
          <PromptCard prompt={prompt} />

          {revealing ? (
            <Reveal result={last} />
          ) : (
            <>
              {/* Timer */}
              <View style={styles.timerRow}>
                <Text style={[styles.timerLabel, { color: reading ? C.muted : left < 6000 ? C.red : C.text }]}>
                  {reading ? "GET READY…" : "ANSWER"}
                </Text>
                <Text style={[styles.timerLabel, { color: reading ? C.muted : left < 6000 ? C.red : C.text }]}>{Math.ceil(left / 1000)}s</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(left / total) * 100}%`, backgroundColor: reading ? C.dim : left < 6000 ? C.red : C.border },
                  ]}
                />
              </View>

              {/* Answer box */}
              <Animated.View
                style={[
                  styles.inputWrap,
                  !answering && { opacity: 0.45 },
                  notice && notice !== "TYPE AN ANSWER FIRST" && { borderColor: C.red },
                  { transform: [{ translateX: shakeX }] },
                ]}
              >
                <TextInput
                  ref={inputRef}
                  value={input}
                  onChangeText={(t) => {
                    setInput(t);
                    if (notice) setNotice(null);
                  }}
                  editable={answering}
                  placeholder={answering ? "type your answer…" : "locked while you read"}
                  placeholderTextColor={C.dim}
                  autoCapitalize="words"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  returnKeyType="go"
                  onSubmitEditing={() => submit(input)}
                  style={styles.input}
                />
              </Animated.View>

              {notice && <Text style={styles.notice}>✕ {notice}</Text>}
              {wrong.length > 0 && <Text style={styles.wrongList}>Tried: {wrong.join(" · ")}</Text>}

              {choices ? (
                <View style={{ marginTop: 14, gap: 10 }}>
                  <Text style={styles.chooseText}>WHICH ONE? (CLOCK'S STILL RUNNING)</Text>
                  {choices.map((a) => (
                    <PixelButton key={a.name} label={a.name.toUpperCase()} onPress={() => pick(a)} />
                  ))}
                </View>
              ) : (
                <PixelButton label="LOCK IT IN ▶" disabled={!answering} onPress={() => submit(input)} style={{ marginTop: 14 }} />
              )}
            </>
          )}
        </View>
      </ScrollView>
      <Scanlines />
    </View>
  );
}

function Reveal({ result }: { result: PromptResult }) {
  const tier = result.tier ? TIERS[result.tier] : null;
  const color = tier?.color ?? C.red;
  return (
    <View style={[styles.reveal, { borderColor: color, boxShadow: `0 0 18px ${color}55` }]}>
      <Text style={[styles.revealTier, { color }]}>
        {tier ? `${tier.emoji} ${tier.name.toUpperCase()}` : result.input.trim() ? "❌ NOT ON THE LIST" : "⏱ TIME'S UP"}
      </Text>
      <Text style={styles.revealName}>{result.name ?? (result.input.trim() || "No answer")}</Text>
      <Text style={[styles.revealPts, { color }]}>+{result.points}</Text>
    </View>
  );
}

function Results({ game, onHome, onReplay }: { game: SavedGame; onHome: () => void; onReplay: () => void }) {
  const [copied, setCopied] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const score = totalScore(game.results);
  const venue = venueForScore(score);
  const s = secondsToNextGame();
  const next = `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;

  const copy = async () => {
    await Clipboard.setStringAsync(shareText(game.day, game.results));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.inner}>
          <Text style={styles.brandCenter}>LEARNBALL #{gameNumber(game.day)}</Text>
          <Text style={styles.resultTitle}>{titleForScore(score).toUpperCase()}</Text>
          <Text style={styles.resultScore}>
            {score}
            <Text style={{ color: C.muted, fontSize: 18 }}> / {MAX_SCORE}</Text>
          </Text>
          <Text style={styles.resultVenue}>
            You made it to the {venue.name} {venue.emoji}
          </Text>

          <View style={{ marginTop: 18 }}>
            <VenueMap score={score} showLabels={false} />
          </View>

          <PixelButton big label={copied ? "COPIED! ✓" : "COPY RESULT"} onPress={copy} style={{ marginTop: 22 }} />
          {UNLIMITED_PLAY && <PixelButton label="▶ PLAY AGAIN" onPress={onReplay} style={{ marginTop: 12 }} />}

          <View style={{ marginTop: 24, gap: 12 }}>
            {game.results.map((r, i) => {
              const prompt = promptById(r.promptId)!;
              const tier = r.tier ? TIERS[r.tier] : null;
              return (
                <View key={r.promptId} style={styles.row}>
                  <Text style={styles.rowPrompt}>
                    {i + 1}. {prompt.text}
                  </Text>
                  <View style={styles.rowLine}>
                    <Text style={styles.rowAnswer}>{r.name ?? (r.input.trim() || "No answer")}</Text>
                    <Text style={[styles.rowTier, { color: tier?.color ?? C.red }]}>
                      {tier ? `${tier.emoji} ${tier.name}` : "❌ Miss"} · {r.points}
                    </Text>
                  </View>
                  <Text style={styles.rowCuts}>Deep cuts: {deepCuts(prompt, 3, r.name).join(", ")}</Text>
                </View>
              );
            })}
          </View>

          {!UNLIMITED_PLAY && <Text style={styles.nextGame}>NEXT GAME IN {next}</Text>}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
            <PixelButton label="◀ HOME" onPress={onHome} style={{ flex: 1 }} />
            {UNLIMITED_PLAY && <PixelButton label="PLAY AGAIN ▶" onPress={onReplay} style={{ flex: 1 }} />}
          </View>
        </View>
      </ScrollView>
      <Scanlines />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48 },
  inner: { width: "100%", maxWidth: 720, alignSelf: "center" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  brand: { fontFamily: F.pixel, fontSize: 12, color: C.border, letterSpacing: 2 },
  topText: { fontFamily: F.pixel, fontSize: 10, color: C.muted, letterSpacing: 1 },
  card: { marginTop: 22, padding: 18, borderWidth: 3, borderColor: C.dim, backgroundColor: C.panel, gap: 14 },
  prompt: { fontFamily: F.pixel, fontSize: 20, lineHeight: 32, color: C.text },
  rule: { fontFamily: F.mono, fontSize: 20, color: C.muted },
  timerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 22, marginBottom: 8 },
  timerLabel: { fontFamily: F.pixel, fontSize: 11, letterSpacing: 2 },
  barTrack: { height: 14, borderWidth: 2, borderColor: C.dim, backgroundColor: "#0b1328" },
  barFill: { height: "100%" },
  inputWrap: { marginTop: 18, borderWidth: 3, borderColor: C.border, backgroundColor: "#0b1328" },
  input: { fontFamily: F.mono, fontSize: 30, color: C.text, paddingHorizontal: 14, paddingVertical: 10, outlineStyle: "none" } as any,
  notice: { fontFamily: F.pixel, fontSize: 10, color: C.red, letterSpacing: 1, marginTop: 10 },
  wrongList: { fontFamily: F.mono, fontSize: 18, color: C.dim, marginTop: 6, textDecorationLine: "line-through" },
  chooseText: { fontFamily: F.pixel, fontSize: 10, color: C.border, letterSpacing: 1 },
  reveal: { marginTop: 22, padding: 22, borderWidth: 4, backgroundColor: C.panel, alignItems: "center", gap: 12 },
  revealTier: { fontFamily: F.pixel, fontSize: 14, letterSpacing: 2, textAlign: "center" },
  revealName: { fontFamily: F.mono, fontSize: 34, color: C.text, textAlign: "center" },
  revealPts: { fontFamily: F.pixel, fontSize: 22 },
  brandCenter: { fontFamily: F.pixel, fontSize: 11, color: C.border, letterSpacing: 3, textAlign: "center", marginTop: 8 },
  resultTitle: { fontFamily: F.pixel, fontSize: 24, lineHeight: 36, color: C.text, textAlign: "center", marginTop: 18 },
  resultScore: { fontFamily: F.pixel, fontSize: 36, color: C.border, textAlign: "center", marginTop: 14 },
  resultVenue: { fontFamily: F.mono, fontSize: 22, color: C.muted, textAlign: "center", marginTop: 10 },
  row: { padding: 14, borderWidth: 2, borderColor: C.dim, backgroundColor: C.panel, gap: 6 },
  rowPrompt: { fontFamily: F.mono, fontSize: 19, color: C.muted },
  rowLine: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  rowAnswer: { fontFamily: F.mono, fontSize: 24, color: C.text },
  rowTier: { fontFamily: F.mono, fontSize: 21 },
  rowCuts: { fontFamily: F.mono, fontSize: 18, color: C.dim },
  nextGame: { fontFamily: F.pixel, fontSize: 10, color: C.muted, textAlign: "center", marginTop: 28, letterSpacing: 2 },
});
