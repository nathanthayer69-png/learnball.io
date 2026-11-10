/**
 * The climb: a football player runs up the stands from the Backyard to the Hall of Fame.
 * Each level is a stack of stairs in its own stadium. Points move the runner up step by step.
 * Drawn entirely with plain Views (pixel art), animated with React Native's Animated.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";

import { sfx } from "@/lib/audio";
import { LEVELS, MAX_SCORE, levelIndexForScore } from "@/lib/game";
import { C, F } from "@/theme";

const BAND = 150; // world height of one level
const STEPS_PER_LEVEL = 7;
const PX = 3; // runner pixel size
const RUNNER_W = 12 * PX;
const RUNNER_H = 13 * PX;
const MARGIN = 26;
const WORLD_H = BAND * LEVELS.length;

// ---------- Runner sprite ----------

const PAL: Record<string, string> = {
  H: "#ff7a2f", // helmet
  h: "#c95a1c", // helmet shade
  M: "#d9dee6", // facemask
  S: "#e2a774", // skin
  J: "#2f6bff", // jersey
  W: "#ffffff", // number
  B: "#8b4a22", // football
  P: "#f3f1ea", // pants
  K: "#1b1b22", // cleats
};
const TOP = [
  "....HHHH....",
  "...HHHHHH...",
  "..hHHHHHMM..",
  "..hHHHSSMS..",
  "...hHSSSM...",
  "..JJJJJJJ...",
  ".JJJWWJJJJ..",
  ".SJJWWJJBBS.",
  "..JJJJJJBB..",
  "..PPPPPPP...",
];
const LEGS_A = ["..PP....PP..", ".PP......PP.", ".KK......KK."];
const LEGS_B = ["...PP..PP...", "...PP..PP...", "...KK..KK..."];

const Sprite = memo(function Sprite({ frame }: { frame: 0 | 1 }) {
  const rows = [...TOP, ...(frame ? LEGS_B : LEGS_A)];
  return (
    <View style={{ width: RUNNER_W, height: RUNNER_H }}>
      {rows.map((row, y) => (
        <View key={y} style={{ flexDirection: "row", height: PX }}>
          {row.split("").map((ch, x) => (
            <View key={x} style={{ width: PX, height: PX, backgroundColor: PAL[ch] ?? "transparent" }} />
          ))}
        </View>
      ))}
    </View>
  );
});

// ---------- Path: where the runner stands for any score ----------

type Key = { pts: number; x: number; y: number };

/** Stairs run left→right, then right→left, switching back each level. Hall of Fame is flat gold turf. */
function buildPath(width: number): Key[] {
  const keys: Key[] = [];
  const left = MARGIN;
  const right = width - MARGIN - RUNNER_W;
  LEVELS.forEach((lv, i) => {
    const bottom = WORLD_H - i * BAND - 6; // feet y at the start of this level
    const dirRight = i % 2 === 0;
    const xAt = (f: number) => (dirRight ? left + f * (right - left) : right - f * (right - left));
    if (lv.id === "hall") {
      keys.push({ pts: lv.start, x: xAt(0), y: bottom });
      keys.push({ pts: MAX_SCORE, x: xAt(0.5), y: bottom });
      return;
    }
    const n = STEPS_PER_LEVEL;
    const size = (lv.end - lv.start) / n;
    const rise = BAND / n;
    for (let k = 0; k < n; k++) {
      const p = lv.start + k * size;
      keys.push({ pts: p, x: xAt(k / n), y: bottom - k * rise });
      keys.push({ pts: p + size * 0.7, x: xAt((k + 0.7) / n), y: bottom - k * rise });
    }
  });
  return keys;
}

/** How many stairs are behind you at this score (for footstep sounds). */
function stepIndex(score: number): number {
  let n = 0;
  for (const lv of LEVELS) {
    if (lv.id === "hall") break;
    const size = (lv.end - lv.start) / STEPS_PER_LEVEL;
    n += Math.max(0, Math.min(STEPS_PER_LEVEL, Math.floor((score - lv.start) / size)));
  }
  return n;
}

// ---------- Scenery for each level ----------

function Dots({ rows, cols, colors, top, density = 0.75 }: { rows: number; cols: number; colors: string[]; top: number; density?: number }) {
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top }}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 4 }}>
          {Array.from({ length: cols }, (_, c) => (
            <View
              key={c}
              style={{
                width: 4,
                height: 4,
                backgroundColor: colors[(c * 7 + r * 3) % colors.length],
                opacity: ((c * 13 + r * 5) % 100) / 100 < density ? 0.85 : 0.15,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const STAIRS: Record<string, [string, string]> = {
  backyard: ["#8b5a2b", "#b98048"],
  highschool: ["#7d8899", "#c9d1dc"],
  college: ["#5c616d", "#8d929e"],
  pros: ["#22489e", "#4d7cf0"],
  allstar: ["#8f0f27", "#e0314f"],
};

function Scenery({ id, width }: { id: string; width: number }) {
  switch (id) {
    case "backyard":
      return (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#69b4f5" }} />
          <View style={{ position: "absolute", right: 30, top: 16, width: 22, height: 22, backgroundColor: "#ffe27a" }} />
          <View style={{ position: "absolute", left: 40, top: 26, width: 46, height: 10, backgroundColor: "#eaf4ff" }} />
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 18, height: 46, backgroundColor: "#a8733f", flexDirection: "row" }}>
            {Array.from({ length: Math.ceil(width / 14) }, (_, i) => (
              <View key={i} style={{ width: 14, borderRightWidth: 2, borderColor: "#7a5029" }} />
            ))}
          </View>
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 18, backgroundColor: "#3fa34d" }} />
          {/* trash-can hoop */}
          <View style={{ position: "absolute", right: 18, bottom: 18, width: 18, height: 24, backgroundColor: "#7f8a99", borderTopWidth: 3, borderColor: "#b9c2cf" }} />
        </>
      );
    case "highschool":
      return (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#28407e" }} />
          <View style={{ position: "absolute", left: 18, top: 14, width: 30, height: 12, backgroundColor: "#fff3c2", boxShadow: "0 0 18px 8px rgba(255,236,170,0.35)" }} />
          <View style={{ position: "absolute", left: 31, top: 26, width: 4, height: 110, backgroundColor: "#1a2856" }} />
          <View style={{ position: "absolute", right: 22, top: 18, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: "#111", borderWidth: 2, borderColor: "#444" }}>
            <Text style={{ fontFamily: F.pixel, fontSize: 7, color: "#ff4d5e" }}>HOME 07</Text>
          </View>
          <Dots rows={2} cols={18} colors={["#f3f1ea", "#ffb547", "#93a0b8"]} top={70} density={0.4} />
        </>
      );
    case "college":
      return (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#151f46" }} />
          <Dots rows={6} cols={30} colors={["#c8102e", "#f3f1ea", "#c8102e", "#ffd23f"]} top={12} density={0.8} />
          {[0.2, 0.5, 0.8].map((f, i) => (
            <View key={i} style={{ position: "absolute", left: f * width, top: 72, width: 0, height: 0, borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 22, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: i === 1 ? "#ffd23f" : "#c8102e" }} />
          ))}
        </>
      );
    case "pros":
      return (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0a0f25" }} />
          <View style={{ position: "absolute", left: width / 2 - 40, top: 10, width: 80, height: 34, backgroundColor: "#06122e", borderWidth: 3, borderColor: "#4d7cf0", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(77,124,240,0.6)" }}>
            <Text style={{ fontFamily: F.pixel, fontSize: 9, color: "#ffd23f" }}>LEARN</Text>
          </View>
          <Dots rows={5} cols={34} colors={["#4da3ff", "#f3f1ea", "#ff7a2f", "#3ddc84", "#ffd23f"]} top={54} density={0.9} />
        </>
      );
    case "allstar":
      return (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#1c0f38" }} />
          {[0.15, 0.45, 0.75].map((f, i) => (
            <View key={i} style={{ position: "absolute", left: f * width, top: -20, width: 34, height: 170, backgroundColor: "rgba(255,246,200,0.13)", transform: [{ rotate: `${i % 2 ? 18 : -18}deg` }] }} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <View key={i} style={{ position: "absolute", left: ((i * 41) % 97) / 100 * width, top: (i * 29) % 90 + 6, width: i % 3 ? 3 : 5, height: i % 3 ? 3 : 5, backgroundColor: "#fff6c8" }} />
          ))}
          <Dots rows={2} cols={30} colors={["#f3f1ea", "#ff9ad5", "#ffd23f"]} top={100} density={0.5} />
        </>
      );
    case "hall":
      return (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#2e2104" }} />
          {[0.08, 0.3, 0.62, 0.84].map((f, i) => (
            <View key={i} style={{ position: "absolute", left: f * width, top: 30, width: 14, height: 84, backgroundColor: "#b8901c", borderLeftWidth: 3, borderColor: "#ffd23f" }} />
          ))}
          <View style={{ position: "absolute", left: 0, right: 0, top: 18, height: 12, backgroundColor: "#ffd23f" }} />
          <Text style={{ position: "absolute", left: 0, right: 0, top: 44, textAlign: "center", fontFamily: F.pixel, fontSize: 11, color: "#ffe27a", letterSpacing: 3 }}>HALL OF FAME</Text>
          <Text style={{ position: "absolute", left: 0, right: 0, top: 62, textAlign: "center", fontSize: 22 }}>🏆</Text>
          {/* the gold field */}
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 36, backgroundColor: "#c9a227", borderTopWidth: 3, borderColor: "#ffe27a", flexDirection: "row", justifyContent: "space-evenly" }}>
            {Array.from({ length: 9 }, (_, i) => (
              <View key={i} style={{ width: 2, height: "100%", backgroundColor: "rgba(255,246,200,0.7)" }} />
            ))}
          </View>
        </>
      );
  }
  return null;
}

/** One level: its stadium, its stairs, and its sign. Drawn once per width. */
const LevelBand = memo(function LevelBand({ index, width, path }: { index: number; width: number; path: Key[] }) {
  const lv = LEVELS[index];
  const top = WORLD_H - (index + 1) * BAND;
  const colors = STAIRS[lv.id];
  const steps = colors ? path.filter((k, i) => i % 2 === 0 && k.pts >= lv.start && k.pts < lv.end) : [];
  const dirRight = index % 2 === 0;
  const stepW = steps.length > 1 ? Math.abs(steps[1].x - steps[0].x) : 0;
  return (
    <View style={{ position: "absolute", left: 0, top, width, height: BAND, overflow: "hidden" }}>
      <Scenery id={lv.id} width={width} />
      {steps.map((k, i) => {
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: dirRight ? k.x - 4 : k.x - stepW - 4,
              width: stepW + RUNNER_W + 8,
              top: k.y - top,
              height: BAND / steps.length + 8,
              backgroundColor: colors[0],
              borderTopWidth: 4,
              borderColor: colors[1],
            }}
          />
        );
      })}
      <View style={{ position: "absolute", [dirRight ? "left" : "right"]: 6, top: 6, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 5, paddingVertical: 3 }}>
        <Text style={{ fontFamily: F.pixel, fontSize: 7, color: "#f3f1ea", letterSpacing: 1 }}>
          LVL {index + 1} · {lv.name.toUpperCase()}
        </Text>
      </View>
    </View>
  );
});

// ---------- The climb ----------

export type ClimbProps = {
  /** Points scored so far. The runner climbs to it. */
  score: number;
  /** Height of the window onto the stadium. */
  height: number;
  /** Bump this to make the runner slip (a wrong guess). */
  missKey?: number;
  /** Results replay: climb from 0 through each running total, pausing between answers. */
  replay?: number[];
  /** Show a points counter in the corner (results replay). */
  counter?: boolean;
  /** Called when the runner reaches a new level (not on first draw). */
  onLevelUp?: (level: number) => void;
};

export const Climb = memo(function Climb({ score, height, missKey = 0, replay, counter, onLevelUp }: ClimbProps) {
  const [width, setWidth] = useState(0);
  const path = useMemo(() => (width ? buildPath(width) : []), [width]);
  const progress = useRef(new Animated.Value(replay ? 0 : Math.min(score, MAX_SCORE))).current;
  const current = useRef(replay ? 0 : Math.min(score, MAX_SCORE));
  const slip = useRef(new Animated.Value(0)).current;
  const banner = useRef(new Animated.Value(0)).current;
  const [frame, setFrame] = useState<0 | 1>(0);
  const [facing, setFacing] = useState(1);
  const [shown, setShown] = useState(replay ? 0 : Math.min(score, MAX_SCORE));
  const [bannerLevel, setBannerLevel] = useState<number | null>(null);
  const lastLevel = useRef(levelIndexForScore(replay ? 0 : score));
  const lastStep = useRef(stepIndex(replay ? 0 : score));
  const onLevelUpRef = useRef(onLevelUp);
  onLevelUpRef.current = onLevelUp;

  // Follow the runner: sound on each step, run frames, level-ups
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      current.current = value;
      setShown(Math.round(value));
      setFrame(Math.floor(value / 5) % 2 ? 1 : 0);
      const lv = levelIndexForScore(value);
      setFacing(lv % 2 === 0 ? 1 : -1);
      const st = stepIndex(value);
      if (st > lastStep.current) sfx.step(st);
      lastStep.current = st;
      if (lv > lastLevel.current) {
        lastLevel.current = lv;
        setBannerLevel(lv);
        banner.setValue(0);
        Animated.sequence([
          Animated.spring(banner, { toValue: 1, friction: 5, tension: 120, useNativeDriver: false }),
          Animated.delay(lv >= 5 ? 1600 : 900),
          Animated.timing(banner, { toValue: 0, duration: 250, useNativeDriver: false }),
        ]).start();
        onLevelUpRef.current?.(lv);
      }
    });
    return () => progress.removeListener(id);
  }, [progress, banner]);

  // Run up to the new score (about 1.7s for a 100-point answer)
  const runTo = (target: number) => {
    const delta = Math.max(0, target - current.current);
    return Animated.timing(progress, { toValue: target, duration: 350 + delta * 14, easing: Easing.inOut(Easing.quad), useNativeDriver: false });
  };

  useEffect(() => {
    if (replay) return;
    const target = Math.min(score, MAX_SCORE);
    const anim = runTo(target);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, replay]);

  // Results replay: climb through each answer's running total
  useEffect(() => {
    if (!replay) return;
    const seq: Animated.CompositeAnimation[] = [Animated.delay(500)];
    let prev = 0;
    for (const total of replay) {
      const t = Math.min(total, MAX_SCORE);
      if (t > prev) {
        const from = prev;
        seq.push(Animated.timing(progress, { toValue: t, duration: 300 + (t - from) * 9, easing: Easing.inOut(Easing.quad), useNativeDriver: false }), Animated.delay(220));
      }
      else seq.push(wobble(), Animated.delay(150));
      prev = t;
    }
    const anim = Animated.sequence(seq);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay?.join(",")]);

  const wobble = () =>
    Animated.sequence(
      [-0.25, 0.22, -0.15, 0.1, 0].map((v) => Animated.timing(slip, { toValue: v, duration: 70, useNativeDriver: false })),
    );

  // Wrong guess: slip and windmill
  const firstMiss = useRef(true);
  useEffect(() => {
    if (firstMiss.current) {
      firstMiss.current = false;
      return;
    }
    sfx.slip();
    wobble().start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missKey]);

  if (!width || !path.length) {
    return <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height, borderWidth: 3, borderColor: C.border, backgroundColor: "#69b4f5" }} />;
  }

  const input = path.map((k) => k.pts);
  const x = progress.interpolate({ inputRange: input, outputRange: path.map((k) => k.x), extrapolate: "clamp" });
  const feet = progress.interpolate({ inputRange: input, outputRange: path.map((k) => k.y), extrapolate: "clamp" });
  const camera = progress.interpolate({
    inputRange: input,
    outputRange: path.map((k) => Math.max(-(WORLD_H - height), Math.min(0, -(k.y - height * 0.72)))),
    extrapolate: "clamp",
  });
  // Little hop while running: up on every odd 5 points, down on the even ones (so it rests flat)
  const hopIn: number[] = [];
  const hopOut: number[] = [];
  for (let p = 0; p <= MAX_SCORE; p += 5) {
    hopIn.push(p);
    hopOut.push((p / 5) % 2 ? -3 : 0);
  }
  const top = Animated.add(feet, progress.interpolate({ inputRange: hopIn, outputRange: hopOut, extrapolate: "clamp" }));
  const lv = bannerLevel != null ? LEVELS[bannerLevel] : null;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, borderWidth: 3, borderColor: C.border, overflow: "hidden", backgroundColor: C.night }}
    >
      <Animated.View style={{ position: "absolute", left: 0, top: 0, width, height: WORLD_H, transform: [{ translateY: camera }] }}>
        {LEVELS.map((_, i) => (
          <LevelBand key={i} index={i} width={width} path={path} />
        ))}
        <Animated.View
          style={{
            position: "absolute",
            left: x,
            top,
            marginTop: -RUNNER_H,
            transform: [
              { scaleX: facing },
              { rotate: slip.interpolate({ inputRange: [-1, 1], outputRange: ["-180deg", "180deg"] }) },
            ],
          }}
        >
          <Sprite frame={frame} />
        </Animated.View>
      </Animated.View>

      {counter && (
        <View style={{ position: "absolute", left: 8, top: 8, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 5 }}>
          <Text style={{ fontFamily: F.pixel, fontSize: 11, color: C.border }}>{shown} PTS</Text>
        </View>
      )}

      {lv && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: height / 2 - 34,
            alignItems: "center",
            opacity: banner,
            transform: [{ scale: banner.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }}
        >
          <View style={{ backgroundColor: "rgba(10,16,34,0.88)", borderWidth: 3, borderColor: bannerLevel! >= 5 ? "#ffd23f" : C.border, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", gap: 6 }}>
            <Text style={{ fontFamily: F.pixel, fontSize: 9, color: C.green, letterSpacing: 2 }}>{bannerLevel! >= 5 ? "YOU MADE IT!" : "LEVEL UP!"}</Text>
            <Text style={{ fontFamily: F.pixel, fontSize: 13, color: "#ffd23f", letterSpacing: 1 }}>
              {lv.emoji} {lv.name.toUpperCase()}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
});
