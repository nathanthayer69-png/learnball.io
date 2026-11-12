import type React from "react";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppActions } from "@/components/AppActions";
import { Climb } from "@/components/Climb";
import { Chip, PixelButton, Scanlines, SoundToggles } from "@/components/ui";
import { promptById, promptsForSet } from "@/data/schedule";
import type { Prompt } from "@/data/types";
import { TIERS, TIER_ORDER } from "@/data/types";
import { buzz, music, sfx } from "@/lib/audio";
import { cloudEnabled, fetchRank, logGuess, reportAnswer, submitPlay, type Rank } from "@/lib/cloud";
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
  recordPlay,
  saveGame,
  shareText,
  titleForScore,
  todayET,
  dayForGame,
  totalScore,
  levelForScore,
  levelIndexForScore,
  type PromptResult,
  type SavedGame,
} from "@/lib/game";
import { deepCuts, matchAnswer, type Answer } from "@/lib/match";
import { C, F } from "@/theme";

/**
 * Soft-keyboard coverage on mobile web (RN Web's KeyboardAvoidingView is a no-op).
 * Uses visualViewport so the answer field stays above the keyboard / browser chrome.
 */
function useWebKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    sync();
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);
  return inset;
}

const freshGame = (day: string, set: number, archive?: number): SavedGame => ({
  archive,
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
  const params = useLocalSearchParams<{ reset?: string; set?: string; archive?: string }>();
  const archiveN = Number(params.archive) || 0;
  const day = todayET();
  const insets = useSafeAreaInsets();
  const webKeyboardInset = useWebKeyboardInset();
  const [game, setGame] = useState<SavedGame | null>(null);
  const [now, setNow] = useState(Date.now());
  const [input, setInput] = useState("");
  const [choices, setChoices] = useState<Answer[] | null>(null);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const submitting = useRef(false);
  const [wrong, setWrong] = useState<string[]>([]); // wrong guesses on this prompt
  const [notice, setNotice] = useState<string | null>(null);
  const shakeX = useRef(new Animated.Value(0)).current;
  const [missKey, setMissKey] = useState(0);
  const lastSecond = useRef(-1);
  const { width } = useWindowDimensions();

  const keepAnswerVisible = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

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
      if (archiveN >= 1 && (archiveN < gameNumber(day) || UNLIMITED_PLAY)) {
        // A past game from the archive: its own save slot, never counts toward streaks or rankings
        const aday = dayForGame(archiveN);
        let ag = await loadGame(aday, archiveN);
        if (!ag) {
          ag = freshGame(aday, archiveN - 1, archiveN);
          await saveGame(ag);
        }
        setGame(ag);
        return;
      }
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
        // Replay today's game. Test mode advances to the next set of 7; otherwise same daily puzzle.
        await clearGame(day);
        const set = UNLIMITED_PLAY ? (saved?.set ?? daily) + 1 : (saved?.set ?? daily);
        g = freshGame(day, set);
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
  }, [day, params.reset, params.set, params.archive]);

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
      if (done && !game.archive) {
        recordFinish(game.day);
        const final = totalScore(results);
        recordPlay(game.day, final);
        submitPlay({ day: game.day, game: gameNumber(game.day), set: game.set, score: final, results, test: UNLIMITED_PLAY });
      }
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
      if (r.kind !== "choose" && r.kind !== "empty")
        logGuess({ day: game.day, promptId: prompt.id, guess: text, matched: r.kind === "hit" ? r.answer.name : undefined, tier: r.kind === "hit" ? r.answer.tier : undefined, test: UNLIMITED_PLAY });
      if (r.kind === "choose" && !timedOut) {
        sfx.choose();
        setChoices(r.options);
        return;
      }
      if (r.kind === "hit") {
        sfx.hit(TIER_ORDER.indexOf(r.answer.tier));
        buzz(25);
        finish({ promptId: prompt.id, input: text, name: r.answer.name, tier: r.answer.tier, points: r.points });
        return;
      }
      if (timedOut) {
        // Time's up: record the last thing they tried
        sfx.timesUp();
        buzz([60, 40, 60]);
        setMissKey((k) => k + 1);
        finish({ promptId: prompt.id, input: text.trim() || wrong[wrong.length - 1] || "", points: 0 });
        return;
      }
      // Wrong or empty: shake, keep the clock running, let them guess again
      if (r.kind === "empty") {
        shake("TYPE AN ANSWER FIRST");
        return;
      }
      sfx.wrong();
      buzz([35, 30, 35]);
      setMissKey((k) => k + 1);
      setWrong((w) => [...w, text.trim()]);
      setInput("");
      shake("NOT ON THE LIST · KEEP GUESSING");
      setTimeout(() => inputRef.current?.focus(), 10);
    },
    [game, finish, shake, wrong, prompts],
  );

  const pick = (a: Answer) => {
    if (!game) return;
    sfx.hit(TIER_ORDER.indexOf(a.tier));
    buzz(25);
    logGuess({ day: game.day, promptId: prompts[game.index].id, guess: input, matched: a.name, tier: a.tier, test: UNLIMITED_PLAY });
    finish({ promptId: prompts[game.index].id, input, name: a.name, tier: a.tier, points: TIERS[a.tier].points });
  };

  // Phase changes driven by the clock
  useEffect(() => {
    if (!game || game.done) return;
    const elapsed = now - game.phaseStart;
    // Countdown ticks: last 3 seconds of reading, last 5 of answering
    const secLeft = Math.ceil(((game.phase === "read" ? READ_SECONDS : ANSWER_SECONDS) * 1000 - elapsed) / 1000);
    if (elapsed >= 0 && secLeft !== lastSecond.current) {
      lastSecond.current = secLeft;
      if (game.phase === "read" && secLeft >= 1 && secLeft <= 3) sfx.tick(false);
      if (game.phase === "answer" && secLeft >= 1 && secLeft <= 5) sfx.tick(true);
    }
    if (game.phase === "read" && elapsed >= READ_SECONDS * 1000) {
      sfx.go();
      update({ ...game, phase: "answer", phaseStart: game.phaseStart + READ_SECONDS * 1000 });
      setTimeout(() => {
        inputRef.current?.focus();
        keepAnswerVisible();
      }, 30);
    } else if (game.phase === "answer" && elapsed >= ANSWER_SECONDS * 1000) {
      submit(input, true);
    }
  }, [now, game, input, submit, update, keepAnswerVisible]);

  const score = game ? totalScore(game.results) : 0;
  const last = game?.results[game.results.length - 1];
  const revealing = !!last && !!game && now < game.phaseStart;
  const answeringNow = !!game && !game.done && game.phase === "answer" && !revealing;

  // Mobile web: when the visual viewport shrinks under the keyboard, re-scroll the field into view.
  useEffect(() => {
    if (answeringNow && webKeyboardInset > 0) keepAnswerVisible();
  }, [answeringNow, webKeyboardInset, keepAnswerVisible]);

  // Music: plays while you read and during reveals, goes quiet while you type
  useEffect(() => {
    if (!game || (game.done && !revealing)) return;
    music.setLevel(levelIndexForScore(score));
    music.setMode(answeringNow ? "answer" : "game");
  }, [game, answeringNow, revealing, score]);

  if (!game) return <View style={{ flex: 1, backgroundColor: C.night }} />;

  if (game.done && !revealing) {
    return <Results
        game={game}
        onHome={() => router.replace("/")}
        onReplay={() => router.replace("/play?reset=1")}
        onStats={() => router.push(game.archive ? "/archive" : "/stats")}
      />;
  }

  const prompt = revealing ? promptById(last.promptId)! : prompts[game.index];
  const elapsed = Math.max(0, now - game.phaseStart);
  const total = (game.phase === "read" ? READ_SECONDS : ANSWER_SECONDS) * 1000;
  const left = Math.max(0, total - elapsed);
  const reading = game.phase === "read" && !revealing;
  const answering = game.phase === "answer";

  return (
    // Expo SDK 58: behavior="padding" on both platforms (Android is edge-to-edge and no longer resizes).
    // On web, KeyboardAvoidingView is a no-op — webKeyboardInset + scroll cover that path.
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.night }} behavior="padding">
      <View style={{ flex: 1, paddingBottom: webKeyboardInset }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.page,
            {
              paddingTop: Math.max(24, insets.top + 8),
              paddingBottom: Math.max(48, insets.bottom + 24),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.inner}>
            {/* Top bar */}
            <View style={styles.topBar}>
              <Pressable onPress={() => router.replace("/")}>
                <Text style={styles.brand}>LEARNBALL</Text>
              </Pressable>
              <Text style={styles.topText}>
                {width < 600 ? "Q" : "PROMPT "}
                {Math.min(game.results.length + (revealing ? 0 : 1), prompts.length)}/{prompts.length}
              </Text>
              <Text style={styles.topText}>{score} PTS</Text>
              <SoundToggles />
            </View>

            <Climb score={score} height={width < 600 ? 140 : 180} missKey={missKey} onLevelUp={(l) => sfx.levelUp(l)} />

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
                    onFocus={keepAnswerVisible}
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
      </View>
      <Scanlines />
    </KeyboardAvoidingView>
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

function Results({ game, onHome, onReplay, onStats }: { game: SavedGame; onHome: () => void; onReplay: () => void; onStats: () => void }) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const [rank, setRank] = useState<Rank | null>(null);
  const [reported, setReported] = useState<Record<string, boolean>>({});
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const score = totalScore(game.results);
  const level = levelForScore(score);
  const [replayKey, setReplayKey] = useState(0);
  const totals = game.results.reduce<number[]>((acc, r) => [...acc, (acc[acc.length - 1] ?? 0) + r.points], []);
  useEffect(() => {
    music.setLevel(levelIndexForScore(score));
    music.setMode("results");
    sfx.finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const s = secondsToNextGame();
  const next = `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;

  useEffect(() => {
    if (cloudEnabled && !game.archive) {
      // give our own score a moment to land first
      const t = setTimeout(() => fetchRank(game.day, score).then(setRank), 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const text = shareText(game.day, game.results, rank) + (game.archive ? "\n(played from the archive)" : "");
  const canShare = typeof navigator !== "undefined" && !!(navigator as any).share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const share = async () => {
    sfx.click();
    if (canShare) {
      try {
        await (navigator as any).share({ text });
        return;
      } catch {
        // cancelled: fall through to copy
      }
    }
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          {
            paddingTop: Math.max(24, insets.top + 8),
            paddingBottom: Math.max(48, insets.bottom + 24),
          },
        ]}
      >
        <View style={styles.inner}>
          <Text style={styles.brandCenter}>
            LEARNBALL #{gameNumber(game.day)}
            {game.archive ? " · ARCHIVE" : ""}
          </Text>
          <Text style={styles.resultTitle}>{titleForScore(score).toUpperCase()}</Text>
          <Text style={styles.resultScore}>
            {score}
            <Text style={{ color: C.muted, fontSize: 18 }}> / {MAX_SCORE}</Text>
          </Text>
          <Text style={styles.resultVenue}>
            You made it to {level.id === "pros" ? "the Pros" : level.id === "hall" ? "the Hall of Fame" : level.name} {level.emoji}
          </Text>

          <View style={{ marginTop: 18 }}>
            <Climb key={replayKey} score={score} height={300} replay={totals} counter onLevelUp={(l) => sfx.levelUp(l)} />
            <Pressable onPress={() => setReplayKey((k) => k + 1)} style={{ alignSelf: "center", marginTop: 10 }}>
              <Text style={styles.replayLink}>↻ WATCH THE CLIMB AGAIN</Text>
            </Pressable>
          </View>

          {rank && (
            <Text style={styles.rank}>
              {rank.players < 10 ? `ONE OF THE FIRST ${rank.players} PLAYERS TODAY` : `TOP ${rank.topPct}% OF ${rank.players.toLocaleString()} PLAYERS TODAY`}
            </Text>
          )}

          <PixelButton big label={copied ? "COPIED! ✓" : canShare ? "SHARE RESULT" : "COPY RESULT"} onPress={share} style={{ marginTop: 22 }} />
          <AppActions compact />
          {!game.archive && <PixelButton label="▶ PLAY AGAIN" onPress={onReplay} style={{ marginTop: 12 }} />}

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
                  {!r.tier && r.input.trim() !== "" && cloudEnabled && (
                    <Pressable
                      disabled={reported[r.promptId]}
                      onPress={() => {
                        reportAnswer({ day: game.day, promptId: r.promptId, guess: r.input });
                        setReported((m) => ({ ...m, [r.promptId]: true }));
                      }}
                    >
                      <Text style={styles.report}>{reported[r.promptId] ? "✓ THANKS, WE'LL CHECK IT" : `⚑ "${r.input.trim()}" SHOULD COUNT?`}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          {!game.archive && <Text style={styles.nextGame}>NEW PUZZLE IN {next}</Text>}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
            <PixelButton label="◀ HOME" onPress={onHome} style={{ flex: 1 }} />
            <PixelButton label={game.archive ? "ARCHIVE" : "STATS"} onPress={onStats} style={{ flex: 1 }} />
            {!game.archive && <PixelButton label="PLAY AGAIN ▶" onPress={onReplay} style={{ flex: 1 }} />}
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
  topBar: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", rowGap: 10, columnGap: 12, marginBottom: 16 },
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
  rank: { fontFamily: F.pixel, fontSize: 10, color: C.green, textAlign: "center", marginTop: 16, letterSpacing: 1, lineHeight: 16 },
  report: { fontFamily: F.pixel, fontSize: 8, color: C.muted, letterSpacing: 1, marginTop: 4, lineHeight: 14 },
  replayLink: { fontFamily: F.pixel, fontSize: 9, color: C.muted, letterSpacing: 2 },
  nextGame: { fontFamily: F.pixel, fontSize: 10, color: C.muted, textAlign: "center", marginTop: 28, letterSpacing: 2 },
});
