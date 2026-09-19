const { prisma } = require("../config/db");

// Create Portfolio Holding
const createPortfolio = async (req, res) => {
    try {

        const { symbol, company, quantity, avgPrice } = req.body;

        const invested = quantity * avgPrice;

        const existing = await prisma.portfolio.findUnique({
            where: {
                userId_symbol: {
                    userId: req.user.id,
                    symbol
                }
            }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Stock already exists in portfolio"
            });
        }

        const portfolio = await prisma.portfolio.create({
            data: {
                symbol: symbol.toUpperCase(),
                company,
                quantity,
                avgPrice,
                invested,
                userId: req.user.id
            }
        });

        return res.status(201).json({
            success: true,
            portfolio
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

// Get Portfolio
const getPortfolio = async (req, res) => {
    try {

        const portfolio = await prisma.portfolio.findMany({
            where: {
                userId: req.user.id
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        return res.json({
            success: true,
            portfolio
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }
};

// Update Holding
const updatePortfolio = async (req, res) => {
    try {

        const { quantity, avgPrice } = req.body;

        const portfolio = await prisma.portfolio.update({
            where: {
                id: req.params.id
            },
            data: {
                quantity,
                avgPrice,
                invested: quantity * avgPrice
            }
        });

        return res.json({
            success: true,
            portfolio
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }
};

// Delete Holding
const deletePortfolio = async (req, res) => {
    try {

        await prisma.portfolio.delete({
            where: {
                id: req.params.id
            }
        });

        return res.json({
            success: true,
            message: "Portfolio deleted"
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
    createPortfolio,
    getPortfolio,
    updatePortfolio,
    deletePortfolio
};