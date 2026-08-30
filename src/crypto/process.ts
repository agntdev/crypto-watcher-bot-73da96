import type { Ctx } from "../bot.js";
import { adminChatId } from "../toolkit/index.js";
import { now } from "./clock.js";
import { money, quotes } from "./prices.js";
import { anonymizedUserHash, ownerStore, type UserData, userStore } from "./store.js";

function isQuiet(profile: UserData["profile"], at: Date): boolean {
  if (!profile.quietHours) return false;
  const minutes = at.getUTCHours() * 60 + at.getUTCMinutes();
  const parse = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
  const start = parse(profile.quietHours.start); const end = parse(profile.quietHours.end);
  return start === end ? false : start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/** Invoked by a price-update scheduler with the user's chat context. */
export async function processAlerts(ctx: Ctx): Promise<void> {
  const store = userStore(ctx); const data = await store.read(); const at = now();
  if (isQuiet(data.profile, at) || !data.watchlist.length) return;
  const valueById = await quotes(data.watchlist.map((entry) => entry.coinId)); const hash = await anonymizedUserHash(data.profile.chatId);
  for (const entry of data.watchlist) {
    const quote = valueById[entry.coinId]; if (!quote) continue;
    for (const rule of entry.alertRules.filter((item) => item.active)) {
      const elapsed = at.getTime() - Date.parse(rule.createdAt);
      const cooldown = data.profile.cooldownHours * 60 * 60 * 1000;
      const recent = entry.lastAlertTime && at.getTime() - Date.parse(entry.lastAlertTime) < cooldown;
      const thresholdHit = rule.type === "threshold" && ((rule.baselinePrice <= rule.value && quote.price >= rule.value) || (rule.baselinePrice >= rule.value && quote.price <= rule.value));
      const percentHit = rule.type === "percent" && elapsed >= (rule.timeframeHours ?? 24) * 3600000 && Math.abs((quote.price - rule.baselinePrice) / rule.baselinePrice * 100) >= rule.value;
      if (!recent && (thresholdHit || percentHit)) {
        await ctx.api.sendMessage(data.profile.chatId, `${entry.friendlyName} alert: ${money(quote.price)}.`).catch(() => undefined);
        entry.lastAlertTime = at.toISOString(); entry.lastAlertPrice = quote.price; rule.active = false;
        data.alertLog.push({ userIdHash: hash, ticker: entry.ticker, alertType: rule.type, timestamp: at.toISOString() });
        await recordAggregate(ctx, hash, entry.ticker, rule.type);
      }
    }
  }
  await store.write(data);
}

async function recordAggregate(ctx: Ctx, hash: string, ticker: string, type: string): Promise<void> {
  const store = ownerStore(ctx); if (!store.configured) return;
  const data = await store.read(); if (!data.userHashes.includes(hash)) data.userHashes.push(hash); data.alertCount += 1; data.tickerCounts[ticker] = (data.tickerCounts[ticker] ?? 0) + 1; await store.write(data);
  const owner = adminChatId(ctx as { env?: Record<string, unknown> | null });
  if (owner) await ctx.api.sendMessage(owner, `Alert sample: ${ticker} ${type} alert fired.`).catch(() => undefined);
}

/** Invoked by the daily scheduler for a subscribed user's chat context. */
export async function sendDailySummary(ctx: Ctx): Promise<void> {
  const data = await userStore(ctx).read(); const at = now();
  const clockTime = `${String(at.getUTCHours()).padStart(2, "0")}:${String(at.getUTCMinutes()).padStart(2, "0")}`;
  if (!data.profile.summaryTime || data.profile.summaryTime !== clockTime || !data.watchlist.length || isQuiet(data.profile, at)) return;
  const values = await quotes(data.watchlist.map((entry) => entry.coinId));
  const lines = data.watchlist.flatMap((entry) => { const q = values[entry.coinId]; return q ? [`${entry.ticker}: ${money(q.price)} (${q.change24h >= 0 ? "+" : ""}${q.change24h.toFixed(2)}%)`] : []; });
  if (lines.length) await ctx.api.sendMessage(data.profile.chatId, `Daily summary\n${lines.join("\n")}`).catch(() => undefined);
}

/** Sends the owner a daily anonymous aggregate; safe when owner access is unset. */
export async function sendDailyOwnerStats(ctx: Ctx): Promise<void> {
  const owner = adminChatId(ctx as { env?: Record<string, unknown> | null }); const store = ownerStore(ctx); if (!owner || !store.configured) return;
  const data = await store.read(); await ctx.api.sendMessage(owner, `Daily usage: ${data.userHashes.length} active users and ${data.alertCount} alerts.`).catch(() => undefined); data.lastDailyStats = now().toISOString(); await store.write(data);
}
