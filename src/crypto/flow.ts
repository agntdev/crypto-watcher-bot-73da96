import type { Ctx } from "../bot.js";

export type Step = "add_ticker" | "add_name" | "add_confirm" | "alert_value" | "prefs_quiet" | "prefs_summary";
export interface Flow { step?: Step; ticker?: string; coinId?: string; name?: string; alertType?: "threshold" | "percent"; alertValue?: number }

export function flow(ctx: Ctx): Flow { return ctx.session as Flow; }
export function clearFlow(ctx: Ctx): void { Object.keys(ctx.session).forEach((key) => delete (ctx.session as Record<string, unknown>)[key]); }
export const storageMessage = "Your saved watchlist isn't available right now. Try again shortly.";
