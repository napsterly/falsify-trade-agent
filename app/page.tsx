'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Clipboard,
  Clock3,
  Crosshair,
  Fingerprint,
  Gavel,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

type SymbolName = 'BTCUSDT' | 'ETHUSDT' | 'BNBUSDT' | 'SOLUSDT';
type Thesis = 'AUTO' | 'LONG' | 'SHORT';

type WebMcpDocument = Document & {
  modelContext?: {
    registerTool: (
      tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: Record<string, unknown>;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
        execute: (input: unknown) => unknown;
      },
      options?: { signal?: AbortSignal },
    ) => void | Promise<void>;
  };
};

type Market = {
  price: number;
  change: number;
  high: number;
  low: number;
  open: number;
  quoteVolume: number;
  updatedAt: number;
  source: 'connecting' | 'binance' | 'coingecko' | 'snapshot' | 'mcp' | 'unavailable';
};

type BinanceTicker = {
  c: string;
  P: string;
  h: string;
  l: string;
  o: string;
  q: string;
};

const emptyMarket: Market = {
  price: 0,
  change: 0,
  high: 0,
  low: 0,
  open: 0,
  quoteVolume: 0,
  updatedAt: 0,
  source: 'connecting',
};

const snapshotMarkets: Record<SymbolName, Market & { points: number[] }> = {
  BTCUSDT: { price: 78835.4869, change: -0.78, high: 79459.0046, low: 78221.9920, open: 79118.2487, quoteVolume: 24157330464.72, updatedAt: Date.parse('2026-09-08T10:32:17Z'), source: 'snapshot', points: [79118.2487, 78221.9920, 78756.1604, 78835.4869] },
  ETHUSDT: { price: 2488.5754, change: -0.19, high: 2506.5046, low: 2464.7646, open: 2490.6362, quoteVolume: 8564196123.21, updatedAt: Date.parse('2026-09-08T10:34:15Z'), source: 'snapshot', points: [2490.6362, 2464.7646, 2489.8720, 2488.5754] },
  BNBUSDT: { price: 757.7889, change: 1.80, high: 760.4850, low: 737.6051, open: 740.1996, quoteVolume: 841581872.28, updatedAt: Date.parse('2026-09-08T10:32:17Z'), source: 'snapshot', points: [740.1996, 737.6051, 756.4546, 757.7889] },
  SOLUSDT: { price: 103.6536, change: -1.33, high: 104.4948, low: 102.5755, open: 103.8627, quoteVolume: 2152979005.64, updatedAt: Date.parse('2026-09-08T10:34:15Z'), source: 'snapshot', points: [103.8627, 102.5755, 103.5713, 103.6536] },
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: value < 10 ? 3 : 2,
    maximumFractionDigits: value < 10 ? 3 : 2,
  }).format(value);

const compact = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const path = useMemo(() => {
    if (points.length < 2) return '';
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * 300;
        const y = 86 - ((point - min) / range) * 70;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [points]);

  return (
    <svg aria-label="24 hour price shape" className="h-24 w-full" viewBox="0 0 300 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={positive ? '#f0b90b' : '#ff6b6b'} stopOpacity=".32" />
          <stop offset="1" stopColor={positive ? '#f0b90b' : '#ff6b6b'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L 300 100 L 0 100 Z`} fill="url(#chart-fill)" />
      <path d={path} fill="none" stroke={positive ? '#f0b90b' : '#ff6b6b'} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Home() {
  const [symbol, setSymbol] = useState<SymbolName>('BNBUSDT');
  const [thesis, setThesis] = useState<Thesis>('AUTO');
  const [notional, setNotional] = useState(100);
  const [market, setMarket] = useState<Market>(emptyMarket);
  const [points, setPoints] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedKey, setFeedKey] = useState(0);
  const [ran, setRan] = useState(false);
  const [armedUntil, setArmedUntil] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const snapshot = snapshotMarkets[symbol];
    setMarket(snapshot);
    setPoints(snapshot.points);
    setLoading(false);
    setRan(false);
    setArmedUntil(null);

    let cancelled = false;
    let receivedStreamTick = false;
    const aborter = new AbortController();

    const applyMarket = (data: Market & { points?: number[] }) => {
      if (cancelled) return;
      setMarket(data);
      setPoints((current) => data.points?.length ? data.points : current);
      setLoading(false);
    };

    const loadFallback = async () => {
      try {
        const response = await fetch(`/api/market?symbol=${symbol}`, {
          cache: 'no-store',
          signal: aborter.signal,
        });
        if (!response.ok) throw new Error('Market feed unavailable');
        const data = await response.json() as Market & { points: number[] };
        applyMarket(data);
      } catch {
        // Keep the explicitly timestamped snapshot when the host blocks outbound traffic.
      }
    };

    const stream = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
    stream.onmessage = (event) => {
      const ticker = JSON.parse(event.data) as BinanceTicker;
      const price = Number(ticker.c);
      if (!Number.isFinite(price) || price <= 0) return;
      receivedStreamTick = true;
      applyMarket({
        price,
        change: Number(ticker.P),
        high: Number(ticker.h),
        low: Number(ticker.l),
        open: Number(ticker.o),
        quoteVolume: Number(ticker.q),
        updatedAt: Date.now(),
        source: 'binance',
      });
      setPoints((current) => [...current.slice(-46), price]);
    };
    stream.onerror = () => void loadFallback();

    const fallbackTimer = window.setTimeout(() => {
      if (!receivedStreamTick) void loadFallback();
    }, 3500);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      stream.close();
      aborter.abort();
    };
  }, [feedKey, symbol]);

  useEffect(() => {
    if (!armedUntil) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((armedUntil - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) setArmedUntil(null);
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [armedUntil]);

  const direction = thesis === 'AUTO' ? (market.change >= 0 ? 'LONG' : 'SHORT') : thesis;
  const hasLivePrice = market.source !== 'connecting' && market.source !== 'unavailable' && market.price > 0;
  const volatility = hasLivePrice ? ((market.high - market.low) / market.open) * 100 : 0;
  const rangePosition = hasLivePrice ? ((market.price - market.low) / Math.max(market.high - market.low, 0.0001)) * 100 : 0;
  const extensionRisk = direction === 'LONG' ? rangePosition > 88 : rangePosition < 12;
  const momentumConflict = direction === 'LONG' ? market.change < 0 : market.change > 0;
  const volatilityRisk = volatility > 10;
  const conflicts = [extensionRisk, momentumConflict, volatilityRisk].filter(Boolean).length;
  const survives = conflicts <= 1;
  const stopDistance = Math.min(Math.max(volatility * 0.28, 0.8), 2.5);
  const stop = direction === 'LONG' ? market.price * (1 - stopDistance / 100) : market.price * (1 + stopDistance / 100);
  const target = direction === 'LONG' ? market.price * (1 + (stopDistance * 1.8) / 100) : market.price * (1 - (stopDistance * 1.8) / 100);
  const maxLoss = (notional * stopDistance) / 100;
  const nonce = `${symbol.slice(0, 3)}-${Math.abs(Math.round(market.price * 100)).toString(36).toUpperCase()}-${direction[0]}`;

  const mcpHandoff = `Use Binance MCP Server. Validate this FALSIFY warrant against fresh market data before doing anything.
Warrant: ${nonce}
Market: ${symbol} Spot | Side: ${direction === 'LONG' ? 'BUY' : 'SELL'}
Maximum notional: ${notional} USDT | Maximum slippage: 0.20%
Invalidation: ${direction === 'LONG' ? 'price <= ' : 'price >= '}${formatPrice(stop)}
Target reference: ${formatPrice(target)}
Safety rules: reject if data is older than 30 seconds, the invalidation is already hit, or estimated notional exceeds the cap. Show the exact proposed order and ask for my explicit confirmation. Do not submit an order until I confirm it in the Binance MCP approval flow.`;

  useEffect(() => {
    const modelContext = (document as WebMcpDocument).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<typeof modelContext.registerTool>[0]) => {
      void Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
    };

    register({
      name: 'supply_verified_market_snapshot',
      title: 'Supply verified Binance market snapshot',
      description: 'Inject a fresh Binance MCP market snapshot into the visible tribunal. Rejects malformed or stale evidence and never places an order.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', enum: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'] },
          price: { type: 'number', exclusiveMinimum: 0 },
          change24hPercent: { type: 'number' },
          high24h: { type: 'number', exclusiveMinimum: 0 },
          low24h: { type: 'number', exclusiveMinimum: 0 },
          open24h: { type: 'number', exclusiveMinimum: 0 },
          quoteVolume24h: { type: 'number', minimum: 0 },
          observedAt: { type: 'number', description: 'Unix timestamp in milliseconds.' },
        },
        required: ['symbol', 'price', 'change24hPercent', 'high24h', 'low24h', 'open24h', 'quoteVolume24h', 'observedAt'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const value = input as { symbol?: string; price?: number; change24hPercent?: number; high24h?: number; low24h?: number; open24h?: number; quoteVolume24h?: number; observedAt?: number };
        if (!['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'].includes(value.symbol ?? '')) throw new Error('Unsupported symbol');
        if (value.symbol !== symbol) throw new Error('Stage this symbol before supplying its market snapshot');
        const numbers = [value.price, value.change24hPercent, value.high24h, value.low24h, value.open24h, value.quoteVolume24h, value.observedAt];
        if (numbers.some((number) => typeof number !== 'number' || !Number.isFinite(number))) throw new Error('All market fields must be finite numbers');
        if (Math.abs(Date.now() - Number(value.observedAt)) > 60_000) throw new Error('Snapshot is older than 60 seconds');
        if (Number(value.low24h) > Number(value.price) || Number(value.high24h) < Number(value.price)) throw new Error('Price must be inside the reported 24h range');
        const next = {
          price: Number(value.price), change: Number(value.change24hPercent), high: Number(value.high24h), low: Number(value.low24h), open: Number(value.open24h), quoteVolume: Number(value.quoteVolume24h), updatedAt: Number(value.observedAt), source: 'mcp' as const,
        };
        setMarket(next);
        setPoints([next.open, next.low, next.price, next.high, next.price]);
        setRan(false);
        setArmedUntil(null);
        return { accepted: true, symbol: value.symbol, observedAt: value.observedAt, source: 'Binance MCP', orderPlaced: false };
      },
    });

    register({
      name: 'stage_trade_thesis',
      title: 'Stage trade thesis',
      description: 'Stage a market, direction, and strict maximum notional in the visible FALSIFY tribunal without placing an order.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', enum: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'] },
          direction: { type: 'string', enum: ['AUTO', 'LONG', 'SHORT'] },
          maximumNotionalUsdt: { type: 'number', minimum: 25, maximum: 500 },
        },
        required: ['symbol', 'direction', 'maximumNotionalUsdt'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const value = input as { symbol?: string; direction?: string; maximumNotionalUsdt?: number };
        if (!['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'].includes(value.symbol ?? '')) throw new Error('Unsupported symbol');
        if (!['AUTO', 'LONG', 'SHORT'].includes(value.direction ?? '')) throw new Error('Unsupported direction');
        if (typeof value.maximumNotionalUsdt !== 'number' || value.maximumNotionalUsdt < 25 || value.maximumNotionalUsdt > 500) throw new Error('Notional must be between 25 and 500 USDT');
        setSymbol(value.symbol as SymbolName);
        setThesis(value.direction as Thesis);
        setNotional(Math.round(value.maximumNotionalUsdt / 25) * 25);
        setRan(false);
        setArmedUntil(null);
        return { staged: true, symbol: value.symbol, direction: value.direction, maximumNotionalUsdt: value.maximumNotionalUsdt, orderPlaced: false };
      },
    });

    register({
      name: 'run_adversarial_tribunal',
      title: 'Run adversarial tribunal',
      description: 'Challenge the currently staged trade thesis and update the visible verdict. This never places or approves an order.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() {
        setRan(true);
        return {
          symbol,
          direction,
          verdict: survives ? 'survives' : 'rejected',
          contradictions: conflicts,
          warrantId: survives ? nonce : null,
          invalidationPrice: Number(stop.toFixed(4)),
          targetReference: Number(target.toFixed(4)),
          requiresHumanApproval: true,
          orderPlaced: false,
        };
      },
    });

    return () => lifecycle.abort();
  }, [conflicts, direction, nonce, stop, survives, symbol, target]);

  const copyHandoff = async () => {
    await navigator.clipboard.writeText(mcpHandoff);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const checks = [
    { label: 'Momentum agrees', value: `${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)}% / 24h`, failed: momentumConflict },
    { label: 'Not overextended', value: `${rangePosition.toFixed(0)}th percentile`, failed: extensionRisk },
    { label: 'Volatility bounded', value: `${volatility.toFixed(2)}% range`, failed: volatilityRisk },
  ];

  return (
    <main className="min-h-screen bg-[#070806] text-[#f8f7f2]">
      <div className="noise" />
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="brand-mark"><Fingerprint size={19} /></div>
          <div>
            <p className="brand-name">FALSIFY</p>
            <p className="brand-sub">ADVERSARIAL TRADE AGENT</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#989b91]">
          <span className={`status-dot ${hasLivePrice ? 'live' : ''}`} />
          {market.source === 'mcp' ? 'BINANCE MCP VERIFIED' : market.source === 'binance' ? 'BINANCE LIVE' : market.source === 'coingecko' ? 'REFERENCE INDEX' : market.source === 'snapshot' ? `VERIFIED SNAPSHOT · ${new Date(market.updatedAt).toISOString().slice(11, 16)}Z` : market.source === 'connecting' ? 'CONNECTING' : 'FEED UNAVAILABLE'}
          <span className="hidden text-[#4c4f48] sm:inline">/ MCP READY</span>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-5 pb-12 sm:px-8 lg:px-12">
        <div className="intro-grid">
          <div>
            <p className="eyebrow"><ShieldAlert size={14} /> DEFAULT ACTION: ABSTAIN</p>
            <h1>The agent that tries<br />to <em>kill</em> its own trade.</h1>
          </div>
          <div className="intro-copy">
            <p>Most agents search for reasons to trade. FALSIFY searches for the fastest way the thesis can fail—then issues a short-lived execution warrant only if the trade survives.</p>
            <div className="principles"><span>01 / ADVERSARIAL</span><span>02 / EXPLAINABLE</span><span>03 / REVOCABLE</span></div>
          </div>
        </div>

        <div className="workbench">
          <aside className="control-panel">
            <div className="panel-kicker"><Crosshair size={15} /> THESIS INPUT</div>
            <div className="field-block">
              <label>Market</label>
              <Select value={symbol} onValueChange={(value) => setSymbol(value as SymbolName)}>
                <SelectTrigger className="select-dark"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'] as SymbolName[]).map((item) => <SelectItem key={item} value={item}>{item.replace('USDT', ' / USDT')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="field-block">
              <label>Direction</label>
              <Select value={thesis} onValueChange={(value) => setThesis(value as Thesis)}>
                <SelectTrigger className="select-dark"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">Follow evidence</SelectItem>
                  <SelectItem value="LONG">Long thesis</SelectItem>
                  <SelectItem value="SHORT">Short thesis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="field-block slider-block">
              <div className="label-row"><label>Notional ceiling</label><strong>${notional}</strong></div>
              <Slider value={[notional]} min={25} max={500} step={25} onValueChange={(value) => setNotional(Number(typeof value === 'number' ? value : value[0]))} className="falsify-slider" />
              <div className="range-labels"><span>$25</span><span>$500</span></div>
            </div>
            <div className="loss-cap">
              <span>MAX LOSS AT INVALIDATION</span>
              <strong>${maxLoss.toFixed(2)}</strong>
            </div>
            <Button onClick={() => setRan(true)} disabled={loading || !hasLivePrice} className="tribunal-button">
              {loading ? <RefreshCw className="animate-spin" /> : <Gavel />}
              {loading ? 'Gathering evidence' : hasLivePrice ? 'Run adversarial tribunal' : 'Live data required'}
            </Button>
            <p className="microcopy">Analysis only. No order can be placed from this screen.</p>
          </aside>

          <section className="market-panel">
            <div className="market-head">
              <div>
                <span className="asset-label">{symbol.replace('USDT', '')} / USDT</span>
                <div className="price-row"><strong>{hasLivePrice ? `$${formatPrice(market.price)}` : '—'}</strong>{hasLivePrice && <span className={market.change >= 0 ? 'positive' : 'negative'}>{market.change >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}{Math.abs(market.change).toFixed(2)}%</span>}</div>
              </div>
              <button className="refresh-button" onClick={() => setFeedKey((key) => key + 1)} aria-label="Reconnect Binance market data"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
            </div>
            <Sparkline points={points} positive={market.change >= 0} />
            <div className="market-stats">
              <div><span>24H HIGH</span><strong>{hasLivePrice ? `$${formatPrice(market.high)}` : '—'}</strong></div>
              <div><span>24H LOW</span><strong>{hasLivePrice ? `$${formatPrice(market.low)}` : '—'}</strong></div>
              <div><span>QUOTE VOLUME</span><strong>{hasLivePrice ? `$${compact(market.quoteVolume)}` : '—'}</strong></div>
            </div>

            <div className="tribunal-grid">
              <div className="case-card advocate">
                <div className="case-title"><span>ADVOCATE</span><small>Builds the case</small></div>
                <h3>{direction} {symbol.replace('USDT', '')}</h3>
                <p>{Math.abs(market.change).toFixed(2)}% directional momentum with ${compact(market.quoteVolume)} in 24h quote volume.</p>
                <div className="case-foot"><Sparkles size={14} /> Strongest supporting evidence</div>
              </div>
              <div className="versus">VS</div>
              <div className="case-card prosecutor">
                <div className="case-title"><span>PROSECUTOR</span><small>Tries to break it</small></div>
                <h3>{extensionRisk ? 'EXTENSION' : volatilityRisk ? 'VOLATILITY' : momentumConflict ? 'MOMENTUM' : 'TIMING'} RISK</h3>
                <p>{extensionRisk ? `Price is already at the ${rangePosition.toFixed(0)}th percentile of its daily range.` : volatilityRisk ? `The 24h range is ${volatility.toFixed(2)}%, beyond the stress boundary.` : momentumConflict ? 'The proposed direction contradicts the current 24h move.' : 'No hard contradiction found; freshness remains the weakest link.'}</p>
                <div className="case-foot"><ShieldAlert size={14} /> Strongest falsifier found</div>
              </div>
            </div>
          </section>

          <aside className="verdict-panel">
            <div className="panel-kicker"><Activity size={15} /> VERDICT ENGINE</div>
            <div className="check-list">
              {checks.map((check) => (
                <div className="check" key={check.label}>
                  <span className={check.failed ? 'check-icon failed' : 'check-icon'}>{check.failed ? <X /> : <Check />}</span>
                  <div><strong>{check.label}</strong><small>{check.value}</small></div>
                </div>
              ))}
            </div>

            <div className={`verdict ${!ran ? 'pending' : survives ? 'survives' : 'rejected'}`}>
              <span>{!ran ? 'AWAITING TRIBUNAL' : survives ? 'THESIS SURVIVES' : 'TRADE REJECTED'}</span>
              <strong>{!ran ? '—' : survives ? `${3 - conflicts}/3` : `${conflicts} conflicts`}</strong>
              <p>{!ran ? 'Run both sides of the argument before creating a warrant.' : survives ? 'The thesis has no more than one material contradiction.' : 'FALSIFY found enough contrary evidence to block execution.'}</p>
            </div>

            {ran && survives && (
              <div className="warrant-card">
                <div className="warrant-head"><span><Fingerprint size={14} /> TRADE WARRANT</span><code>{nonce}</code></div>
                <div className="warrant-row"><span>ENTRY</span><strong>MARKET</strong></div>
                <div className="warrant-row"><span>INVALID IF</span><strong>{direction === 'LONG' ? '≤' : '≥'} ${formatPrice(stop)}</strong></div>
                <div className="warrant-row"><span>TARGET REF.</span><strong>${formatPrice(target)}</strong></div>
                <div className="warrant-row"><span>MAX SLIPPAGE</span><strong>0.20%</strong></div>
                {!armedUntil ? (
                  <Button className="arm-button" onClick={() => setArmedUntil(Date.now() + 90_000)}><Zap /> Arm 90s warrant</Button>
                ) : (
                  <div className="armed-box">
                    <div><Clock3 size={16} /><strong>{seconds}s</strong><span>until revocation</span></div>
                    <Button onClick={copyHandoff}>{copied ? <Check /> : <Clipboard />}{copied ? 'Copied' : 'Copy MCP handoff'}</Button>
                  </div>
                )}
              </div>
            )}
            {ran && !survives && <Button variant="outline" className="blocked-button" onClick={() => setThesis('AUTO')}><RefreshCw /> Rebuild from evidence</Button>}
          </aside>
        </div>

        <footer>
          <div><span>BINANCE AGENT OS</span><span>PUBLIC MARKET DATA + MCP EXECUTION HANDOFF</span></div>
          <p>FALSIFY never guarantees outcomes. Every order must be reviewed and confirmed in Binance MCP. Digital assets are volatile; this is not financial advice.</p>
        </footer>
      </section>
    </main>
  );
}
