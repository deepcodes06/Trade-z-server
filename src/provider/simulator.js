"use strict";

// =============================================================================
// simulator.js
// -----------------------------------------------------------------------------
// The realtime price engine. Loads stock_catalog.json + a per-stock candle
// cache, then on each tick (default 1s) walks every stock's price using a
// mean-reverting random walk with per-stock volatility and occasional news
// spikes. Maintains day stats, ATP, bid/ask, a 5-level order book (market
// depth), and auto-breaks 52-week highs/lows (updating dates).
//
// Exposes a tiny event-emitter API (`on('tick', ...)`) so server.js can pipe
// updates out through SSE.
// =============================================================================

const { EventEmitter } = require("events");
const fs = require("fs");
const path = require("path");
const { buildCandlesForStock, sliceForPeriod } = require("./candles");
const livefeed = require("./livefeed");
const { isMarketOpen } = require("../utils/market-hours");

const DEFAULT_TICK_MS = 1000;
const LIVE_REFRESH_MS = 60 * 1000; // re-fetch Yahoo once a minute.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function round2(v) {
  return Math.round(v * 100) / 100;
}
function roundN(v, n) {
  const f = Math.pow(10, n);
  return Math.round(v * f) / f;
}

class Simulator extends EventEmitter {
  constructor({
    catalogPath,
    tickMs = DEFAULT_TICK_MS,
  } = {}) {
    super();
    this.tickMs = tickMs;
    this._timer = null;
    this._liveTimer = null;
    this._stocks = new Map();
    this._candles = new Map();
    this._lastTickAt = null;
    this._tickCount = 0;
    this._tradedValue = 0;
    this._tradedShares = 0;
    this._liveLastOk = null;
    this._liveLastErr = null;

    const raw = JSON.parse(fs.readFileSync(catalogPath ?? path.join(__dirname, "stock_catalog.json"), "utf8"));
    for (const s of raw.stocks) {
      const live = JSON.parse(JSON.stringify(s)); // deep clone so we can mutate freely
      // Session turnover accumulator (synthesized on load so atp matches day).
      const initialNotional = live.currentPrice * live.volume;
      this._stocks.set(s.symbol, {
        ...live,
        _cumNotional: initialNotional,
        _cumVolume: live.volume,
        _dayStartNotional: initialNotional,
        _dayStartVolume: live.volume,
        _lastNewsTick: 0,
        _lastLiveAt: null,
        _liveOk: false,
        _suppressWalk: false,
      });
      this._candles.set(s.symbol, buildCandlesForStock(live));
    }
  }

  // ---- Public API ----------------------------------------------------------

  symbols() {
    return [...this._stocks.keys()];
  }

  /** Full snapshot of every stock, sorted by symbol. */
  getSnapshot() {
    return [...this._stocks.values()]
      .map((s) => this._project(s))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  /** Single-stock snapshot. */
  getStock(symbol) {
    const s = this._stocks.get(symbol.toUpperCase());
    return s ? this._project(s) : null;
  }

  /** Candles for a chart period. */
  getCandles(symbol, period = "1yr", filter = "default") {
    const s = this._stocks.get(symbol.toUpperCase());
    if (!s) return [];
    const all = this._candles.get(symbol.toUpperCase());
    if (!all) return [];
    const series = all[period] ?? all["1yr"];
    const sliced = sliceForPeriod(series, period);

    // For the intraday window, splice the live bar (last bar) so it trails
    // the currentPrice.
    if (period === "1m" && sliced.length) {
      const last = sliced[sliced.length - 1];
      last.close = round2(s.currentPrice);
      last.high = round2(Math.max(last.high, s.currentPrice));
      last.low = round2(Math.min(last.low, s.currentPrice));
      last.volume = s.volume;
    }
    return sliced;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._tick(), this.tickMs);
    // Boot-time live seed: pull real quotes FIRST, ungated by market hours, so
    // weekends/holidays/pre-open all show the actual settled close (and the
    // candle series is re-anchored to the real previousClose). This fixes
    // cases where the app served the stale catalog price 1313.8 instead of the
    // real 1243.9 for RELIANCE.
    this._seedFromLiveOnce().catch(() => {});
    // Then refresh live prices every minute (market-hours gated for ticks).
    this._liveTimer = setInterval(() => {
      this._refreshLive().catch(() => {});
    }, LIVE_REFRESH_MS);
  }

  /**
   * Ungated live refresh at boot: fetch Yahoo quotes for every symbol once,
   * apply them to the internal stocks AND rebuild the candle series anchored
   * to the real previousClose. Runs regardless of market status so closed
   * days settle on the true close.
   */
  async _seedFromLiveOnce() {
    const symbols = [...this._stocks.keys()];
    let quotes;
    try {
      quotes = await livefeed.refresh(symbols);
      this._liveLastOk = new Date().toISOString();
      this._liveLastErr = null;
    } catch (e) {
      this._liveLastErr = e.message || String(e);
      console.warn(`[simulator] boot live seed failed: ${this._liveLastErr}`);
      return;
    }

    let applied = 0;
    for (const sym of symbols) {
      const q = quotes.get(sym);
      const s = this._stocks.get(sym);
      if (!s || !q) continue;
      this._applyLiveQuote(s, q);
      // Re-anchor candles to the just-applied previousClose.
      this._candles.set(s.symbol, buildCandlesForStock(s));
      applied++;
    }
    if (applied) {
      console.log(
        `[simulator] boot live seed applied to ${applied}/${symbols.length} symbols at ${this._liveLastOk}`
      );
    }
  }
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._liveTimer) {
      clearInterval(this._liveTimer);
      this._liveTimer = null;
    }
  }

  // ---- Live feed -----------------------------------------------------------

  async _refreshLive() {
    // Market open only — outside hours keep the settled close as-is.
    if (!isMarketOpen()) return;
    const symbols = [...this._stocks.keys()];
    let quotes;
    try {
      quotes = await livefeed.refresh(symbols);
      this._liveLastOk = new Date().toISOString();
      this._liveLastErr = null;
    } catch (e) {
      this._liveLastErr = e.message || String(e);
      console.warn(`[simulator] live refresh failed: ${this._liveLastErr}`);
      return;
    }

    for (const sym of symbols) {
      const q = quotes.get(sym);
      const s = this._stocks.get(sym);
      if (!s || !q) continue;
      this._applyLiveQuote(s, q);
    }
  }

  _applyLiveQuote(s, q) {
    if (q.currentPrice != null) s.currentPrice = q.currentPrice;
    if (q.previousClose != null) s.previousClose = q.previousClose;
    if (q.open != null) s.open = q.open;
    if (q.dayHigh != null) s.dayHigh = q.dayHigh;
    if (q.dayLow != null) s.dayLow = q.dayLow;
    if (q.yearHigh != null) s.yearHigh = q.yearHigh;
    if (q.yearLow != null) s.yearLow = q.yearLow;
    if (q.volume != null) {
      s._cumVolume = q.volume;
      s.volume = q.volume;
    }
    if (q.avgVolume != null) s.avgVolume = q.avgVolume;
    if (q.marketCap != null) s.marketCap = q.marketCap;
    if (q.sharesOutstanding != null) s.sharesOutstanding = q.sharesOutstanding;
    if (q.peRatio != null) s.peRatio = q.peRatio;
    if (q.eps != null) s.eps = q.eps;
    if (q.bookValue != null) s.bookValue = q.bookValue;
    if (q.dividendYield != null) s.dividendYield = q.dividendYield;
    if (q.beta != null) s.beta = q.beta;
    if (q.bid != null) s.bid = q.bid;
    if (q.ask != null) s.ask = q.ask;

    s._cumNotional = s._cumVolume * s.currentPrice;

    if (s.previousClose > 0) {
      s.upperCircuit = round2(s.previousClose * (1 + s.circuitPct));
      s.lowerCircuit = round2(s.previousClose * (1 - s.circuitPct));
    }

    s._lastLiveAt = Date.now();
    s._liveOk = true;
    s._suppressWalk = true;
  }

  // ---- Internals ------------------------------------------------------------

  /** Shape a live stock for emission (strip internal underscore fields). */
  _project(s) {
    const change = round2(s.currentPrice - s.previousClose);
    const percentChange = s.previousClose === 0 ? 0 : round2((change / s.previousClose) * 100);
    const atp = s._cumVolume === 0 ? 0 : round2(s._cumNotional / s._cumVolume);
    return {
      symbol: s.symbol,
      companyName: s.companyName,
      exchange: s.exchange,
      sector: s.sector,
      industry: s.industry,
      type: s.type,

      currentPrice: round2(s.currentPrice),
      previousClose: s.previousClose,
      open: s.open,
      dayHigh: round2(s.dayHigh),
      dayLow: round2(s.dayLow),
      change,
      percentChange,
      volume: Math.floor(s._cumVolume),
      avgVolume: s.avgVolume,
      bid: s.bid,
      ask: s.ask,

      yearHigh: s.yearHigh,
      yearHighDate: s.yearHighDate,
      yearLow: s.yearLow,
      yearLowDate: s.yearLowDate,

      marketCap: round2(s.currentPrice * s.sharesOutstanding),
      sharesOutstanding: s.sharesOutstanding,
      peRatio: s.peRatio,
      eps: s.eps,
      bookValue: s.bookValue,
      dividendYield: s.dividendYield,
      beta: s.beta,
      faceValue: s.faceValue,
      lotSize: s.lotSize,

      upperCircuit: s.upperCircuit,
      lowerCircuit: s.lowerCircuit,
      circuitPct: s.circuitPct,
      atp,

      depth: s.depth,
      lastUpdated: new Date().toISOString(),
    };
  }

  _tick() {
    // Outside NSE hours the market is frozen: keep the last traded price and
    // stop streaming live ticks so the app shows a settled close.
    if (!isMarketOpen()) return;

    this._tickCount += 1;
    this._lastTickAt = new Date().toISOString();
    const updates = [];
    for (const s of this._stocks.values()) {
      const prev = s.currentPrice;
      // If we just got a live quote this cycle, don't perturb the price —
      // emit it as-is so the app sees the real value immediately.
      let next;
      if (s._suppressWalk) {
        next = s.currentPrice;
        s._suppressWalk = false;
      } else {
        next = this._nextPrice(s, prev);
      }
      s.currentPrice = next;
      this._updateSession(s, prev, next);
      updates.push({ symbol: s.symbol, currentPrice: round2(next) });
    }
    this.emit("tick", { tickAt: this._lastTickAt, tickCount: this._tickCount, updates });
  }

  /** Mean-reverting random walk + occasional news spike, clamped to circuit. */
  _nextPrice(s, prev) {
    // Per-stock volatility derived from beta.
    const baseVol = 0.0008 + s.beta * 0.0006; // ~0.05% to ~0.15% per tick
    const meanRev = (s.previousClose - prev) * 0.015; // gentle pull to prevClose
    const noise = baseVol * gauss(this._rngFor(s.symbol));
    let next = prev * (1 + noise) + meanRev;

    // News spike ~ once every 800 ticks on average, magnitude 1–3% in either
    // direction, and only for higher-beta names.
    if (s._lastNewsTick === 0) s._lastNewsTick = Math.floor(this._rngFor(s.symbol)() * 800);
    if (this._tickCount - s._lastNewsTick > 400 && this._rngFor(s.symbol)() < 0.0025) {
      const spike = (this._rngFor(s.symbol)() < 0.5 ? -1 : 1) * (0.005 + this._rngFor(s.symbol)() * 0.025);
      next = prev * (1 + spike);
      s._lastNewsTick = this._tickCount;
    }

    // Clamp to ±10% of prevClose (safety, even if upper/lowerCircuit is wider).
    const floor = s.previousClose * 0.9;
    const ceil = s.previousClose * 1.1;
    if (next < floor) next = floor;
    if (next > ceil) next = ceil;
    // Also respect the configured circuit bands.
    if (next < s.lowerCircuit) next = s.lowerCircuit;
    if (next > s.upperCircuit) next = s.upperCircuit;
    return next;
  }

  /** Stable PRNG per symbol so order of updates doesn't change the walk. */
  _rngFor(symbol) {
    if (!this._rngCache) this._rngCache = new Map();
    let r = this._rngCache.get(symbol);
    if (!r) {
      const seed = [...symbol].reduce((acc, ch) => (acc * 131 + ch.charCodeAt(0)) >>> 0, 17);
      r = mulberry32(seed ^ this._tickCount);
      this._rngCache.set(symbol, r);
    }
    return r;
  }

  /** Recompute session stats, depth, ATP after a tick. */
  _updateSession(s, prev, next) {
    if (next > s.dayHigh) s.dayHigh = next;
    if (next < s.dayLow) s.dayLow = next;
    if (next > s.yearHigh) {
      s.yearHigh = round2(next);
      s.yearHighDate = new Date().toISOString().slice(0, 10);
    }
    if (next < s.yearLow) {
      s.yearLow = round2(next);
      s.yearLowDate = new Date().toISOString().slice(0, 10);
    }

    // Simulated trade: ~lotSize shares per tick, price = currentPrice.
    const tradedShares = s.lotSize * Math.max(1, Math.round((Math.abs(next - prev) / Math.max(0.01, s.currentPrice)) * 80));
    const tradedNotional = tradedShares * s.currentPrice;
    s._cumVolume += tradedShares;
    s._cumNotional += tradedNotional;
    s.volume = s._cumVolume;

    // Bid/ask spread around price.
    const spread = Math.max(0.05, s.currentPrice * 0.0008);
    s.bid = round2(s.currentPrice - spread);
    s.ask = round2(s.currentPrice + spread);

    // Refresh order book depth (5 levels).
    this._refreshDepth(s, tradedShares);
  }

  _refreshDepth(s, tradedShares) {
    const tick = Math.max(0.05, s.currentPrice * 0.0005);
    const baseQty = Math.max(s.lotSize, Math.floor(tradedShares * (0.5 + Math.random() * 1.5)));
    const bids = [];
    const asks = [];
    for (let i = 1; i <= 5; i++) {
      bids.push({
        price: round2(s.currentPrice - tick * i),
        quantity: Math.max(s.lotSize, Math.floor(baseQty * (0.5 + Math.random() * 1.8) * (1 + i * 0.12))),
        orders: 3 + Math.floor(Math.random() * 22),
      });
      asks.push({
        price: round2(s.currentPrice + tick * i),
        quantity: Math.max(s.lotSize, Math.floor(baseQty * (0.5 + Math.random() * 1.8) * (1 + i * 0.12))),
        orders: 3 + Math.floor(Math.random() * 22),
      });
    }
    s.depth = {
      bids,
      asks,
      totalBuyQty: bids.reduce((acc, b) => acc + b.quantity, 0),
      totalSellQty: asks.reduce((acc, a) => acc + a.quantity, 0),
    };
  }
}

module.exports = { Simulator };