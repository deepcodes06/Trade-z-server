const { prisma } = require("../config/db");

const buyStock = async (req, res) => {

    try {

        const { symbol, company, quantity, price } = req.body;

        if (!symbol || !quantity || !price) {

            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });

        }

        const qty = Number(quantity);
        const buyPrice = Number(price);
        const total = qty * buyPrice;

        // Create BUY transaction
        await prisma.transaction.create({

            data: {

                symbol: symbol.toUpperCase(),

                company,

                quantity: qty,

                price: buyPrice,

                total,

                type: "BUY",

                userId: req.user.id

            }

        });

        // Check portfolio
        const holding = await prisma.portfolio.findUnique({

            where: {

                userId_symbol: {

                    userId: req.user.id,

                    symbol: symbol.toUpperCase()

                }

            }

        });

        // First buy
        if (!holding) {

            const portfolio = await prisma.portfolio.create({

                data: {

                    symbol: symbol.toUpperCase(),

                    company,

                    quantity: qty,

                    avgPrice: buyPrice,

                    invested: total,

                    userId: req.user.id

                }

            });

            return res.status(201).json({

                success: true,

                message: "Stock bought successfully",

                portfolio

            });

        }

        // Existing holding
        const newQuantity = holding.quantity + qty;

        const newAvgPrice = (

            (holding.quantity * holding.avgPrice)

            +

            (qty * buyPrice)

        ) / newQuantity;

        const updatedPortfolio = await prisma.portfolio.update({

            where: {

                id: holding.id

            },

            data: {

                quantity: newQuantity,

                avgPrice: newAvgPrice,

                invested: newQuantity * newAvgPrice

            }

        });

        return res.json({

            success: true,

            message: "Stock bought successfully",

            portfolio: updatedPortfolio

        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

};

const sellStock = async (req, res) => {

    try {

        const { symbol, quantity, price } = req.body;

        if (!symbol || !quantity || !price) {

            return res.status(400).json({

                success: false,

                message: "All fields are required"

            });

        }

        const qty = Number(quantity);

        const sellPrice = Number(price);

        const holding = await prisma.portfolio.findUnique({

            where: {

                userId_symbol: {

                    userId: req.user.id,

                    symbol: symbol.toUpperCase()

                }

            }

        });

        if (!holding) {

            return res.status(404).json({

                success: false,

                message: "Stock not found in portfolio"

            });

        }

        if (holding.quantity < qty) {

            return res.status(400).json({

                success: false,

                message: "Insufficient quantity"

            });

        }

        const total = qty * sellPrice;

        await prisma.transaction.create({

            data: {

                symbol: symbol.toUpperCase(),

                company: holding.company,

                quantity: qty,

                price: sellPrice,

                total,

                type: "SELL",

                userId: req.user.id

            }

        });

        const remainingQuantity = holding.quantity - qty;

        if (remainingQuantity === 0) {

            await prisma.portfolio.delete({

                where: {

                    id: holding.id

                }

            });

            return res.json({

                success: true,

                message: "Position closed"

            });

        }

        const updatedPortfolio = await prisma.portfolio.update({

            where: {

                id: holding.id

            },

            data: {

                quantity: remainingQuantity,

                invested: remainingQuantity * holding.avgPrice

            }

        });

        return res.json({

            success: true,

            message: "Stock sold successfully",

            portfolio: updatedPortfolio

        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

};

const getTradeHistory = async (req, res) => {

    try {

        const history = await prisma.transaction.findMany({

            where: {

                userId: req.user.id

            },

            orderBy: {

                createdAt: "desc"

            }

        });

        return res.json({

            success: true,

            history

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

    buyStock,

    sellStock,

    getTradeHistory

};