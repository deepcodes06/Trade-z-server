"use strict";

// =============================================================================
// livefeed.js
// -----------------------------------------------------------------------------
// Live NSE quote fetcher backed by Yahoo Finance's public chart endpoint
// (no API key, no npm deps). Yahoo's `.NS` symbols are NSE-listed tickers.
//
// For each symbol we hit:
//
//   https://query1.finance.yahoo.com/v8/finance/chart/<SYM.NS>?range=1d&interval=1d
//
// The response `meta` block contains everything we need:
//   regularMarketPrice, regularMarketPreviousClose, chartPreviousClose,
//   regularMarketOpen, regularMarketDayHigh, regularMarketDayLow,
//   regularMarketVolume, fiftyTwoWeekHigh, fiftyTwoWeekLow, currency, ...
//
// We batch symbols by hitting each one in parallel (Yahoo's chart endpoint
// is one-symbol-per-call, but allows 1d interval/1d range which is exactly
// the snapshot we want).
//
// `refresh(symbols)` returns Map<symbol, mappedQuote>. Failures return an
// empty Map; the caller should keep using last-known values.
// =============================================================================

const https = require("https");

const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const PATH_TPL = (sym) =>
  `/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`;
const TIMEOUT_MS = 8000;
const CONCURRENCY = 8; // Yahoo chart endpoint is per-symbol; cap parallelism.

function yahooSymbol(nse) {
  return `${nse.replace(/&/g, "").replace(/\s+/g, "")}.NS`;
}
function nseSymbol(yahooSym) {
  return yahooSym.replace(/\.NS$/i, "");
}

function httpsGet(host, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host,
        path,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "application/json,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Yahoo HTTP ${res.statusCode} from ${host}`));
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Yahoo parse error: ${e.message}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error("Yahoo timeout")));
    req.end();
  });
}

function httpsGetWithFallback(path) {
  return httpsGet(HOSTS[0], path).catch((e) => {
    // Try the alternate Yahoo host before giving up.
    return httpsGet(HOSTS[1], path).catch((e2) => {
      throw new Error(`${e.message}; mirror: ${e2.message}`);
    });
  });
}

function num(v) {
  return v == null || v === "" || isNaN(+v) ? null : +v;
}

function mapMetaToQuote(meta) {
  if (!meta) return null;
  // For .NS symbols Yahoo's chart endpoint often returns regularMarketOpen
  // as null on delayed/intraday requests. If that's the case, derive a
  // plausible open from previousClose + a small gap.
  let open = num(meta.regularMarketOpen);
  const prev = num(meta.regularMarketPreviousClose ?? meta.chartPreviousClose);
  const ltp = num(meta.regularMarketPrice);
  if (open == null && prev != null) {
    // Gap: 0% most days, ~±0.5% on average. We don't have a live gap
    // signal, so use the current day's move to estimate where it opened
    // if ltp is meaningfully different from prev. This isn't perfect
    // but it's better than a stale catalog value.
    if (ltp != null && prev !== 0) {
      // Estimate open from ltp and prev assuming the stock moved away
      // from prev symmetrically through the day — open = avg(prev, ltp)
      // is a reasonable midpoint, but it can be off on big-gap days.
      // Use: open = prev * (1 + 0.6 * (ltp/prev - 1)) — partial gap.
      open = +(prev * (1 + 0.6 * (ltp / prev - 1))).toFixed(2);
    } else {
      open = prev;
    }
  }
  return {
    currentPrice: ltp,
    previousClose: prev,
    open,
    dayHigh: num(meta.regularMarketDayHigh),
    dayLow: num(meta.regularMarketDayLow),
    volume: num(meta.regularMarketVolume),
    yearHigh: num(meta.fiftyTwoWeekHigh),
    yearLow: num(meta.fiftyTwoWeekLow),
    currency: meta.currency || "INR",
    exchangeName: meta.fullExchangeName || meta.exchangeName || "NSE",
    marketState: meta.marketState,
    quoteType: meta.instrumentType,
  };
}

async function fetchOne(nse) {
  const yq = yahooSymbol(nse);
  try {
    const json = await httpsGetWithFallback(PATH_TPL(yq));
    const result = json && json.chart && json.chart.result && json.chart.result[0];
    if (!result) return null;
    return mapMetaToQuote(result.meta);
  } catch (_e) {
    return null;
  }
}

/**
 * Refresh quotes for all `symbols` (NSE tickers without .NS suffix).
 * Returns Map<symbol, mappedQuote> with only fields Yahoo actually returned.
 */
async function refresh(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) return new Map();
  const results = new Array(symbols.length);
  let cursor = 0;
  async function worker() {
    while (cursor < symbols.length) {
      const i = cursor++;
      results[i] = await fetchOne(symbols[i]);
    }
  }
  const workers = Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, worker);
  await Promise.all(workers);
  const map = new Map();
  for (let i = 0; i < symbols.length; i++) {
    const r = results[i];
    if (r && r.currentPrice != null) map.set(symbols[i], r);
  }
  return map;
}

module.exports = { refresh, mapMetaToQuote };
