const express = require("express");
const streamController = require("../controllers/market.stream.controller");
const router = express.Router();

const {

    getDashboard,

    getQuote,

    getQuotes,

    search,

    getHistory,

    getTrending,

    getNSEMostActive,

    getBSEMostActive,

    getPriceShockers,

    get52WeekData,

    getIndexDetail,

    getIndexHistory

} = require("../controllers/market.controller");

// ======================================
// Dashboard
// ======================================

router.get("/dashboard", getDashboard);

// ======================================
// Live SSE price stream (realtime ticks)
// ======================================

router.get("/stream", streamController.stream);

// ======================================
// Search
// ======================================

router.get("/search", search);

// ======================================
// Stocks
// ======================================

router.get("/quote/:stockName", getQuote);

router.post("/quotes", getQuotes);

router.get("/history/:stockName", getHistory);

// ======================================
// Market
// ======================================

router.get("/trending", getTrending);

router.get("/nse-most-active", getNSEMostActive);

router.get("/bse-most-active", getBSEMostActive);

router.get("/price-shockers", getPriceShockers);

router.get("/52week", get52WeekData);

// ======================================
// Indices
// ======================================

router.get("/indices/:symbol", getIndexDetail);

router.get("/index-history/:symbol", getIndexHistory);

module.exports = router;