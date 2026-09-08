# FALSIFY

**The trading agent that tries to kill its own trade.**

FALSIFY is a Binance Agent OS workflow for adversarial pre-trade reasoning. Instead of optimizing for activity, it treats abstention as a valid outcome. A proposed trade must survive an advocate/prosecutor tribunal before the agent can produce a short-lived, tightly bounded execution warrant for Binance MCP.

Built for the Binance Agent OS Mini Hackathon — Track A.

## Why it is different

Most trading agents answer: “Why should I trade?” FALSIFY begins with the opposite question: “What observable evidence would prove this trade wrong right now?”

The resulting **trade warrant** is a portable, auditable contract between reasoning and execution:

- expires after 90 seconds;
- caps product, symbol, side, notional, and slippage;
- carries a concrete invalidation boundary;
- must be revalidated against fresh Binance data;
- still requires explicit human confirmation in Binance MCP;
- cannot authorize withdrawals.

## Workflow

```text
THESIS
  ↓
BINANCE EVIDENCE ── ticker · candles · order book
  ↓
ADVOCATE  ⇄  PROSECUTOR
  ↓
VERDICT ── reject, or issue 90-second warrant
  ↓
HUMAN REVIEW ── exact order + hard caps
  ↓
BINANCE MCP APPROVAL ── execute or revoke
```

## What is included

- A responsive control-plane dashboard that retrieves Binance market data server-side, with a clearly labeled CoinGecko reference-index fallback when Binance market hosts are unreachable. It never substitutes a fabricated price.
- An installable Codex skill at `agent-skill/falsify-trade-warrant` that defines the adversarial tribunal and Binance MCP execution contract.
- WebMCP tools for agents to stage a thesis and run the same tribunal shown in the interface.
- A copyable Binance MCP handoff that contains the warrant and all safety invariants.

No API keys or exchange credentials are stored by the app. The dashboard cannot place orders.

## Run locally

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Open the local URL, choose a market and direction, set a notional ceiling, and run the tribunal. When a thesis survives, arm the warrant and copy its Binance MCP handoff into a connected agent.

## Demo sequence

1. Select BNB/USDT and “Follow evidence.”
2. Set a deliberately small notional ceiling.
3. Run the tribunal and show the advocate and prosecutor using the same Binance evidence.
4. Change direction to contradict momentum and demonstrate a rejected trade.
5. Return to “Follow evidence,” create the warrant, and show its countdown.
6. Copy the handoff into Codex or ChatGPT with Binance MCP connected.
7. Show that MCP refreshes the evidence and presents the exact order for human approval rather than executing silently.

## Safety boundary

FALSIFY is experimental software, not financial advice. Digital assets are volatile. The user remains responsible for every trade. Binance MCP should be configured with the least privileges needed and a dedicated Agentic sub-account.

## License

MIT
