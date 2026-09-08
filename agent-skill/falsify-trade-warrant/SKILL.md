---
name: falsify-trade-warrant
description: Adversarially challenge a proposed Binance trade, expose the strongest invalidating evidence, and create a short-lived bounded execution warrant only when the thesis survives. Use for Binance Agent OS market analysis or trade requests that should be tested before MCP execution; do not use for general market summaries with no trade thesis.
---

# FALSIFY trade warrant

Treat abstention as a successful outcome. A trade warrant is permission to present an exact MCP proposal for human review, never permission to place an order by itself.

## Tribunal

1. Restate the user's thesis as a falsifiable claim: product, symbol, side, time horizon, maximum notional, and maximum acceptable loss. If product or size is missing, stage analysis only and say what is missing.
2. Use Binance MCP for fresh ticker, order book, and candles. Use account tools only when position sizing requires them and the user has granted access. Never claim MCP data was used when it was not.
3. Build the strongest compact case for the thesis, then independently build the strongest case against it. Look for direction conflict, range extension, unusual spread or depth, volatility regime, stale data, unsupported product, and a position the account cannot fund.
4. Name one decisive invalidation condition that can be checked immediately before execution. Prefer a market-observable boundary over vague prose.
5. Reject the trade when a hard constraint fails or two material contradictions remain. Do not weaken thresholds just to produce a warrant.

## Warrant

When the thesis survives, return a warrant containing:

- a unique ID and a 90-second expiry;
- Binance product, symbol, side, order type, and maximum notional;
- a maximum slippage boundary;
- the invalidation price or condition and an optional target reference;
- the evidence timestamp and the contradictions considered;
- `requires_human_confirmation: true` and `withdrawal_allowed: false`.

Before execution, refresh the price and reject an expired warrant, a breached invalidation, stale data, changed side/product, or any order above the cap. Show the exact proposed order and ask for explicit confirmation through the Binance MCP approval flow. A prior request to analyze, create, arm, or copy a warrant is not execution confirmation.

After a confirmed MCP action, report the Binance order status and ID returned by the tool. If no order was placed, say so plainly. Never fabricate an order receipt.

## Output shape

Keep the reasoning auditable and concise: `Thesis → Advocate → Prosecutor → Verdict → Warrant or Rejection`. Separate observed Binance data from inference. Include a short risk disclaimer without turning the response into investment advice.
