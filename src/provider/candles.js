"use strict";

// =============================================================================
// candles.js
// -----------------------------------------------------------------------------
// Generates deterministic OHLCV candle series for each stock across the chart
// ranges the Flutter StockDetailPage requests via market_api.dart's getHistory:
//   period: '1m' | '6m' | '1yr' | '5yr' | 'max'    (filter always 'default')
//
// Shape per candle (matches market_repository.dart _candleFromMap):
//   { datetime: ISO string, close, high, low, volume }
//
// The '1m' intraday series is special: it has 1-minute bars and the *last*
// bar's close is replaced by the simulator's live currentPrice so the chart
// trails the realtime tick. Other ranges are pure historical placeholders.
// =============================================================================

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// Box-Muller for a single standard-normal sample.
function gauss(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Build a historical candle series using a geometric random walk anchored at
// `previousClose`, walking back in time, then reversing. Volatility is per-bar
// (sigma) and the bar volume scales with the bar's volatility.
function buildSeries({ count, sigma, previousClose, endTime, intervalMin, avgVolume, rng }) {
  const series = [];
  let price = previousClose;
  // Walk forward, recording each bar's close, then synthesize high/low around
  // the open/close.
  for (let i = 0; i < count; i++) {
    const t = new Date(endTime.getTime() - (count - 1 - i) * intervalMin * 60 * 1000);
    const open = price;
    const ret = sigma * gauss(rng);
    const close = round2(Math.max(0.01, open * (1 + ret)));
    const wickHi = Math.abs(sigma * 0.6 * gauss(rng));
    const wickLo = Math.abs(sigma * 0.6 * gauss(rng));
    const high = round2(Math.max(open, close) * (1 + wickHi));
    const low = round2(Math.min(open, close) * (1 - wickLo));
    const volume = Math.max(1, Math.floor(avgVolume * (0.3 + Math.abs(ret) * 6 + rng() * 0.4)));
    series.push({ datetime: t.toISOString(), open: round2(open), high, low, close, volume });
    price = close;
  }
  // Re-anchor the first bar's close to previousClose so the series terminates
  // there (matches the live quote exactly at the end of the window).
  if (series.length) {
    const drift = previousClose / series[0].close;
    for (const b of series) {
      b.open = round2(b.open * drift);
      b.high = round2(b.high * drift);
      b.low = round2(b.low * drift);
      b.close = round2(b.close * drift);
    }
  }
  return series;
}

// Per-stock candle map keyed by period ('1m' | '6m' | '1yr' | '5yr' | 'max').
function buildCandlesForStock(stock) {
  const symbolSeed = [...stock.symbol].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rng = mulberry32(symbolSeed ^ 0x9e3779b9);

  // 1 trading day = ~375 one-minute bars (Indian market 09:15–15:30 IST).
  const dailyVol = Math.max(0.008, Math.min(0.04, 0.012 + stock.beta * 0.01));
  const sixMonthVol = Math.max(0.01, Math.min(0.06, 0.018 + stock.beta * 0.012));

  const endOfDay = new Date();
  endOfDay.setUTCHours(15, 30, 0, 0); // anchor end of intraday window

  const intraday = buildSeries({
    count: 375,
    sigma: dailyVol * 0.25,
    previousClose: stock.previousClose,
    endTime: endOfDay,
    intervalMin: 1,
    avgVolume: Math.max(100, stock.avgVolume / 375),
    rng,
  });

  // 6m: daily bars over 126 trading days.
  const sixMonth = buildSeries({
    count: 126,
    sigma: sixMonthVol,
    previousClose: stock.previousClose,
    endTime: endOfDay,
    intervalMin: 24 * 60, // daily, approximate
    avgVolume: stock.avgVolume,
    rng,
  });

  // 1yr: ~252 daily bars
  const oneYear = buildSeries({
    count: 252,
    sigma: sixMonthVol * 0.95,
    previousClose: stock.previousClose,
    endTime: endOfDay,
    intervalMin: 24 * 60,
    avgVolume: stock.avgVolume,
    rng,
  });

  // 5yr: ~252*5 daily bars
  const fiveYear = buildSeries({
    count: 252 * 5,
    sigma: sixMonthVol * 0.9,
    previousClose: stock.previousClose,
    endTime: endOfDay,
    intervalMin: 24 * 60,
    avgVolume: stock.avgVolume,
    rng,
  });

  // max: ~252*20 daily bars
  const maxRange = buildSeries({
    count: 252 * 20,
    sigma: sixMonthVol * 0.85,
    previousClose: stock.previousClose,
    endTime: endOfDay,
    intervalMin: 24 * 60,
    avgVolume: stock.avgVolume,
    rng,
  });

  return {
    "1m": intraday,
    "6m": sixMonth,
    "1yr": oneYear,
    "5yr": fiveYear,
    "max": maxRange,
  };
}

// Trim a stored candle series so its last bar ends at the requested period
// relative to `now`. The Dart side passes period='1m' etc. via ChartRange.query.
function sliceForPeriod(series, period) {
  const now = Date.now();
  const limits = {
    "1m": 24 * 60 * 60 * 1000,           // 1 trading day
    "6m": 126 * 24 * 60 * 60 * 1000,
    "1yr": 252 * 24 * 60 * 60 * 1000,
    "5yr": 5 * 252 * 24 * 60 * 60 * 1000,
    "max": 20 * 252 * 24 * 60 * 60 * 1000,
  };
  const limit = limits[period] ?? limits["1yr"];
  const cutoff = now - limit;
  return series.filter((c) => new Date(c.datetime).getTime() >= cutoff);
}

module.exports = { buildCandlesForStock, sliceForPeriod };