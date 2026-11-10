import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { PixelButton, Scanlines } from "@/components/ui";
import { LEVELS, gameNumber, loadBestStreak, loadHistory, loadStreak, type PlayRecord } from "@/lib/game";
import { C, F } from "@/theme";

export default function Stats() {
  const router = useRouter();
  const [history, setHistory] = useState<PlayRecord[]>([]);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setHistory);
      loadStreak().then(setStreak);
      loadBestStreak().then(setBest);
    }, []),
  );

  const played = history.length;
  const avg = played ? Math.round(history.reduce((s, r) => s + r.score, 0) / played) : 0;
  const top = played ? Math.max(...history.map((r) => r.score)) : 0;
  const highest = played ? Math.max(...history.map((r) => r.level)) : -1;
  const counts = LEVELS.map((_, i) => history.filter((r) => r.level === i).length);
  const maxCount = Math.max(1, ...counts);
  const recent = [...history].reverse().slice(0, 10);

  const tile = (label: string, value: string) => (
    <View style={styles.tile} key={label}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.inner}>
          <Text style={styles.brand}>LEARNBALL · YOUR STATS</Text>

          <View style={styles.tiles}>
            {tile("PLAYED", String(played))}
            {tile("AVERAGE", String(avg))}
            {tile("BEST", String(top))}
            {tile("STREAK", String(streak))}
            {tile("BEST STREAK", String(Math.max(best, streak)))}
          </View>

          <Text style={styles.section}>HIGHEST LEVEL</Text>
          <Text style={styles.highest}>{highest >= 0 ? `${LEVELS[highest].emoji} ${LEVELS[highest].name}` : "Play a game to start climbing"}</Text>

          <Text style={styles.section}>WHERE YOUR GAMES ENDED</Text>
          <View style={{ gap: 8 }}>
            {LEVELS.map((lv, i) => (
              <View key={lv.id} style={styles.barRow}>
                <Text style={styles.barLabel}>{lv.name.toUpperCase()}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(counts[i] / maxCount) * 100}%`, backgroundColor: i === LEVELS.length - 1 ? "#ffd23f" : C.border }]} />
                </View>
                <Text style={styles.barCount}>{counts[i]}</Text>
              </View>
            ))}
          </View>

          {recent.length > 0 && (
            <>
              <Text style={styles.section}>RECENT GAMES</Text>
              <View style={{ gap: 6 }}>
                {recent.map((r) => (
                  <View key={r.day} style={styles.recent}>
                    <Text style={styles.recentText}>#{gameNumber(r.day)}</Text>
                    <Text style={styles.recentText}>{LEVELS[r.level]?.emoji} {LEVELS[r.level]?.name}</Text>
                    <Text style={[styles.recentText, { color: C.border }]}>{r.score}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={styles.note}>Stats are saved on this device.</Text>
          <PixelButton label="◀ HOME" onPress={() => router.replace("/")} style={{ marginTop: 18 }} />
        </View>
      </ScrollView>
      <Scanlines />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 28, paddingBottom: 48 },
  inner: { width: "100%", maxWidth: 720, alignSelf: "center" },
  brand: { fontFamily: F.pixel, fontSize: 11, color: C.border, letterSpacing: 3, textAlign: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22, justifyContent: "center" },
  tile: { minWidth: 104, flexGrow: 1, padding: 12, borderWidth: 3, borderColor: C.dim, backgroundColor: C.panel, alignItems: "center", gap: 8 },
  tileValue: { fontFamily: F.pixel, fontSize: 20, color: C.text },
  tileLabel: { fontFamily: F.pixel, fontSize: 8, color: C.muted, letterSpacing: 1 },
  section: { fontFamily: F.pixel, fontSize: 10, color: C.muted, letterSpacing: 2, marginTop: 26, marginBottom: 12 },
  highest: { fontFamily: F.mono, fontSize: 28, color: C.text },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { fontFamily: F.pixel, fontSize: 8, color: C.text, width: 104 },
  barTrack: { flex: 1, height: 14, backgroundColor: "#0b1328", borderWidth: 2, borderColor: C.dim },
  barFill: { height: "100%" },
  barCount: { fontFamily: F.pixel, fontSize: 9, color: C.muted, width: 26, textAlign: "right" },
  recent: { flexDirection: "row", justifyContent: "space-between", padding: 10, borderWidth: 2, borderColor: C.dim, backgroundColor: C.panel },
  recentText: { fontFamily: F.mono, fontSize: 22, color: C.text },
  note: { fontFamily: F.mono, fontSize: 18, color: C.dim, marginTop: 22, textAlign: "center" },
});
