// Market data provider — the local realtime simulator.
const marketProvider = require("../provider/simulator.provider");

class MarketService {

    // ======================================
    // Dashboard
    // ======================================

    async getDashboard() {

        const [

            trending,

            nseMostActive,

            bseMostActive,

            priceShockers,

            indices,

            marketStatus

        ] = await Promise.all([

            marketProvider.getTrending(),

            marketProvider.getNSEMostActive(),

            marketProvider.getBSEMostActive(),

            marketProvider.getPriceShockers(),

            marketProvider.getIndices(),

            marketProvider.getMarketStatus()

        ]);

        return {

            trending,

            nseMostActive,

            bseMostActive,

            priceShockers,

            indices,

            marketStatus

        };

    }

    // ======================================
    // Single Stock
    // ======================================

    async getQuote(stockName) {

        const stock = await marketProvider.getQuote(stockName);

        // Pass through every field the provider returns so the Flutter
        // StockDetailPage's _quoteFromDetailMap parser (market_repository.dart
        // line 292-317) can pick up open/dayHigh/dayLow/previousClose/volume/
        // yearHigh/yearLow/marketCap/upperCircuit/atp/depth etc. The legacy
        // fields the Flutter app already used are preserved verbatim.
        return {
            ...stock,

            // Aliases the Flutter app also accepts.
            symbol: stock.symbol ?? stockName,
            ticker: stock.ticker ?? stockName,
            stockName: stock.stockName ?? stockName,
            name: stock.name ?? stock.companyName,
            price: stock.currentPrice,
            ltp: stock.currentPrice,
            prevClose: stock.previousClose,
            high: stock.dayHigh,
            low: stock.dayLow,
            fiftyTwoWeekHigh: stock.yearHigh,
            fiftyTwoWeekLow: stock.yearLow,

            // Legacy fields the IndianProvider also returned (placeholders).
            companyProfile: stock.companyProfile ?? null,
            stockTechnicalData: stock.stockTechnicalData ?? null,
            financials: stock.financials ?? null,
        };

    }

    // ======================================
    // Multiple Stocks
    // ======================================

    async getQuotes(stocks) {

        const quotes = await marketProvider.getQuotes(stocks);

        return quotes.map(stock => ({
            ...stock,
            symbol: stock.symbol,
            ticker: stock.symbol,
            name: stock.companyName,
            price: stock.currentPrice,
            ltp: stock.currentPrice,
            high: stock.dayHigh ?? stock.yearHigh,
            low: stock.dayLow ?? stock.yearLow,
            fiftyTwoWeekHigh: stock.yearHigh,
            fiftyTwoWeekLow: stock.yearLow,
            change: stock.change,
            volume: stock.volume,
            open: stock.open,
            dayHigh: stock.dayHigh,
            dayLow: stock.dayLow,
            previousClose: stock.previousClose,
            marketCap: stock.marketCap,
            upperCircuit: stock.upperCircuit,
            lowerCircuit: stock.lowerCircuit,
            circuitPct: stock.circuitPct,
            atp: stock.atp,
            bid: stock.bid,
            ask: stock.ask,
            depth: stock.depth,
            lastUpdated: stock.lastUpdated,
        }));

    }

    // ======================================
    // Search
    // ======================================

    async search(query) {

        return await marketProvider.search(query);

    }

    // ======================================
    // History
    // ======================================

    async getHistory(stockName, period, filter) {

        return await marketProvider.getHistory(

            stockName,

            period,

            filter

        );

    }

    // ======================================
    // Trending
    // ======================================

    async getTrending() {

        return await marketProvider.getTrending();

    }

    // ======================================
    // Index Detail
    // ======================================

    async getIndexDetail(symbol) {

        return await marketProvider.getIndexDetail(symbol);

    }

    // ======================================
    // Index History
    // ======================================

    async getIndexHistory(symbol, period, filter) {

        return await marketProvider.getIndexHistory(symbol, period, filter);

    }

    // ======================================
    // NSE Most Active
    // ======================================

    async getNSEMostActive() {

        return await marketProvider.getNSEMostActive();

    }

    // ======================================
    // BSE Most Active
    // ======================================

    async getBSEMostActive() {

        return await marketProvider.getBSEMostActive();

    }

    // ======================================
    // Price Shockers
    // ======================================

    async getPriceShockers() {

        return await marketProvider.getPriceShockers();

    }

    // ======================================
    // 52 Week Data
    // ======================================

    async get52WeekData() {

        return await marketProvider.get52WeekData();

    }

}

module.exports = new MarketService();