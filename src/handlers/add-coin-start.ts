import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { quickCoin, quickCoins, resolveCoin } from "../crypto/prices.js";
import { clearFlow, flow, storageMessage } from "../crypto/flow.js";
import { userStore } from "../crypto/store.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Add Coin", data: "add_coin:start" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Add coin", data: "add_coin:start", order: 10 });
registerMainMenuItem({ label: "Watchlist", data: "watchlist:show", order: 20 });
const composer = new Composer<Ctx>();

const chooseCoin = inlineKeyboard([
  quickCoins().slice(0, 3).map((coin) => inlineButton(coin.ticker, `add_coin:pick:${coin.ticker}`)),
  [inlineButton("Enter ticker", "add_coin:custom")],
  [inlineButton("Back to menu", "menu:main")],
]);

composer.callbackQuery("add_coin:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  clearFlow(ctx);
  await ctx.reply("Choose a coin, or enter its ticker.", { reply_markup: chooseCoin });
});

composer.callbackQuery("add_coin:custom", async (ctx) => {
  await ctx.answerCallbackQuery(); flow(ctx).step = "add_ticker";
  await ctx.reply("Send the ticker symbol, for example AVAX.", { reply_markup: { force_reply: true, input_field_placeholder: "Ticker symbol" } });
});

composer.callbackQuery(/^add_coin:pick:/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const coin = quickCoin(ctx.callbackQuery.data.split(":")[2] ?? "");
  if (!coin) { await ctx.reply("That coin isn't available. Choose another ticker.", { reply_markup: chooseCoin }); return; }
  const state = flow(ctx); state.ticker = coin.ticker; state.coinId = coin.id; state.name = coin.name; state.step = "add_name";
  await ctx.reply(`Use ${coin.name} as the name, or send your own label.`, { reply_markup: inlineKeyboard([[inlineButton("Use default name", "add_coin:default")]]) });
});

composer.callbackQuery("add_coin:default", async (ctx) => {
  await ctx.answerCallbackQuery(); const state = flow(ctx);
  if (!state.ticker || !state.coinId || !state.name) { await ctx.reply("Start by choosing a coin.", { reply_markup: chooseCoin }); return; }
  state.step = "add_confirm";
  await ctx.reply(`Add ${state.name} (${state.ticker}) to your watchlist?`, { reply_markup: inlineKeyboard([[inlineButton("Add coin", "add_coin:confirm"), inlineButton("Cancel", "menu:main")]]) });
});

composer.callbackQuery("add_coin:confirm", async (ctx) => {
  await ctx.answerCallbackQuery(); const state = flow(ctx);
  if (!state.ticker || !state.coinId || !state.name) { await ctx.reply("That setup expired. Choose the coin again.", { reply_markup: chooseCoin }); return; }
  try {
    const store = userStore(ctx); const data = await store.read();
    if (data.watchlist.some((entry) => entry.ticker === state.ticker)) { clearFlow(ctx); await ctx.reply(`${state.ticker} is already on your watchlist.`); return; }
    data.watchlist.push({ ticker: state.ticker, coinId: state.coinId, friendlyName: state.name, alertRules: [] }); await store.write(data); clearFlow(ctx);
    await ctx.reply(`${state.name} (${state.ticker}) is on your watchlist.`);
  } catch { await ctx.reply(storageMessage); }
});

composer.callbackQuery("watchlist:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  try { const entries = (await userStore(ctx).read()).watchlist;
    if (!entries.length) await ctx.reply("No coins yet — tap Add coin to start.", { reply_markup: inlineKeyboard([[inlineButton("Add coin", "add_coin:start")]]) });
    else await ctx.reply(`Your watchlist:\n${entries.map((entry) => `• ${entry.friendlyName} (${entry.ticker}) — ${entry.alertRules.length} alert${entry.alertRules.length === 1 ? "" : "s"}`).join("\n")}`, { reply_markup: inlineKeyboard([[inlineButton("Create alert", "alert:create")], [inlineButton("Back to menu", "menu:main")]]) });
  } catch { await ctx.reply(storageMessage); }
});

composer.on("message:text", async (ctx, next) => {
  const state = flow(ctx); const text = ctx.message.text.trim();
  if (state.step === "add_ticker") {
    try { const coin = await resolveCoin(text); if (!coin) { await ctx.reply("Couldn't find that ticker. Check it and try again."); return; }
      state.ticker = coin.ticker; state.coinId = coin.id; state.name = coin.name; state.step = "add_name";
      await ctx.reply(`Use ${coin.name} as the name, or send your own label.`, { reply_markup: inlineKeyboard([[inlineButton("Use default name", "add_coin:default")]]) });
    } catch { await ctx.reply("The price feed isn't available right now. Try that ticker again shortly."); } return;
  }
  if (state.step === "add_name") {
    if (text.length < 1 || text.length > 40) { await ctx.reply("Use a name between 1 and 40 characters."); return; }
    state.name = text; state.step = "add_confirm";
    await ctx.reply(`Add ${text} (${state.ticker}) to your watchlist?`, { reply_markup: inlineKeyboard([[inlineButton("Add coin", "add_coin:confirm"), inlineButton("Cancel", "menu:main")]]) }); return;
  }
  await next();
});

export default composer;
