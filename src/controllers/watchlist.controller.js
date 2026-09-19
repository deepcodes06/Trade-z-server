const { prisma } = require("../config/db");

const MAX_LISTS = 5;
const MAX_SYMBOLS_PER_LIST = 50;

const _include = {
    items: {
        orderBy: {
            createdAt: "asc"
        }
    }
};

const _serialize = (list) => ({
    id: list.id,
    name: list.name,
    symbols: (list.items || []).map((item) => ({
        id: item.id,
        symbol: item.symbol,
        company: item.company
    }))
});

// Get All Watchlists
const getWatchlists = async (req, res) => {
    try {

        const lists = await prisma.watchlist.findMany({
            where: {
                userId: req.user.id
            },
            include: _include,
            orderBy: {
                createdAt: "asc"
            }
        });

        return res.json({
            success: true,
            watchlists: lists.map(_serialize)
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

// Create Watchlist
const createWatchlist = async (req, res) => {
    try {

        const { name } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({
                success: false,
                message: "Watchlist name is required"
            });
        }

        const cleanedName = String(name).trim();

        const count = await prisma.watchlist.count({
            where: {
                userId: req.user.id
            }
        });

        if (count >= MAX_LISTS) {
            return res.status(400).json({
                success: false,
                message: `Maximum ${MAX_LISTS} watchlists allowed`
            });
        }

        const existing = await prisma.watchlist.findFirst({
            where: {
                userId: req.user.id,
                name: cleanedName
            }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Watchlist with this name already exists"
            });
        }

        const watchlist = await prisma.watchlist.create({
            data: {
                name: cleanedName,
                userId: req.user.id
            },
            include: _include
        });

        return res.status(201).json({
            success: true,
            watchlist: _serialize(watchlist)
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

// Rename Watchlist
const renameWatchlist = async (req, res) => {
    try {

        const { name } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({
                success: false,
                message: "Watchlist name is required"
            });
        }

        const cleanedName = String(name).trim();

        const existing = await prisma.watchlist.findFirst({
            where: {
                userId: req.user.id,
                id: { not: req.params.id },
                name: cleanedName
            }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Watchlist with this name already exists"
            });
        }

        const watchlist = await prisma.watchlist.update({
            where: {
                id: req.params.id
            },
            data: {
                name: cleanedName
            },
            include: _include
        });

        return res.json({
            success: true,
            watchlist: _serialize(watchlist)
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

// Delete Watchlist
const deleteWatchlist = async (req, res) => {
    try {

        await prisma.watchlist.delete({
            where: {
                id: req.params.id
            }
        });

        return res.json({
            success: true,
            message: "Watchlist deleted"
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

// Add Symbol To Watchlist
const addSymbol = async (req, res) => {
    try {

        const { symbol, company } = req.body;

        if (!symbol || !String(symbol).trim()) {
            return res.status(400).json({
                success: false,
                message: "Symbol is required"
            });
        }

        const watchlist = await prisma.watchlist.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: {
                _count: {
                    select: { items: true }
                }
            }
        });

        if (!watchlist) {
            return res.status(404).json({
                success: false,
                message: "Watchlist not found"
            });
        }

        if (watchlist._count.items >= MAX_SYMBOLS_PER_LIST) {
            return res.status(400).json({
                success: false,
                message: `Maximum ${MAX_SYMBOLS_PER_LIST} stocks allowed per watchlist`
            });
        }

        const cleanedSymbol = String(symbol).toUpperCase();

        const existing = await prisma.watchlistItem.findUnique({
            where: {
                watchlistId_symbol: {
                    watchlistId: req.params.id,
                    symbol: cleanedSymbol
                }
            }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Stock already exists in watchlist"
            });
        }

        const item = await prisma.watchlistItem.create({
            data: {
                watchlistId: req.params.id,
                symbol: cleanedSymbol,
                company: company || null
            }
        });

        return res.status(201).json({
            success: true,
            symbol: {
                id: item.id,
                symbol: item.symbol,
                company: item.company
            }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

// Remove Symbol From Watchlist
const removeSymbol = async (req, res) => {
    try {

        const { symbol } = req.params;
        const cleanedSymbol = String(symbol).toUpperCase();

        const watchlist = await prisma.watchlist.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!watchlist) {
            return res.status(404).json({
                success: false,
                message: "Watchlist not found"
            });
        }

        await prisma.watchlistItem.delete({
            where: {
                watchlistId_symbol: {
                    watchlistId: req.params.id,
                    symbol: cleanedSymbol
                }
            }
        });

        return res.json({
            success: true,
            message: "Stock removed from watchlist"
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

module.exports = {
    getWatchlists,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    addSymbol,
    removeSymbol
};