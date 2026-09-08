const symbols = {
  BTCUSDT: { coinGeckoId: 'bitcoin', coinPaprikaId: 'btc-bitcoin', base: 'BTC' },
  ETHUSDT: { coinGeckoId: 'ethereum', coinPaprikaId: 'eth-ethereum', base: 'ETH' },
  BNBUSDT: { coinGeckoId: 'binancecoin', coinPaprikaId: 'bnb-binance-coin', base: 'BNB' },
  SOLUSDT: { coinGeckoId: 'solana', coinPaprikaId: 'sol-solana', base: 'SOL' },
} as const;

type SupportedSymbol = keyof typeof symbols;

const fetchJson = async (url: string, timeoutMs: number) => {
  const aborter = new AbortController();
  const timer = setTimeout(() => aborter.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: aborter.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const fromBinance = async (symbol: SupportedSymbol) => {
  const base = 'https://data-api.binance.vision';
  const [ticker, klines] = await Promise.all([
    fetchJson(`${base}/api/v3/ticker/24hr?symbol=${symbol}`, 1400),
    fetchJson(`${base}/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`, 1400),
  ]);
  return {
    symbol,
    price: Number(ticker.lastPrice),
    change: Number(ticker.priceChangePercent),
    high: Number(ticker.highPrice),
    low: Number(ticker.lowPrice),
    open: Number(ticker.openPrice),
    quoteVolume: Number(ticker.quoteVolume),
    points: (klines as Array<Array<string | number>>).map((row) => Number(row[4])),
    updatedAt: Date.now(),
    source: 'binance' as const,
  };
};

const fromCoinGecko = async (symbol: SupportedSymbol) => {
  const { coinGeckoId } = symbols[symbol];
  const [marketRows, chart] = await Promise.all([
    fetchJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinGeckoId}&price_change_percentage=24h`, 4000),
    fetchJson(`https://api.coingecko.com/api/v3/coins/${coinGeckoId}/market_chart?vs_currency=usd&days=1`, 4000),
  ]);
  const market = marketRows?.[0];
  const points = (chart?.prices as Array<[number, number]> | undefined)?.map((row) => Number(row[1])) ?? [];
  if (!market || !Number.isFinite(Number(market.current_price))) throw new Error('Reference price unavailable');
  const open = points[0] ?? Number(market.current_price) / (1 + Number(market.price_change_percentage_24h) / 100);
  return {
    symbol,
    price: Number(market.current_price),
    change: Number(market.price_change_percentage_24h),
    high: Number(market.high_24h),
    low: Number(market.low_24h),
    open,
    quoteVolume: Number(market.total_volume),
    points: points.filter((_, index) => index % Math.max(1, Math.floor(points.length / 24)) === 0).slice(-24),
    updatedAt: Date.parse(market.last_updated) || Date.now(),
    source: 'coingecko' as const,
  };
};

const fromCoinPaprika = async (symbol: SupportedSymbol) => {
  const { coinPaprikaId } = symbols[symbol];
  const [ticker, ohlcvRows] = await Promise.all([
    fetchJson(`https://api.coinpaprika.com/v1/tickers/${coinPaprikaId}`, 4000),
    fetchJson(`https://api.coinpaprika.com/v1/coins/${coinPaprikaId}/ohlcv/today`, 4000),
  ]);
  const quote = ticker?.quotes?.USD;
  const candle = ohlcvRows?.[0];
  if (!quote || !candle || !Number.isFinite(Number(quote.price))) throw new Error('Reference price unavailable');
  const open = Number(candle.open);
  const low = Number(candle.low);
  const high = Number(candle.high);
  const price = Number(quote.price);
  return {
    symbol,
    price,
    change: Number(quote.percent_change_24h),
    high,
    low,
    open,
    quoteVolume: Number(quote.volume_24h),
    points: [open, Number(candle.close), price],
    updatedAt: Date.parse(ticker.last_updated) || Date.now(),
    source: 'coingecko' as const,
  };
};

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('symbol')?.toUpperCase();
  if (!requested || !(requested in symbols)) {
    return Response.json({ error: 'Unsupported symbol' }, { status: 400 });
  }
  const symbol = requested as SupportedSymbol;

  try {
    const delayedCoinPaprika = new Promise<void>((resolve) => setTimeout(resolve, 150)).then(() => fromCoinPaprika(symbol));
    const delayedCoinGecko = new Promise<void>((resolve) => setTimeout(resolve, 350)).then(() => fromCoinGecko(symbol));
    const market = await Promise.any([fromBinance(symbol), delayedCoinPaprika, delayedCoinGecko]);
    return Response.json(market, { headers: { 'Cache-Control': 'public, max-age=2, s-maxage=5' } });
  } catch {
    return Response.json({ error: 'Market data is temporarily unavailable' }, { status: 503 });
  }
}
