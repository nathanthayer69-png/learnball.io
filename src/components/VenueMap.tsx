import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";

import { MAX_SCORE, VENUES, venueForScore } from "@/lib/game";
import { C, F } from "@/theme";

const H = 64;

/** Simple flat pixel art for each venue, drawn with plain Views. */
function Tile({ id }: { id: string }) {
  const line = (left: string, extra: object = {}) => (
    <View style={[{ position: "absolute", top: 0, bottom: 0, left: left as any, width: 2, backgroundColor: C.turfLine }, extra]} />
  );
  switch (id) {
    case "football":
      return (
        <View style={{ flex: 1, backgroundColor: C.turf }}>
          <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "12%", backgroundColor: C.turfDark }} />
          <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "12%", backgroundColor: C.turfDark }} />
          {line("12%")}
          {line("31%")}
          {line("50%")}
          {line("69%")}
          {line("88%")}
        </View>
      );
    case "baseball":
      return (
        <View style={{ flex: 1, backgroundColor: "#2a8a47", alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 30, height: 30, backgroundColor: "#b9774a", transform: [{ rotate: "45deg" }], borderWidth: 2, borderColor: C.turfLine }} />
        </View>
      );
    case "hockey":
      return (
        <View style={{ flex: 1, backgroundColor: "#dfeaf2" }}>
          {line("10%", { backgroundColor: "#d33" })}
          {line("35%", { backgroundColor: "#2b59c3", width: 3 })}
          {line("50%", { backgroundColor: "#d33", width: 3 })}
          {line("65%", { backgroundColor: "#2b59c3", width: 3 })}
          {line("90%", { backgroundColor: "#d33" })}
        </View>
      );
    case "basketball":
      return (
        <View style={{ flex: 1, backgroundColor: "#c98b4b", alignItems: "center", justifyContent: "center" }}>
          {line("50%", { backgroundColor: "rgba(255,255,255,0.7)" })}
          <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "rgba(255,255,255,0.7)" }} />
        </View>
      );
    case "golf":
      return (
        <View style={{ flex: 1, backgroundColor: "#2f9e55", alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: "#5cc47a" }} />
          <View style={{ position: "absolute", width: 2, height: 22, backgroundColor: "#eee", top: 14 }} />
          <View style={{ position: "absolute", width: 10, height: 6, backgroundColor: C.red, top: 14, marginLeft: 12 }} />
        </View>
      );
    default:
      return (
        <View style={{ flex: 1, backgroundColor: "#3a2f12", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-evenly", paddingHorizontal: 6, paddingBottom: 6 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: 4, height: 30, backgroundColor: "#ffd23f" }} />
          ))}
        </View>
      );
  }
}

export function VenueMap({ score, showLabels = true }: { score: number; showLabels?: boolean }) {
  const [width, setWidth] = useState(0);
  const pos = useRef(new Animated.Value(0)).current;
  const pct = Math.min(score, MAX_SCORE) / MAX_SCORE;

  useEffect(() => {
    Animated.timing(pos, { toValue: pct, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, pos]);

  const here = venueForScore(score);

  return (
    <View>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: H, flexDirection: "row", borderWidth: 3, borderColor: C.border, overflow: "hidden" }}
      >
        {VENUES.map((v, i) => (
          <View
            key={v.id}
            style={{
              flex: (v.end - v.start) / MAX_SCORE,
              borderRightWidth: i < VENUES.length - 1 ? 2 : 0,
              borderColor: C.night,
              opacity: score >= v.start ? 1 : 0.35,
            }}
          >
            <Tile id={v.id} />
          </View>
        ))}
        {width > 0 && (
          <Animated.View
            style={{
              position: "absolute",
              top: H / 2 - 16,
              left: pos.interpolate({ inputRange: [0, 1], outputRange: [2, width - 34] }),
              width: 28,
              height: 28,
              backgroundColor: C.night,
              borderWidth: 3,
              borderColor: C.text,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 10px rgba(255,255,255,0.6)",
            }}
          >
            <Text style={{ fontSize: 13 }}>{here.emoji}</Text>
          </Animated.View>
        )}
      </View>
      {showLabels && (
        <Text style={{ fontFamily: F.pixel, fontSize: 9, color: C.muted, marginTop: 8, letterSpacing: 1 }}>
          {score} PTS · {here.name.toUpperCase()} {here.emoji}
        </Text>
      )}
    </View>
  );
}
