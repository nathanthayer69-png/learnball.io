import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PixelButton, Scanlines } from "@/components/ui";
import { DAYS } from "@/data/schedule";
import { UNLIMITED_PLAY, dayForGame, gameNumber, levelForScore, loadGame, loadHistory, totalScore } from "@/lib/game";
import { C, F } from "@/theme";

type Row = { n: number; day: string; status: "new" | "playing" | "done"; score?: number; live?: boolean };

const fmt = (day: string) =>
  new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function Archive() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const today = gameNumber();
  const last = UNLIMITED_PLAY ? DAYS.length : today - 1;

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const history = await loadHistory();
        const out: Row[] = [];
        for (let n = last; n >= 1; n--) {
          const day = dayForGame(n);
          const live = history.find((h) => h.day === day);
          if (live && !UNLIMITED_PLAY) {
            out.push({ n, day, status: "done", score: live.score, live: true });
            continue;
          }
          const g = await loadGame(day, n);
          out.push({ n, day, status: !g ? "new" : g.done ? "done" : "playing", score: g ? totalScore(g.results) : undefined });
        }
        setRows(out);
      })();
    }, [last]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.inner}>
          <Text style={styles.brand}>LEARNBALL · ARCHIVE</Text>
          <Text style={styles.sub}>Play any past game. Archive games don't count toward your streak or the daily rankings.</Text>

          {rows && rows.length === 0 && <Text style={styles.empty}>No past games yet. Today is Game #1. Check back tomorrow!</Text>}

          <View style={{ gap: 10, marginTop: 18 }}>
            {rows?.map((r) => {
              const lv = r.score != null ? levelForScore(r.score) : null;
              const playable = !r.live;
              return (
                <Pressable
                  key={r.n}
                  disabled={!playable}
                  onPress={() => router.push(`/play?archive=${r.n}`)}
                  style={({ hovered, pressed }: any) => [styles.row, (hovered || pressed) && playable && { borderColor: C.border }]}
                >
                  <Text style={styles.num}>#{r.n}</Text>
                  <Text style={styles.date}>{fmt(r.day)}</Text>
                  <Text style={[styles.status, r.status === "done" && { color: C.green }]}>
                    {r.status === "done" ? `${lv?.emoji ?? ""} ${r.score}${r.live ? " · PLAYED LIVE" : ""}` : r.status === "playing" ? "▶ RESUME" : "▶ PLAY"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <PixelButton label="◀ HOME" onPress={() => router.replace("/")} style={{ marginTop: 24 }} />
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
  sub: { fontFamily: F.mono, fontSize: 20, color: C.muted, textAlign: "center", marginTop: 14 },
  empty: { fontFamily: F.mono, fontSize: 22, color: C.text, textAlign: "center", marginTop: 28 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderWidth: 2, borderColor: C.dim, backgroundColor: C.panel },
  num: { fontFamily: F.pixel, fontSize: 12, color: C.text, width: 52 },
  date: { fontFamily: F.mono, fontSize: 22, color: C.muted, flex: 1 },
  status: { fontFamily: F.pixel, fontSize: 9, color: C.text, letterSpacing: 1 },
});
