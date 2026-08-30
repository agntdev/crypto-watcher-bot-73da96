import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { money, quotes, resolveCoin } from "../crypto/prices.js";
import { storageMessage } from "../crypto/flow.js";
import { userStore } from "../crypto/store.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.

const composer = new Composer<Ctx>();

composer.command("price", async (ctx) => {
  const query = ctx.match?.trim().toUpperCase();
  if (!query) { await ctx.reply("Send a ticker after /price, or use /price all."); return; }
  try {
    if (query === "ALL") {
      const entries = (await userStore(ctx).read()).watchlist;
      if (!entries.length) { await ctx.reply("No coins yet — tap Add coin to start your watchlist."); return; }
      const values = await quotes(entries.map((entry) => entry.coinId));
      const lines = entries.map((entry) => values[entry.coinId] ? line(entry.friendlyName, entry.ticker, values[entry.coinId].price, values[entry.coinId].change24h) : `${entry.friendlyName} (${entry.ticker}) — price unavailable`);
      await ctx.reply(`Your prices:\n${lines.join("\n")}`); return;
    }
    const coin = await resolveCoin(query);
    if (!coin) { await ctx.reply("Couldn't find that ticker. Check the spelling and try again."); return; }
    const quote = (await quotes([coin.id]))[coin.id];
    if (!quote) { await ctx.reply("Couldn't get that price right now. Try again shortly."); return; }
    await ctx.reply(line(coin.name, coin.ticker, quote.price, quote.change24h));
  } catch (error) {
    if (query === "ALL" && error instanceof Error && error.message === "storage unavailable") await ctx.reply(storageMessage);
    else await ctx.reply("The price feed isn't available right now. Try again shortly.");
  }
});

function line(name: string, ticker: string, price: number, change: number): string { return `${name} (${ticker}): ${money(price)}\n24h change: ${change >= 0 ? "+" : ""}${change.toFixed(2)}%`; }

export default composer;
