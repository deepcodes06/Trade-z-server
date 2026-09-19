"use strict";

// =============================================================================
// generate_catalog.js
// -----------------------------------------------------------------------------
// Builds stock_catalog.json — the static broker-data foundation that the
// realtime simulator loads at startup. One entry per stock with every field
// the Flutter StockDetailPage consumes (parsed in market_repository.dart's
// _quoteFromDetailMap and _candleFromMap), plus the fields that currently
// render as "—" placeholders on the detail screen (Market Cap, Upper/Lower
// Circuit, ATP) and the 5-level bid/ask depth that fills _MarketDepthCard.
//
// Deterministic: mulberry32 seeded so reruns produce byte-identical output.
//
// Usage:  node generate_catalog.js
// Output: stock_catalog.json
// =============================================================================

const fs = require("fs");
const path = require("path");

const SEED = 1337;
const OUT = path.join(__dirname, "stock_catalog.json");

// ---------------------------------------------------------------------------
// Base stock list (mirrors generate_stocks.*) — symbol, company, base price.
// ---------------------------------------------------------------------------
const BASE_STOCKS = [
  ["RELIANCE", "Reliance Industries", 2860.45],
  ["TCS", "Tata Consultancy Services", 3890.2],
  ["HDFCBANK", "HDFC Bank", 1650.75],
  ["INFY", "Infosys", 1480.3],
  ["ICICIBANK", "ICICI Bank", 1120.6],
  ["SBIN", "State Bank of India", 780.15],
  ["BHARTIARTL", "Bharti Airtel", 1350.9],
  ["ITC", "ITC", 435.25],
  ["KOTAKBANK", "Kotak Mahindra Bank", 1780.4],
  ["LT", "Larsen & Toubro", 3450.8],
  ["AXISBANK", "Axis Bank", 1105.55],
  ["WIPRO", "Wipro", 480.35],
  ["HINDUNILVR", "Hindustan Unilever", 2440.1],
  ["BAJFINANCE", "Bajaj Finance", 6980.9],
  ["BAJAJFINSV", "Bajaj Finserv", 1620.9],
  ["MARUTI", "Maruti Suzuki India", 11020.0],
  ["ASIANPAINT", "Asian Paints", 2860.3],
  ["SUNPHARMA", "Sun Pharmaceutical", 1520.65],
  ["TITAN", "Titan Company", 3400.25],
  ["ULTRACEMCO", "UltraTech Cement", 10850.0],
  ["NESTLEIND", "Nestle India", 2500.1],
  ["POWERGRID", "Power Grid Corp", 300.55],
  ["M&M", "Mahindra & Mahindra", 2480.7],
  ["NTPC", "NTPC", 340.1],
  ["TECHM", "Tech Mahindra", 1300.45],
  ["TATAMOTORS", "Tata Motors", 950.25],
  ["TATASTEEL", "Tata Steel", 145.4],
  ["JSWSTEEL", "JSW Steel", 830.15],
  ["INDUSINDBK", "IndusInd Bank", 1380.55],
  ["ADANIENT", "Adani Enterprises", 2900.45],
  ["ADANIPORTS", "Adani Ports & SEZ", 1450.8],
  ["COALINDIA", "Coal India", 460.8],
  ["BPCL", "Bharat Petroleum Corp", 330.25],
  ["CIPLA", "Cipla", 1500.6],
  ["DIVISLAB", "Divi's Laboratories", 3800.15],
  ["DRREDDY", "Dr Reddy's Laboratories", 6800.0],
  ["EICHERMOT", "Eicher Motors", 4600.9],
  ["GRASIM", "Grasim Industries", 2500.4],
  ["HCLTECH", "HCL Technologies", 1355.3],
  ["HEROMOTOCO", "Hero MotoCorp", 4600.75],
  ["HINDALCO", "Hindalco Industries", 630.2],
  ["APOLLOHOSP", "Apollo Hospitals", 6300.0],
  ["BRITANNIA", "Britannia Industries", 5300.55],
  ["BANDHANBNK", "Bandhan Bank", 180.4],
  ["BAJAJ-AUTO", "Bajaj Auto", 8900.0],
  ["SHRIRAMFIN", "Shriram Finance", 2800.3],
  ["SBILIFE", "SBI Life Insurance", 1450.15],
  ["HDFCLIFE", "HDFC Life Insurance", 690.8],
  ["ONGC", "Oil & Natural Gas Corp", 265.45],
  ["LTIM", "LTIMindtree", 5600.0],
  ["TATACONSUM", "Tata Consumer Products", 1100.25],
  ["ADANIPOWER", "Adani Power", 600.5],
  ["AMBUJACEM", "Ambuja Cements", 590.75],
  ["BEL", "Bharat Electronics", 290.6],
  ["BHEL", "Bharat Heavy Electricals", 210.3],
  ["CANBK", "Canara Bank", 105.45],
  ["CDSL", "Central Depository Services", 1900.8],
  ["CHOLAFIN", "Cholamandalam Investment", 1300.25],
  ["DABUR", "Dabur India", 520.9],
  ["DALBHARAT", "Dalmia Bharat", 1850.4],
  ["DLF", "DLF", 790.2],
  ["DMART", "Avenue Supermarts", 4500.0],
  ["GAIL", "GAIL India", 195.35],
  ["GODREJCP", "Godrej Consumer Products", 1150.6],
  ["GODREJPROP", "Godrej Properties", 2800.9],
  ["HAL", "Hindustan Aeronautics", 4200.0],
  ["HAVELLS", "Havells India", 1650.75],
  ["HDFCAMC", "HDFC Asset Management", 4400.2],
  ["HINDCOPPER", "Hindustan Copper", 270.45],
  ["HINDPETRO", "Hindustan Petroleum", 320.85],
  ["IDFCFIRSTB", "IDFC First Bank", 72.15],
  ["INDIGO", "InterGlobe Aviation", 4300.5],
  ["INDIANB", "Indian Bank", 520.3],
  ["IRCTC", "Indian Railway Catering", 780.65],
  ["IRFC", "IRFC", 145.2],
  ["JINDALSTEL", "Jindal Steel & Power", 950.4],
  ["JIOFIN", "Jio Financial Services", 300.75],
  ["LICHSGFIN", "LIC Housing Finance", 560.9],
  ["LICI", "Life Insurance Corp", 890.25],
  ["MANAPPURAM", "Manappuram Finance", 180.15],
  ["MUTHOOTFIN", "Muthoot Finance", 1800.0],
  ["NAUKRI", "Info Edge", 5900.0],
  ["NHPC", "NHPC", 88.4],
  ["OIL", "Oil India", 480.75],
  ["PATANJALI", "Patanjali Foods", 1450.2],
  ["PFC", "Power Finance Corp", 430.55],
  ["PIDILITIND", "Pidilite Industries", 3100.6],
  ["PNB", "Punjab National Bank", 95.3],
  ["RECLTD", "REC", 460.45],
  ["SAIL", "Steel Authority of India", 130.85],
  ["SIEMENS", "Siemens", 6500.0],
  ["TATAPOWER", "Tata Power", 390.25],
  ["TVSMOTOR", "TVS Motor", 2600.9],
  ["UBL", "United Breweries", 1900.6],
  ["UNIONBANK", "Union Bank of India", 120.15],
  ["UPL", "UPL", 560.4],
  ["VEDL", "Vedanta", 440.3],
  ["YESBANK", "Yes Bank", 18.85],
  ["ZOMATO", "Zomato", 240.2],
  ["ZYDUSLIFE", "Zydus Lifesciences", 1000.75],
  ["AUBANK", "AU Small Finance Bank", 650.9],
];

// ---------------------------------------------------------------------------
// Sector + industry classification (loosely maps NSE listing groups).
// ---------------------------------------------------------------------------
const SECTOR_MAP = [
  { sector: "Energy", industry: "Oil & Gas - Integrated" },
  { sector: "Technology", industry: "IT Services & Consulting" },
  { sector: "Financials", industry: "Private Banks" },
  { sector: "Financials", industry: "Public Banks" },
  { sector: "Telecom", industry: "Telecom Services" },
  { sector: "Consumer Staples", industry: "Tobacco / FMCG" },
  { sector: "Automobile", industry: "Four Wheelers" },
  { sector: "Automobile", industry: "Two Wheelers" },
  { sector: "Healthcare", industry: "Pharmaceuticals" },
  { sector: "Consumer Durables", industry: "Watches / Jewellery" },
  { sector: "Materials", industry: "Cement" },
  { sector: "Materials", industry: "Aluminium / Metals" },
  { sector: "Materials", industry: "Steel" },
  { sector: "Utilities", industry: "Power Generation" },
  { sector: "Utilities", industry: "Power Transmission" },
  { sector: "Realty", industry: "Real Estate Developers" },
  { sector: "Consumer Discretionary", industry: "Retail / E-commerce" },
  { sector: "Industrials", industry: "Aerospace & Defence" },
  { sector: "Industrials", industry: "Electrical Equipment" },
  { sector: "Financials", industry: "NBFC - Consumer" },
  { sector: "Financials", industry: "Insurance - Life" },
  { sector: "Services", industry: "Railways / Travel" },
];

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32).
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);
const rand = (min, max) => min + rng() * (max - min);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------
function round2(v) {
  return Math.round(v * 100) / 100;
}
function roundN(v, n) {
  const f = Math.pow(10, n);
  return Math.round(v * f) / f;
}
function isoDateOffset(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Realistic NSE circuit bands: most stocks are 5% (group A), some 2% or 10%.
const CIRCUIT_PCTS = [0.02, 0.05, 0.05, 0.05, 0.05, 0.05, 0.1, 0.2];

// ---------------------------------------------------------------------------
// Build one stock entry.
// ---------------------------------------------------------------------------
function buildStock(symbol, company, basePrice) {
  const cls = pick(SECTOR_MAP);

  // Session: previous close is the reference; open is near it; currentPrice
  // starts within a small range so it isn't suspicious.
  const previousClose = round2(basePrice);
  const open = round2(previousClose * (1 + rand(-0.012, 0.012)));
  const dayHighSeed = round2(Math.max(open, previousClose) * (1 + rand(0.0, 0.018)));
  const dayLowSeed = round2(Math.min(open, previousClose) * (1 - rand(0.0, 0.018)));
  const currentPrice = round2(open + (dayHighSeed - dayLowSeed) * rng());
  const change = round2(currentPrice - previousClose);
  const percentChange = previousClose === 0 ? 0 : round2((change / previousClose) * 100);

  // 52-week band: ~15–45% above, ~15–35% below base.
  const yearHigh = round2(basePrice * (1 + rand(0.15, 0.45)));
  const yearLow = round2(basePrice * (1 - rand(0.15, 0.35)));

  // Fundamentals.
  const sharesOutstanding = Math.floor(rand(50, 8000) * 1e7); // 50M–8B shares
  const marketCap = round2(currentPrice * sharesOutstanding);
  const peRatio = round2(rand(8, 65));
  const eps = round2(peRatio === 0 ? 0 : currentPrice / peRatio);
  const bookValue = round2(currentPrice * rand(0.25, 0.85));
  const dividendYield = round2(rand(0, 4.5)); // %
  const beta = round2(rand(0.4, 1.8));
  const faceValue = pick([1, 2, 5, 10]);

  // Lot size — NSE rounds to nearest lot per stock; typical 1–1500.
  const lotSize = pick([1, 1, 1, 25, 50, 75, 100, 150, 250, 500, 1000, 1500]);

  // Volume stats — keep magnitude plausible vs marketCap.
  const avgVolume = Math.floor(rand(0.2, 4.0) * 1e6); // ~200k–4M shares avg
  const volume = Math.floor(avgVolume * rand(0.4, 1.6));

  // Spread around currentPrice.
  const spread = Math.max(0.05, currentPrice * 0.0008);
  const bid = round2(currentPrice - spread);
  const ask = round2(currentPrice + spread);

  // Circuit limits and ATP.
  const circuitPct = pick(CIRCUIT_PCTS);
  const upperCircuit = round2(previousClose * (1 + circuitPct));
  const lowerCircuit = round2(previousClose * (1 - circuitPct));
  const atp = round2((dayHighSeed + dayLowSeed + currentPrice) / 3);

  return {
    // Identity.
    symbol,
    companyName: company,
    exchange: "NSE",
    sector: cls.sector,
    industry: cls.industry,
    type: "Common Stock",

    // Quote/session.
    currentPrice,
    previousClose,
    open,
    dayHigh: dayHighSeed,
    dayLow: dayLowSeed,
    change,
    percentChange,
    volume,
    avgVolume,
    bid,
    ask,

    // 52-week.
    yearHigh,
    yearHighDate: isoDateOffset(Math.floor(rand(0, 250))),
    yearLow,
    yearLowDate: isoDateOffset(Math.floor(rand(150, 360))),

    // Fundamentals.
    marketCap,
    sharesOutstanding,
    peRatio,
    eps,
    bookValue,
    dividendYield,
    beta,
    faceValue,
    lotSize,

    // Circuit + ATP.
    upperCircuit,
    lowerCircuit,
    circuitPct,
    atp,
  };
}

// ---------------------------------------------------------------------------
// Build the 5-level order book (market depth) for a stock. Updated by the
// simulator on each tick, but seed values here so the first snapshot already
// has plausible bids/asks if the simulator is bypassed.
// ---------------------------------------------------------------------------
function buildDepth(price, volume, lotSize) {
  const tick = Math.max(0.05, price * 0.0005);
  const baseQty = Math.max(lotSize, Math.floor((volume / 5000) * rand(0.4, 1.5)));
  const bids = [];
  const asks = [];
  for (let i = 1; i <= 5; i++) {
    const bidPrice = round2(price - tick * i);
    const askPrice = round2(price + tick * i);
    bids.push({
      price: bidPrice,
      quantity: Math.max(lotSize, Math.floor(baseQty * rand(0.4, 1.8) * (1 + i * 0.15))),
      orders: Math.floor(rand(3, 25)),
    });
    asks.push({
      price: askPrice,
      quantity: Math.max(lotSize, Math.floor(baseQty * rand(0.4, 1.8) * (1 + i * 0.15))),
      orders: Math.floor(rand(3, 25)),
    });
  }
  return { bids, asks, totalBuyQty: bids.reduce((s, b) => s + b.quantity, 0), totalSellQty: asks.reduce((s, a) => s + a.quantity, 0) };
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
function main() {
  const stocks = BASE_STOCKS.map(([symbol, company, basePrice]) => {
    const entry = buildStock(symbol, company, basePrice);
    entry.depth = buildDepth(entry.currentPrice, entry.volume, entry.lotSize);
    return entry;
  });

  // Write deterministic, pretty JSON so diffs are reviewable.
  const out = {
    generatedAt: new Date().toISOString(),
    seed: SEED,
    count: stocks.length,
    stocks,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  const sample = stocks[0];
  console.log(`Wrote ${stocks.length} stocks to ${OUT}`);
  console.log(
    `Sample ${sample.symbol}: price=${sample.currentPrice} prev=${sample.previousClose} ` +
      `52wH=${sample.yearHigh} 52wL=${sample.yearLow} mcap=${sample.marketCap} ` +
      `UC=${sample.upperCircuit} LC=${sample.lowerCircuit} atp=${sample.atp} ` +
      `depth=${sample.depth.bids.length}+${sample.depth.asks.length}`,
  );
}

main();