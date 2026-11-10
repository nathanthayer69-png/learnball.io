// Sends the daily "today's LearnBall is up" reminder to every subscribed browser.
// Called once a day by pg_cron. Protected by a cron key stored in Vault.
// Deployed copy lives in Supabase (function "daily-push"); this file is the source of record.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const LAUNCH_DAY = "2026-11-09";

function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

Deno.serve(async (req: Request) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows, error: cfgErr } = await sb.rpc("push_config");
  const cfg = Array.isArray(cfgRows) ? cfgRows[0] : cfgRows;
  if (cfgErr || !cfg?.vapid_private) return new Response(JSON.stringify({ error: "config" }), { status: 500 });
  if (req.headers.get("x-cron-key") !== cfg.cron_key) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  webpush.setVapidDetails("https://learnball.io", cfg.vapid_public, cfg.vapid_private);

  const day = todayET();
  const game = Math.max(1, Math.round((Date.parse(day) - Date.parse(LAUNCH_DAY)) / 86400000) + 1);
  const payload = JSON.stringify({
    title: `LearnBall #${game} is live 🏈`,
    body: body.message ?? "7 new prompts. How high can you climb today?",
    url: "https://learnball.io/play",
  });

  let query = sb.from("push_subs").select("endpoint,p256dh,auth,last_sent").limit(5000);
  if (body.endpoint) query = query.eq("endpoint", body.endpoint);
  else query = query.or(`last_sent.is.null,last_sent.lt.${day}`);
  const { data: subs, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let sent = 0, removed = 0, failed = 0;
  const errors: string[] = [];
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 });
      sent++;
      await sb.from("push_subs").update({ last_sent: day }).eq("endpoint", s.endpoint);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        removed++;
        await sb.from("push_subs").delete().eq("endpoint", s.endpoint);
      } else {
        failed++;
        if (errors.length < 5) errors.push(`${code ?? "no-status"}: ${String((e as Error).message ?? e).slice(0, 160)}`);
      }
    }
  }
  return new Response(JSON.stringify({ day, game, total: subs?.length ?? 0, sent, removed, failed, errors }), { headers: { "Content-Type": "application/json" } });
});
