import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { flow, storageMessage } from "../crypto/flow.js";
import { userStore } from "../crypto/store.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Manage Preferences", data: "prefs:edit" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Preferences", data: "prefs:edit", order: 40 });
const composer = new Composer<Ctx>();

composer.callbackQuery("prefs:edit", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPreferences(ctx);
});
composer.callbackQuery("prefs:quiet", async (ctx) => { await ctx.answerCallbackQuery(); flow(ctx).step = "prefs_quiet"; await ctx.reply("Send quiet hours as HH:MM-HH:MM in your UTC timezone.", { reply_markup: { force_reply: true, input_field_placeholder: "22:00-07:00" } }); });
composer.callbackQuery("prefs:summary", async (ctx) => { await ctx.answerCallbackQuery(); flow(ctx).step = "prefs_summary"; await ctx.reply("Send the daily summary time as HH:MM in UTC, or send off.", { reply_markup: { force_reply: true, input_field_placeholder: "08:00" } }); });
composer.callbackQuery(/^prefs:cooldown:/, async (ctx) => { await ctx.answerCallbackQuery(); try { const store = userStore(ctx); const data = await store.read(); data.profile.cooldownHours = Number(ctx.callbackQuery.data.split(":")[2]); await store.write(data); await ctx.reply(`Alert cooldown is set to ${data.profile.cooldownHours} hours.`); } catch { await ctx.reply(storageMessage); } });
composer.on("message:text", async (ctx, next) => {
  const state = flow(ctx); const text = ctx.message.text.trim();
  if (state.step === "prefs_quiet") { const match = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(text); if (!match || !validTime(match[1]) || !validTime(match[2])) { await ctx.reply("Use HH:MM-HH:MM, for example 22:00-07:00."); return; } try { const store = userStore(ctx); const data = await store.read(); data.profile.quietHours = { start: match[1], end: match[2] }; await store.write(data); state.step = undefined; await ctx.reply(`Quiet hours are set to ${text} UTC.`); } catch { await ctx.reply(storageMessage); } return; }
  if (state.step === "prefs_summary") { if (text.toLowerCase() !== "off" && !validTime(text)) { await ctx.reply("Send a time as HH:MM, or send off."); return; } try { const store = userStore(ctx); const data = await store.read(); data.profile.summaryTime = text.toLowerCase() === "off" ? undefined : text; await store.write(data); state.step = undefined; await ctx.reply(text.toLowerCase() === "off" ? "Daily summaries are off." : `Daily summary time is set to ${text} UTC.`); } catch { await ctx.reply(storageMessage); } return; }
  await next();
});
async function showPreferences(ctx: Ctx): Promise<void> { try { const profile = (await userStore(ctx).read()).profile; const quiet = profile.quietHours ? `${profile.quietHours.start}-${profile.quietHours.end} UTC` : "off"; const summary = profile.summaryTime ? `${profile.summaryTime} UTC` : "off"; await ctx.reply(`Quiet hours: ${quiet}\nDaily summary: ${summary}\nAlert cooldown: ${profile.cooldownHours} hours`, { reply_markup: inlineKeyboard([[inlineButton("Set quiet hours", "prefs:quiet")], [inlineButton("Set summary time", "prefs:summary")], [inlineButton("1 hour cooldown", "prefs:cooldown:1"), inlineButton("24 hour cooldown", "prefs:cooldown:24")], [inlineButton("Back to menu", "menu:main")]]) }); } catch { await ctx.reply(storageMessage); } }
function validTime(value: string): boolean { const [h, m] = value.split(":").map(Number); return h >= 0 && h < 24 && m >= 0 && m < 60; }

export default composer;
