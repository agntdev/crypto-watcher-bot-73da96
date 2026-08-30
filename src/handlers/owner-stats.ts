import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, requireOwner } from "../toolkit/index.js";
import { ownerStore } from "../crypto/store.js";

const composer = new Composer<Ctx>();
composer.command("stats", async (ctx) => {
  if (!(await requireOwner(ctx as Parameters<typeof requireOwner>[0]))) return;
  try { const data = await ownerStore(ctx).read(); await ctx.reply(`Usage so far: ${data.userHashes.length} active users and ${data.alertCount} alerts.`); } catch { await ctx.reply(adminChatId(ctx as { env?: Record<string, unknown> | null }) ? "Usage statistics aren't available right now." : "Owner access isn't set up yet."); }
});
composer.command("top_alerts", async (ctx) => {
  if (!(await requireOwner(ctx as Parameters<typeof requireOwner>[0]))) return;
  try { const counts = (await ownerStore(ctx).read()).tickerCounts; const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5); await ctx.reply(top.length ? `Most alerted coins:\n${top.map(([ticker, count]) => `• ${ticker}: ${count}`).join("\n")}` : "No alerts have fired yet."); } catch { await ctx.reply(adminChatId(ctx as { env?: Record<string, unknown> | null }) ? "Alert statistics aren't available right now." : "Owner access isn't set up yet."); }
});
export default composer;
