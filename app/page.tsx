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
  source: 'live' | 'demo';
};

const demoMarkets: Record<SymbolName, Market> = {
  BTCUSDT: { price: 79482.31, change: 2.14, high: 81204, low: 77112, open: 77817, quoteVolume: 2840000000, updatedAt: Date.now(), source: 'demo' },
  ETHUSDT: { price: 3184.22, change: 1.27, high: 3268, low: 3088, open: 3144, quoteVolume: 1670000000, updatedAt: Date.now(), source: 'demo' },
  BNBUSDT: { price: 918.76, change: 3.42, high: 936, low: 878, open: 888, quoteVolume: 612000000, updatedAt: Date.now(), source: 'demo' },
  SOLUSDT: { price: 184.09, change: -1.16, high: 190.4, low: 179.8, open: 186.25, quoteVolume: 928000000, updatedAt: Date.now(), source: 'demo' },
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
  const [market, setMarket] = useState<Market>(demoMarkets.BNBUSDT);
  const [points, setPoints] = useState<number[]>([882, 889, 886, 901, 898, 906, 912, 909, 918, 921, 916, 924]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [armedUntil, setArmedUntil] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [copied, setCopied] = useState(false);

  const loadMarket = async (nextSymbol = symbol) => {
    setLoading(true);
    setRan(false);
    setArmedUntil(null);
    try {
      const [tickerResponse, klinesResponse] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${nextSymbol}`),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${nextSymbol}&interval=1h&limit=24`),
      ]);
      if (!tickerResponse.ok || !klinesResponse.ok) throw new Error('Market feed unavailable');
      const ticker = await tickerResponse.json();
      const klines = (await klinesResponse.json()) as Array<Array<string | number>>;
      setMarket({
        price: Number(ticker.lastPrice),
        change: Number(ticker.priceChangePercent),
        high: Number(ticker.highPrice),
        low: Number(ticker.lowPrice),
        open: Number(ticker.openPrice),
        quoteVolume: Number(ticker.quoteVolume),
        updatedAt: Date.now(),
        source: 'live',
      });
      setPoints(klines.map((row) => Number(row[4])));
    } catch {
      const fallback = { ...demoMarkets[nextSymbol], updatedAt: Date.now() };
      setMarket(fallback);
      setPoints(Array.from({ length: 18 }, (_, i) => fallback.open + ((fallback.price - fallback.open) * i) / 17 + Math.sin(i * 1.8) * fallback.price * 0.003));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarket(symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

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
  const volatility = ((market.high - market.low) / market.open) * 100;
  const rangePosition = ((market.price - market.low) / Math.max(market.high - market.low, 0.0001)) * 100;
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
          <span className={`status-dot ${market.source === 'live' ? 'live' : ''}`} />
          {market.source === 'live' ? 'BINANCE LIVE' : 'DEMO FEED'}
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
            <Button onClick={() => setRan(true)} disabled={loading} className="tribunal-button">
              {loading ? <RefreshCw className="animate-spin" /> : <Gavel />}
              {loading ? 'Gathering evidence' : 'Run adversarial tribunal'}
            </Button>
            <p className="microcopy">Analysis only. No order can be placed from this screen.</p>
          </aside>

          <section className="market-panel">
            <div className="market-head">
              <div>
                <span className="asset-label">{symbol.replace('USDT', '')} / USDT</span>
                <div className="price-row"><strong>${formatPrice(market.price)}</strong><span className={market.change >= 0 ? 'positive' : 'negative'}>{market.change >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}{Math.abs(market.change).toFixed(2)}%</span></div>
              </div>
              <button className="refresh-button" onClick={() => loadMarket()} aria-label="Refresh Binance market data"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
            </div>
            <Sparkline points={points} positive={market.change >= 0} />
            <div className="market-stats">
              <div><span>24H HIGH</span><strong>${formatPrice(market.high)}</strong></div>
              <div><span>24H LOW</span><strong>${formatPrice(market.low)}</strong></div>
              <div><span>QUOTE VOLUME</span><strong>${compact(market.quoteVolume)}</strong></div>
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
