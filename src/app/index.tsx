import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { PixelButton, PixelTitle, Scanlines } from "@/components/ui";
import { TIERS, TIER_ORDER } from "@/data/types";
import { ANSWER_SECONDS, gameNumber, loadGame, loadStreak, todayET } from "@/lib/game";
import { C, F } from "@/theme";

// Fixed star positions so the sky looks the same every load
const STARS = Array.from({ length: 40 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: ((i * 53) % 160) + 8,
  size: i % 5 === 0 ? 3 : 2,
}));

function LightTower({ side }: { side: "left" | "right" }) {
  return (
    <View style={[styles.tower, side === "left" ? { left: "6%" } : { right: "6%" }]}>
      <View style={styles.lights}>
        {Array.from({ length: 12 }, (_, i) => (
          <View key={i} style={styles.bulb} />
        ))}
      </View>
      <View style={styles.pole} />
    </View>
  );
}

function Stands() {
  const colors = ["#ff7a2f", "#4da3ff", "#f3f1ea", "#ffd23f", "#3ddc84"];
  return (
    <View style={styles.stands}>
      {Array.from({ length: 3 }, (_, row) => (
        <View key={row} style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 4 }}>
          {Array.from({ length: 34 }, (_, i) => (
            <View
              key={i}
              style={{ width: 4, height: 4, backgroundColor: colors[(i * 7 + row * 3) % colors.length], opacity: (i + row) % 3 === 0 ? 0.9 : 0.35 }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Field() {
  return (
    <View style={styles.field}>
      {Array.from({ length: 11 }, (_, i) => (
        <View key={i} style={[styles.yardLine, { left: `${(i + 0.5) * (100 / 11)}%` }]} />
      ))}
      <Text style={styles.fifty}>50</Text>
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const narrow = width < 600;
  const [status, setStatus] = useState<"new" | "playing" | "done">("new");
  const [streak, setStreak] = useState(0);
  const [howTo, setHowTo] = useState(false);
  const day = todayET();
  const titleSize = width < 420 ? 22 : width < 700 ? 30 : 40;

  useFocusEffect(
    useCallback(() => {
      loadGame(day).then((g) => setStatus(!g ? "new" : g.done ? "done" : "playing"));
      loadStreak().then(setStreak);
    }, [day]),
  );

  const label = status === "done" ? "▶ SEE TODAY'S RESULTS" : status === "playing" ? "▶ RESUME TODAY'S GAME" : "▶ PLAY TODAY'S GAME";

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Night sky over the stadium */}
        <View style={[styles.sky, { minHeight: narrow ? undefined : Math.max(380, height * 0.52) }]}>
          {STARS.map((s, i) => (
            <View key={i} style={{ position: "absolute", left: s.left as any, top: s.top, width: s.size, height: s.size, backgroundColor: "#cdd6ff", opacity: 0.6 }} />
          ))}
          {!narrow && <LightTower side="left" />}
          {!narrow && <LightTower side="right" />}

          <View style={styles.hero}>
            <Text style={styles.brand}>LEARNBALL · THE DAILY GAME</Text>
            <PixelTitle size={titleSize}>DO YOU KNOW BALL?</PixelTitle>
            <Text style={styles.sub}>The more niche your answer, the more points you get.</Text>
            <Text style={styles.meta}>7 prompts · {ANSWER_SECONDS} seconds each · rarer answers score more</Text>
          </View>

          <Stands />
        </View>

        <Field />

        {/* Below the field: the controls */}
        <View style={styles.bottom}>
          <View style={styles.inner}>
            <Text style={styles.link} onPress={() => setHowTo((v) => !v)}>
              {howTo ? "▼" : "▶"} HOW TO PLAY
            </Text>
            {howTo && (
              <View style={styles.howTo}>
                <Text style={styles.howLine}>Seven sports prompts a day, the same for everyone.</Text>
                <Text style={styles.howLine}>Read each prompt for 5 seconds, then you get {ANSWER_SECONDS} seconds to land a correct answer. Wrong guesses just shake. Keep trying until the clock runs out.</Text>
                <Text style={styles.howLine}>Any correct answer scores. The more obscure it is, the more it's worth:</Text>
                {TIER_ORDER.map((t) => (
                  <Text key={t} style={[styles.howLine, { color: TIERS[t].color }]}>
                    {TIERS[t].emoji} {TIERS[t].name} · {TIERS[t].points}
                  </Text>
                ))}
                <Text style={styles.howLine}>Your score moves you from the football field all the way to the Hall of Fame.</Text>
              </View>
            )}

            <PixelButton big size={narrow ? 13 : undefined} label={label} onPress={() => router.push("/play")} style={{ marginTop: 18 }} />

            <View style={styles.footer}>
              <Text style={styles.footText}>
                GAME #{gameNumber(day)} · STREAK {streak}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, maxWidth: "100%" }}>
                <PixelButton label={narrow ? "ARCHIVE·SOON" : "ARCHIVE · SOON"} size={narrow ? 9 : undefined} disabled />
                <PixelButton label={narrow ? "PACKS·SOON" : "PACKS · SOON"} size={narrow ? 9 : undefined} disabled />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      <Scanlines />
    </View>
  );
}

const styles = StyleSheet.create({
  sky: { backgroundColor: "#0d1736", paddingTop: 48, overflow: "hidden" },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingBottom: 40, zIndex: 2 },
  brand: { fontFamily: F.pixel, fontSize: 10, color: C.border, letterSpacing: 3, marginBottom: 22, textAlign: "center" },
  sub: { fontFamily: F.mono, fontSize: 26, color: C.text, marginTop: 22, textAlign: "center" },
  meta: { fontFamily: F.mono, fontSize: 20, color: C.muted, marginTop: 8, textAlign: "center" },
  tower: { position: "absolute", top: 70, alignItems: "center", opacity: 0.9 },
  lights: {
    width: 54,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    padding: 5,
    backgroundColor: "#1d2747",
    boxShadow: "0 0 40px 18px rgba(255,236,170,0.22)",
  },
  bulb: { width: 7, height: 7, backgroundColor: "#fff3c2" },
  pole: { width: 6, height: 260, backgroundColor: "#1d2747" },
  stands: { backgroundColor: "#0a1128", paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: 4, borderColor: "#1d2747" },
  field: { height: 70, backgroundColor: C.turf, borderTopWidth: 4, borderBottomWidth: 4, borderColor: "#f3f1ea", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  yardLine: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: C.turfLine },
  fifty: { fontFamily: F.pixel, fontSize: 18, color: "rgba(255,255,255,0.8)", backgroundColor: C.turf, paddingHorizontal: 6 },
  bottom: { flex: 1, backgroundColor: C.night, paddingHorizontal: 16, paddingTop: 26, paddingBottom: 40 },
  inner: { width: "100%", maxWidth: 720, alignSelf: "center" },
  link: { fontFamily: F.pixel, fontSize: 11, color: C.muted, letterSpacing: 3 },
  howTo: { marginTop: 14, padding: 14, borderWidth: 2, borderColor: C.dim, backgroundColor: C.panel, gap: 4 },
  howLine: { fontFamily: F.mono, fontSize: 20, color: C.text },
  footer: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 },
  footText: { fontFamily: F.pixel, fontSize: 10, color: C.muted, letterSpacing: 2 },
});
