// LearnBall service worker: daily reminder notifications. No offline caching (always the latest game).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || "Today's LearnBall is live";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "7 new prompts. How high can you climb today?",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "learnball-daily",
      data: { url: data.url || "/play" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/play";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) { w.navigate(url); return w.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
