export interface Coin { id: string; ticker: string; name: string }
export interface Quote { price: number; change24h: number }

const QUICK: Record<string, Coin> = {
  BTC: { id: "bitcoin", ticker: "BTC", name: "Bitcoin" },
  ETH: { id: "ethereum", ticker: "ETH", name: "Ethereum" },
  SOL: { id: "solana", ticker: "SOL", name: "Solana" },
  USDC: { id: "usd-coin", ticker: "USDC", name: "USD Coin" },
};

export const quickCoins = (): Coin[] => Object.values(QUICK);
export const quickCoin = (ticker: string): Coin | undefined => QUICK[ticker.toUpperCase()];

async function request(url: string): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (response.ok || response.status < 500) return response;
      last = new Error(`price feed returned ${response.status}`);
    } catch (error) { last = error; }
  }
  throw last instanceof Error ? last : new Error("price feed unavailable");
}

export async function resolveCoin(raw: string): Promise<Coin | undefined> {
  const ticker = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(ticker)) return undefined;
  const known = quickCoin(ticker);
  if (known) return known;
  const response = await request(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(ticker)}`);
  if (!response.ok) throw new Error("price feed unavailable");
  const body = await response.json() as { coins?: Array<{ id: string; symbol: string; name: string }> };
  const found = body.coins?.find((coin) => coin.symbol.toUpperCase() === ticker);
  return found ? { id: found.id, ticker, name: found.name } : undefined;
}

export async function quotes(ids: string[]): Promise<Record<string, Quote>> {
  if (ids.length === 0) return {};
  const batches = Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) => ids.slice(index * 50, index * 50 + 50));
  const output: Record<string, Quote> = {};
  for (const batch of batches) {
    const response = await request(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(batch.join(","))}&vs_currencies=usd&include_24hr_change=true`);
    if (!response.ok) throw new Error("price feed unavailable");
    const body = await response.json() as Record<string, { usd?: number; usd_24h_change?: number }>;
    for (const id of batch) {
      const row = body[id];
      if (typeof row?.usd === "number") output[id] = { price: row.usd, change24h: row.usd_24h_change ?? 0 };
    }
  }
  return output;
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
}
