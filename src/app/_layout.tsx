import { PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p";
import { VT323_400Regular } from "@expo-google-fonts/vt323";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { C } from "@/theme";

export default function RootLayout() {
  const [loaded] = useFonts({ PressStart2P_400Regular, VT323_400Regular });

  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.night }} />;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          title: "LearnBall · Do you know ball?",
          contentStyle: { backgroundColor: C.night },
          animation: "fade",
        }}
      />
    </>
  );
}
