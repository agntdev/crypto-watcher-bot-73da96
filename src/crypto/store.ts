import type { Ctx } from "../bot.js";
import { adminChatId } from "../toolkit/index.js";

export interface AlertRule {
  id: string;
  type: "threshold" | "percent";
  value: number;
  timeframeHours?: number;
  baselinePrice: number;
  createdAt: string;
  active: boolean;
}

export interface WatchlistEntry {
  ticker: string;
  coinId: string;
  friendlyName: string;
  alertRules: AlertRule[];
  lastAlertTime?: string;
  lastAlertPrice?: number;
}

export interface Profile {
  chatId: string;
  timezone: string;
  quietHours?: { start: string; end: string };
  summaryTime?: string;
  cooldownHours: number;
}

export interface UserData { profile: Profile; watchlist: WatchlistEntry[]; alertLog: AlertLog[] }
export interface AlertLog { userIdHash: string; ticker: string; alertType: string; timestamp: string }
export interface OwnerData { userHashes: string[]; alertCount: number; tickerCounts: Record<string, number>; lastDailyStats?: string }

type DomainStub = { fetch(input: string, init?: { method?: string; body?: string }): Promise<Response> };
type DomainEnv = { CHAT_DO?: { idFromName(name: string): unknown; get(id: unknown): DomainStub } };
type EnvCtx = Ctx & { env?: DomainEnv };

function initialUser(chatId: string): UserData {
  return { profile: { chatId, timezone: "UTC", cooldownHours: 24 }, watchlist: [], alertLog: [] };
}

function stub(ctx: Ctx, id: string): DomainStub | undefined {
  const env = (ctx as EnvCtx).env;
  return env?.CHAT_DO?.get(env.CHAT_DO.idFromName(`chat:${id}`));
}

async function get<T>(target: DomainStub, key: "user" | "owner"): Promise<T | undefined> {
  const response = await target.fetch(`https://do/domain?key=${key}`, { method: "GET" });
  return response.status === 204 ? undefined : (await response.json()) as T;
}

async function put(target: DomainStub, key: "user" | "owner", value: unknown): Promise<void> {
  const response = await target.fetch(`https://do/domain?key=${key}`, { method: "PUT", body: JSON.stringify(value) });
  if (!response.ok) throw new Error("durable storage request failed");
}

export function userStore(ctx: Ctx) {
  const id = String(ctx.chat?.id ?? ctx.from?.id ?? "");
  const target = stub(ctx, id);
  return {
    async read(): Promise<UserData> {
      if (!target || !id) throw new Error("storage unavailable");
      return (await get<UserData>(target, "user")) ?? initialUser(id);
    },
    async write(data: UserData): Promise<void> {
      if (!target || !id) throw new Error("storage unavailable");
      await put(target, "user", data);
    },
  };
}

export function ownerStore(ctx: Ctx) {
  const owner = adminChatId(ctx as { env?: Record<string, unknown> | null });
  const target = owner ? stub(ctx, owner) : undefined;
  return {
    configured: Boolean(target),
    async read(): Promise<OwnerData> {
      if (!target) throw new Error("owner storage unavailable");
      return (await get<OwnerData>(target, "owner")) ?? { userHashes: [], alertCount: 0, tickerCounts: {} };
    },
    async write(data: OwnerData): Promise<void> {
      if (!target) throw new Error("owner storage unavailable");
      await put(target, "owner", data);
    },
  };
}

export async function anonymizedUserHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(`crypto-watcher:${value}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
