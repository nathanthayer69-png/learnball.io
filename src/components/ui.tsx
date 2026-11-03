import { Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from "react-native";

import { C, F } from "@/theme";

/** Faint CRT scanlines over the whole screen. */
export function Scanlines() {
  const { height } = useWindowDimensions();
  const count = Math.ceil(height / 4);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ position: "absolute", left: 0, right: 0, top: i * 4, height: 1, backgroundColor: "rgba(0,0,0,0.18)" }} />
      ))}
    </View>
  );
}

/** Big title with an offset two-colour shadow, arcade style. */
export function PixelTitle({ children, size = 34 }: { children: string; size?: number }) {
  const base = { fontFamily: F.pixel, fontSize: size, lineHeight: size * 1.35, textAlign: "center" as const };
  return (
    <View>
      <Text style={[base, { color: C.orange, position: "absolute", left: -3, right: 3, top: 3 }]}>{children}</Text>
      <Text style={[base, { color: C.green, position: "absolute", left: 3, right: -3, top: -2, opacity: 0.85 }]}>{children}</Text>
      <Text style={[base, { color: C.text }]}>{children}</Text>
    </View>
  );
}

export function PixelButton({
  label,
  onPress,
  big,
  disabled,
  style,
  size,
}: {
  size?: number;
  label: string;
  onPress?: () => void;
  big?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed, hovered }: any) => [
        styles.btn,
        big && styles.btnBig,
        (hovered || pressed) && !disabled && styles.btnHover,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={[styles.btnText, big && { fontSize: 18, letterSpacing: 4 }, size ? { fontSize: size, letterSpacing: 2 } : null]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ borderWidth: 2, borderColor: color, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={{ fontFamily: F.pixel, fontSize: 9, color, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 3,
    borderColor: C.border,
    backgroundColor: C.panel,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    boxShadow: `0 0 14px ${C.borderGlow}`,
  },
  btnBig: { paddingVertical: 24, borderWidth: 4 },
  btnHover: { backgroundColor: "#1c2a4d", transform: [{ translateY: -1 }] },
  btnText: { fontFamily: F.pixel, fontSize: 11, color: C.text, letterSpacing: 2 },
});
