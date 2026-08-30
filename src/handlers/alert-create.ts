import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { flow, storageMessage } from "../crypto/flow.js";
import { money, quotes } from "../crypto/prices.js";
import { now } from "../crypto/clock.js";
import { userStore } from "../crypto/store.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Create Alert", data: "alert:create" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Create alert", data: "alert:create", order: 30 });
const composer = new Composer<Ctx>();

composer.callbackQuery("alert:create", async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const entries = (await userStore(ctx).read()).watchlist;
    if (!entries.length) { await ctx.reply("Add a coin before creating an alert.", { reply_markup: inlineKeyboard([[inlineButton("Add coin", "add_coin:start")]]) }); return; }
    await ctx.reply("Choose the coin for this alert.", { reply_markup: inlineKeyboard([...entries.slice(0, 20).map((entry) => [inlineButton(entry.friendlyName, `alert:coin:${entry.ticker}`)]), [inlineButton("Back to menu", "menu:main")]]) });
  } catch { await ctx.reply(storageMessage); }
});

composer.callbackQuery(/^alert:coin:/, async (ctx) => {
  await ctx.answerCallbackQuery(); const state = flow(ctx); state.ticker = ctx.callbackQuery.data.split(":")[2];
  await ctx.reply("Choose the alert type.", { reply_markup: inlineKeyboard([[inlineButton("Price threshold", "alert:type:threshold")], [inlineButton("Percentage move", "alert:type:percent")]]) });
});
composer.callbackQuery(/^alert:type:/, async (ctx) => {
  await ctx.answerCallbackQuery(); const state = flow(ctx); state.alertType = ctx.callbackQuery.data.endsWith("percent") ? "percent" : "threshold"; state.step = "alert_value";
  await ctx.reply(state.alertType === "threshold" ? "Send the USD price that should trigger the alert." : "Send the percentage move, for example 5 for 5%.", { reply_markup: { force_reply: true, input_field_placeholder: state.alertType === "threshold" ? "Price in USD" : "Percentage" } });
});
composer.on("message:text", async (ctx, next) => {
  const state = flow(ctx); if (state.step !== "alert_value") return next();
  const value = Number(ctx.message.text.trim());
  if (!Number.isFinite(value) || value <= 0) { await ctx.reply("Send a number greater than zero."); return; }
  state.alertValue = value;
  if (state.alertType === "percent") { await ctx.reply("Choose how long to measure the move.", { reply_markup: inlineKeyboard([[inlineButton("1 hour", "alert:time:1"), inlineButton("24 hours", "alert:time:24")], [inlineButton("7 days", "alert:time:168")]]) }); return; }
  await activate(ctx);
});
composer.callbackQuery(/^alert:time:/, async (ctx) => { await ctx.answerCallbackQuery(); await activate(ctx, Number(ctx.callbackQuery.data.split(":")[2])); });

async function activate(ctx: Ctx, timeframeHours?: number): Promise<void> {
  const state = flow(ctx);
  if (!state.ticker || !state.alertType || !state.alertValue) { await ctx.reply("Start the alert setup again."); return; }
  try {
    const store = userStore(ctx); const data = await store.read(); const entry = data.watchlist.find((item) => item.ticker === state.ticker);
    if (!entry) { await ctx.reply("That coin is no longer on your watchlist."); return; }
    const quote = (await quotes([entry.coinId]))[entry.coinId]; if (!quote) { await ctx.reply("Couldn't get that price right now. Try again shortly."); return; }
    const createdAt = now().toISOString();
    entry.alertRules.push({ id: `${entry.ticker}-${createdAt}-${entry.alertRules.length + 1}`, type: state.alertType, value: state.alertValue, timeframeHours, baselinePrice: quote.price, createdAt, active: true });
    await store.write(data); (ctx.session as Record<string, unknown>).step = undefined;
    const detail = state.alertType === "threshold" ? `when it reaches ${money(state.alertValue)}` : `when it moves ${state.alertValue}% over ${timeframeHours}h`;
    await ctx.reply(`Alert active for ${entry.friendlyName}: ${detail}.`);
  } catch { await ctx.reply("The price feed isn't available right now. Try creating the alert again shortly."); }
}

export default composer;
