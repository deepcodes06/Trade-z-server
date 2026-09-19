const marketService = require("../services/market.service");
const response = require("../utils/response");

// ======================================
// Dashboard
// ======================================

const getDashboard = async (req, res) => {
    try {

        const data = await marketService.getDashboard();

        return response.success(
            res,
            data,
            "Dashboard fetched successfully"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Failed to fetch dashboard"
        );

    }
};

// ======================================
// Single Stock
// ======================================

const getQuote = async (req, res) => {

    try {

        const data = await marketService.getQuote(
            req.params.stockName
        );

        return response.success(
            res,
            data,
            "Stock fetched successfully"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Failed to fetch stock"
        );

    }

};

// ======================================
// Multiple Stocks
// ======================================

const getQuotes = async (req, res) => {

    try {

        const { stocks } = req.body;

        const data = await marketService.getQuotes(stocks);

        return response.success(
            res,
            data,
            "Stocks fetched successfully"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Failed to fetch stocks"
        );

    }

};

// ======================================
// Search
// ======================================

const search = async (req, res) => {

    try {

        const data = await marketService.search(
            req.query.query
        );

        return response.success(
            res,
            data,
            "Search completed"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Search failed"
        );

    }

};

// ======================================
// Historical Data
// ======================================

const getHistory = async (req, res) => {

    try {

        const data = await marketService.getHistory(
            req.params.stockName,
            req.query.period,
            req.query.filter
        );

        return response.success(
            res,
            data,
            "Historical data fetched"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Failed to fetch historical data"
        );

    }

};

// ======================================
// Trending
// ======================================

const getTrending = async (req, res) => {

    try {

        const data = await marketService.getTrending();

        return response.success(
            res,
            data,
            "Trending stocks fetched"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Failed to fetch trending stocks"
        );

    }

};

// ======================================
// NSE Most Active
// ======================================

const getNSEMostActive = async (req, res) => {

    try {

        const data = await marketService.getNSEMostActive();

        return response.success(
            res,
            data,
            "NSE Most Active fetched"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Failed to fetch NSE Most Active"
        );

    }

};

// ======================================
// BSE Most Active
// ======================================

const getBSEMostActive = async (req, res) => {

    try {

        const data = await marketService.getBSEMostActive();

        return response.success(
            res,
            data,
            "BSE Most Active fetched"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Failed to fetch BSE Most Active"
        );

    }

};

// ======================================
// Price Shockers
// ======================================

const getPriceShockers = async (req, res) => {

    try {

        const data = await marketService.getPriceShockers();

        return response.success(
            res,
            data,
            "Price Shockers fetched"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Failed to fetch Price Shockers"
        );

    }

};

// ======================================
// 52 Week High / Low
// ======================================

const get52WeekData = async (req, res) => {

    try {

        const data = await marketService.get52WeekData();

        return response.success(
            res,
            data,
            "52 Week data fetched"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Failed to fetch 52 Week data"
        );

    }

};

// ======================================
// Index Detail
// ======================================

const getIndexDetail = async (req, res) => {

    try {

        const data = await marketService.getIndexDetail(
            req.params.symbol
        );

        return response.success(
            res,
            data,
            "Index data fetched"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Failed to fetch index data"
        );

    }

};

// ======================================
// Index History
// ======================================

const getIndexHistory = async (req, res) => {

    try {

        const data = await marketService.getIndexHistory(
            req.params.symbol,
            req.query.period,
            req.query.filter
        );

        return response.success(
            res,
            data,
            "Index historical data fetched"
        );

    } catch (error) {

        console.error(error);

        return response.error(
            res,
            error.message || "Failed to fetch index historical data"
        );

    }

};

module.exports = {

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

};