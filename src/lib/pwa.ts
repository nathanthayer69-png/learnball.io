/**
 * Home-screen install + daily reminder notifications (web only).
 * - Install: Android/desktop Chrome give us an install prompt; iPhone needs Share → Add to Home Screen.
 * - Reminders: Web Push. The browser subscription is saved in Supabase (push_subs);
 *   the daily-push edge function sends one notification each morning.
 */
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

const SUPABASE_URL = "https://rgjuievgykevjmbmtcla.supabase.co";
const SUPABASE_KEY = "sb_publishable_q8o12LZqX4y6AcGM9PvguQ_YAW3dSs-";
const VAPID_PUBLIC = "BH3QieuLh-pxcRx_ixQjsHuWo0FsNldvHNeUv5D1iextFUULqxSWcXBSTehphiPfGPzouzN2crPuTUyPe_dISmc";

const web = Platform.OS === "web" && typeof window !== "undefined";

export type PwaState = {
  standalone: boolean; // opened from the home screen
  ios: boolean;
  canPrompt: boolean; // browser offered an install prompt
  pushSupported: boolean;
  reminders: "unknown" | "on" | "off" | "blocked";
};

let state: PwaState = {
  standalone: false,
  ios: false,
  canPrompt: false,
  pushSupported: false,
  reminders: "unknown",
};
const listeners = new Set<() => void>();
const set = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const usePwa = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );

let deferredPrompt: any = null;
let registration: ServiceWorkerRegistration | null = null;

if (web) {
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  set({ ios, standalone, pushSupported: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window });

  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault();
    deferredPrompt = e;
    set({ canPrompt: true });
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    set({ canPrompt: false, standalone: true });
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        registration = reg;
        if (Notification.permission === "denied") return set({ reminders: "blocked" });
        const sub = await reg.pushManager?.getSubscription();
        set({ reminders: sub ? "on" : "off" });
      })
      .catch(() => set({ reminders: "off" }));
  }
}

/** Show the browser's install prompt (Android/desktop). Returns false if we can't. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  try {
    await deferredPrompt.userChoice;
  } catch {}
  deferredPrompt = null;
  set({ canPrompt: false });
  return true;
}

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function rpc(fn: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Turn the daily reminder on. Must be called from a tap. */
export async function enableReminders(player?: string): Promise<PwaState["reminders"]> {
  if (!web || !state.pushSupported) return "off";
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      set({ reminders: perm === "denied" ? "blocked" : "off" });
      return state.reminders;
    }
    const reg = registration ?? (await navigator.serviceWorker.ready);
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
    const j = sub.toJSON() as any;
    await rpc("push_subscribe", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_player: player ?? null });
    set({ reminders: "on" });
  } catch {
    set({ reminders: "off" });
  }
  return state.reminders;
}

export async function disableReminders() {
  if (!web) return;
  try {
    const reg = registration ?? (await navigator.serviceWorker.ready);
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await rpc("push_unsubscribe", { p_endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch {}
  set({ reminders: "off" });
}
