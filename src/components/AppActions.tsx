import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { sfx } from "@/lib/audio";
import { getPlayer } from "@/lib/cloud";
import { disableReminders, enableReminders, promptInstall, usePwa } from "@/lib/pwa";
import { C, F } from "@/theme";

/** "Add to home screen" + "Daily reminder" buttons. Web only; hides what doesn't apply. */
export function AppActions({ compact }: { compact?: boolean }) {
  const pwa = usePwa();
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  const install = async () => {
    sfx.click();
    if (!(await promptInstall())) setHelp((v) => !v);
  };

  const toggleReminder = async () => {
    sfx.click();
    if (pwa.ios && !pwa.standalone) return setHelp(true);
    setBusy(true);
    if (pwa.reminders === "on") await disableReminders();
    else await enableReminders(await getPlayer());
    setBusy(false);
  };

  const showInstall = !pwa.standalone;
  const showReminder = pwa.pushSupported || pwa.ios;
  if (!showInstall && !showReminder) return null;

  const reminderLabel =
    pwa.reminders === "on"
      ? "🔔 DAILY REMINDER · ON"
      : pwa.reminders === "blocked"
        ? "🔕 REMINDERS BLOCKED"
        : busy
          ? "🔔 TURNING ON…"
          : "🔔 REMIND ME DAILY";

  return (
    <View style={{ marginTop: compact ? 12 : 16, gap: 10 }}>
      <View style={styles.row}>
        {showInstall && (
          <Pressable onPress={install} style={styles.btn}>
            <Text style={styles.text}>📲 ADD TO HOME SCREEN</Text>
          </Pressable>
        )}
        {showReminder && (
          <Pressable onPress={toggleReminder} disabled={busy || pwa.reminders === "blocked"} style={[styles.btn, pwa.reminders === "on" && { borderColor: C.green }]}>
            <Text style={[styles.text, pwa.reminders === "on" && { color: C.green }]}>{reminderLabel}</Text>
          </Pressable>
        )}
      </View>
      {pwa.reminders === "blocked" && <Text style={styles.note}>Notifications are off for this site in your browser settings.</Text>}
      {help && (
        <View style={styles.help}>
          {pwa.ios ? (
            <>
              <Text style={styles.helpTitle}>ADD LEARNBALL TO YOUR IPHONE</Text>
              <Text style={styles.helpLine}>1. Tap the Share button (square with an arrow) at the bottom of Safari.</Text>
              <Text style={styles.helpLine}>2. Tap "Add to Home Screen", then "Add".</Text>
              <Text style={styles.helpLine}>3. Open LearnBall from your home screen and tap "Remind me daily".</Text>
            </>
          ) : (
            <>
              <Text style={styles.helpTitle}>ADD LEARNBALL TO YOUR HOME SCREEN</Text>
              <Text style={styles.helpLine}>Open your browser menu (⋮ or the share button) and choose "Install app" or "Add to Home screen".</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  btn: { flexGrow: 1, borderWidth: 2, borderColor: C.dim, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center", backgroundColor: C.panel },
  text: { fontFamily: F.pixel, fontSize: 9, color: C.text, letterSpacing: 1 },
  note: { fontFamily: F.mono, fontSize: 18, color: C.muted },
  help: { padding: 12, borderWidth: 2, borderColor: C.border, backgroundColor: C.panel, gap: 6 },
  helpTitle: { fontFamily: F.pixel, fontSize: 9, color: C.border, letterSpacing: 1, marginBottom: 2 },
  helpLine: { fontFamily: F.mono, fontSize: 20, color: C.text },
});
