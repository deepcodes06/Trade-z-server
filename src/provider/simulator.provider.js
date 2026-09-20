
// =============================================================================
// simulator.provider.js
// -----------------------------------------------------------------------------
// Drop-in provider wrapping the local realtime simulator engine. Method
// names and shapes match what market.service.js expects.
// =============================================================================

const path = require("path");
const { Simulator } = require("./simulator");
const { marketInfo } = require("../utils/market-hours");
const { buildCandlesForStock, sliceForPeriod } = require("./candles");
const livefeed = require("./livefeed");

const sim = new Simulator({
  catalogPath: path.join(__dirname, "stock_catalog.json"),
  tickMs: parseInt(process.env.SIM_TICK_MS || "1000", 10),
});

sim.start();

// Same shape IndianProvider#search returns (string[] or {symbol,ticker,...}).
// We return objects so the Dart _listingFromMap parser stays happy.
function search(query) {
  const q = String(query || "").trim().toLowerCase();
  const all = sim.getSnapshot();
  const filtered = q
    ? all.filter((s) => s.symbol.toLowerCase().includes(q) || s.companyName.toLowerCase().includes(q))
    : all.slice(0, 25);
  return filtered.map((s) => ({
    symbol: s.symbol,
    ticker: s.symbol,
    companyName: s.companyName,
    name: s.companyName,
    exchange: s.exchange,
    type: s.type,
  }));
}

function getTrending() {
  return [...sim.getSnapshot()]
    .sort((a, b) => b.percentChange - a.percentChange)
    .slice(0, 10)
    .map(_quoteForProvider);
}

function getNSEMostActive() {
  return [...sim.getSnapshot()]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 10)
    .map(_quoteForProvider);
}

function getBSEMostActive() {
  return [...sim.getSnapshot()]
    .sort((a, b) => b.volume - a.volume)
    .slice(10, 20)
    .map(_quoteForProvider);
}

function getPriceShockers() {
  return [...sim.getSnapshot()]
    .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))
    .slice(0, 10)
    .map((s) => ({ ..._quoteForProvider(s), isBlowUpSignal: Math.abs(s.percentChange) >= 3 }));
}

function get52WeekData() {
  return sim.getSnapshot().map((s) => ({
    symbol: s.symbol,
    companyName: s.companyName,
    yearHigh: s.yearHigh,
    yearLow: s.yearLow,
  }));
}

// -----------------------------------------------------------------------------
// Indices
// -----------------------------------------------------------------------------
// Real index levels are derived from the live stock basket itself: the NIFTY
// and SENSEX move with the market-cap weighted average % change of every stock,
// BANKNIFTY with the banking names only. Bases are realistic round levels.
const BANK_SYMBOLS = new Set([
  "HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK",
  "INDUSINDBK", "BANDHANBNK", "CANBK", "IDFCFIRSTB", "INDIANB",
  "PNB", "UNIONBANK", "YESBANK", "AUBANK",
]);

const INDEX_DEFS = [
  { symbol: "NIFTY", name: "NIFTY", base: 24500, basket: null, yahoo: "^NSEI" },
  { symbol: "NIFTYMC50", name: "NIFTY MIDCAP 50", base: 15500, basket: null, yahoo: "^NSEMDCP50" },
  { symbol: "BANKNIFTY", name: "BANK NIFTY", base: 53000, basket: BANK_SYMBOLS, yahoo: "^NSEBANK" },
  { symbol: "SENSEX", name: "SENSEX", base: 81000, basket: null, yahoo: "^BSESN" },
];

// Real Yahoo index levels seeded at boot (ungated, like the stock live seed).
// Re-anchored whenever `refreshIndices` returns data so the AI grid / detail /
// history pages reflect the actual settled index instead of a hard-coded base.
const _indexLiveSeed = new Map(); // symbol -> mappedQuote
let _indexSeedStarted = false;

async function _seedIndicesFromLiveOnce() {
  if (_indexSeedStarted) return;
  _indexSeedStarted = true;
  const defs = INDEX_DEFS.filter((d) => d.yahoo).map((d) => ({
    symbol: d.symbol,
    yahoo: d.yahoo,
  }));
  if (defs.length === 0) return;
  try {
    const map = await livefeed.refreshIndices(defs);
    let applied = 0;
    for (const [symbol, q] of map) {
      if (q.currentPrice != null) {
        _indexLiveSeed.set(symbol, q);
        applied++;
      }
    }
    if (applied) {
      console.log(
        `[simulator.provider] boot index live seed applied to ${applied}/${defs.length} indices`
      );
    }
  } catch (e) {
    console.warn(`[simulator.provider] boot index live seed failed: ${e.message}`);
  }
}

_seedIndicesFromLiveOnce();

// Real index anchor, if the boot live seed gave us one for this symbol.
function _liveIndexAnchor(symbol) {
  const live = _indexLiveSeed.get(symbol);
  if (!live) return null;
  const prev = live.previousClose || live.currentPrice;
  const ltp = live.currentPrice;
  return {
    previousClose: prev,
    currentPrice: ltp,
    open: live.open ?? prev,
    dayHigh: live.dayHigh ?? Math.max(prev, ltp),
    dayLow: live.dayLow ?? Math.min(prev, ltp),
    yearHigh: live.yearHigh ?? Math.max(prev, ltp),
    yearLow: live.yearLow ?? Math.min(prev, ltp),
  };
}

function _weightedPercentChange(stocks) {
  let cap = 0;
  let sum = 0;
  for (const s of stocks) {
    cap += s.marketCap;
    sum += s.marketCap * s.percentChange;
  }
  return cap > 0 ? sum / cap : 0;
}

// Market-cap weighted average of each stock's percentage deviation of a given
// stat (open/dayHigh/dayLow/yearHigh/yearLow) from its own previousClose.
function _weightedStatPct(stocks, pick) {
  let cap = 0;
  let sum = 0;
  for (const s of stocks) {
    if (!s.previousClose) continue;
    cap += s.marketCap;
    sum += s.marketCap * (((pick(s) - s.previousClose) / s.previousClose) * 100);
  }
  return cap > 0 ? sum / cap : 0;
}

function _makeIndex(def, stocks) {
  // Prefer the boot-seeded real Yahoo level when we have one; fall back to the
  // basket-weighted synthesis so a failed live seed still produces a grid.
  const live = _liveIndexAnchor(def.symbol);
  const base = live ? live.previousClose : def.base;
  const percentChange = live
    ? (live.currentPrice / live.previousClose - 1) * 100
    : _weightedPercentChange(stocks);
  const currentPrice = live
    ? live.currentPrice
    : Math.round(def.base * (1 + percentChange / 100) * 100) / 100;
  const level = (pct) => Math.round(base * (1 + pct / 100) * 100) / 100;
  const open = level(_weightedStatPct(stocks, (s) => s.open || s.previousClose));
  const dayHigh = Math.max(
    open,
    level(_weightedStatPct(stocks, (s) => s.dayHigh || s.currentPrice))
  );
  const dayLow = Math.min(
    open,
    level(_weightedStatPct(stocks, (s) => s.dayLow || s.currentPrice))
  );
  return {
    symbol: def.symbol,
    name: def.name,
    type: "Index",
    exchange: "NSE",
    currentPrice,
    previousClose: def.base,
    change: Math.round((currentPrice - def.base) * 100) / 100,
    percentChange: Math.round(percentChange * 100) / 100,
    open,
    dayHigh,
    dayLow,
    yearHigh: level(_weightedStatPct(stocks, (s) => s.yearHigh || s.currentPrice)),
    yearLow: level(_weightedStatPct(stocks, (s) => s.yearLow || s.currentPrice)),
    lastUpdated: new Date().toISOString(),
  };
}

function getIndices() {
  const all = sim.getSnapshot();
  return INDEX_DEFS.map((def) => {
    const basket = def.basket
      ? all.filter((s) => def.basket.has(s.symbol))
      : all;
    return _makeIndex(def, basket.length ? basket : all);
  });
}

// Single index with aliases the Flutter detail page parser understands
// (price/ltp/high/low/fiftyTwoWeekHigh/fiftyTwoWeekLow mirror stock quotes).
function getIndexDetail(symbol) {
  const def = INDEX_DEFS.find((d) => d.symbol === String(symbol).toUpperCase());
  if (!def) {
    const err = new Error(`Unknown index: ${symbol}`);
    err.status = 404;
    throw err;
  }
  const all = sim.getSnapshot();
  const basket = def.basket
    ? all.filter((s) => def.basket.has(s.symbol))
    : all;
  const index = _makeIndex(def, basket.length ? basket : all);
  return {
    ...index,
    ticker: index.symbol,
    name: index.name,
    price: index.currentPrice,
    ltp: index.currentPrice,
    prevClose: index.previousClose,
    high: index.dayHigh,
    low: index.dayLow,
    fiftyTwoWeekHigh: index.yearHigh,
    fiftyTwoWeekLow: index.yearLow,
  };
}

function getIndexHistory(symbol, period = "1yr", _filter = "default") {
  const key = String(symbol).toUpperCase();
  const def = INDEX_DEFS.find((d) => d.symbol === key);
  if (!def) {
    const err = new Error(`Unknown index: ${symbol}`);
    err.status = 404;
    throw err;
  }
  const index = getIndexDetail(key);
  // Synthesize an index candle series the same way stock candles are built,
  // anchoring to the index base level so it trails the live level.
  const fakeStock = {
    symbol: def.symbol,
    companyName: def.name,
    previousClose: index.currentPrice,
    avgVolume: 400000000,
    beta: 1.0,
  };
  const map = { "1m": "1m", "6m": "6m", "1yr": "1yr", "5yr": "5yr", "max": "max" };
  const candles = buildCandlesForStock(fakeStock);
  const series = candles[map[period] || "1yr"];
  return sliceForPeriod(series, map[period] || "1yr").map((c) => ({
    datetime: c.datetime,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
}

function getMarketStatus() {
  const info = marketInfo();
  return {
    isOpen: info.isOpen,
    message: info.message,
    lastUpdated: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// Per-stock quote (matches the rich shape market.service.js#getQuote
// expects: companyName, industry, currentPrice, percentChange, yearHigh,
// yearLow, companyProfile, stockTechnicalData, financials).
function getQuote(stockName) {
  const stock = sim.getStock(String(stockName).toUpperCase());
  if (!stock) {
    const err = new Error(`Unknown symbol: ${stockName}`);
    err.status = 404;
    throw err;
  }
  return {
    ...stock,
    // Legacy fields the Flutter app also accepts.
    companyProfile: null,
    stockTechnicalData: null,
    financials: null,
  };
}

function getQuotes(stocks) {
  const out = [];
  for (const s of (stocks || [])) {
    const stock = sim.getStock(String(s).toUpperCase());
    if (!stock) continue;
    out.push({
      ...stock,
      // Aliases the Flutter app expects.
      ticker: stock.symbol,
      name: stock.companyName,
    });
  }
  return out;
}

function getHistory(stockName, period = "1yr", _filter = "default") {
  const symbol = String(stockName).toUpperCase();
  const map = { "1m": "1m", "6m": "6m", "1yr": "1yr", "5yr": "5yr", "max": "max" };
  return sim
    .getCandles(symbol, map[period] || "1yr", "default")
    .map((c) => ({ datetime: c.datetime, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
}

function _quoteForProvider(s) {
  return {
    symbol: s.symbol,
    ticker: s.symbol,
    companyName: s.companyName,
    name: s.companyName,
    currentPrice: s.currentPrice,
    change: s.change,
    percentChange: s.percentChange,
    volume: s.volume,
    open: s.open,
    dayHigh: s.dayHigh,
    dayLow: s.dayLow,
    previousClose: s.previousClose,
    yearHigh: s.yearHigh,
    yearLow: s.yearLow,
    exchange: s.exchange,
    sector: s.sector,
    industry: s.industry,
    type: s.type,
  };
}

// Public: live snapshot of every stock — handy for SSE wiring.
function snapshot() {
  return sim.getSnapshot();
}

// Public: subscribe to per-tick updates for SSE.
function onTick(handler) {
  sim.on("tick", handler);
  return () => sim.off("tick", handler);
}

module.exports = {
  sim,
  search,
  getQuote,
  getQuotes,
  getHistory,
  getIndices,
  getIndexDetail,
  getIndexHistory,
  getMarketStatus,
  getTrending,
  getNSEMostActive,
  getBSEMostActive,
  getPriceShockers,
  get52WeekData,
  snapshot,
  onTick,
};