const { prisma } = require("../config/db");

const getProfile = async (req, res) => {
    try {

        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.json({
            success: true,
            user
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

const updateProfile = async (req, res) => {

    try {

        const { name, phone } = req.body;

        const user = await prisma.user.update({

            where: {
                id: req.user.id
            },

            data: {
                name,
                phone: phone || null
            },

            select: {
                id: true,
                name: true,
                email: true,
                phone: true
            }

        });

        return res.json({
            success: true,
            user
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

module.exports = {
    getProfile,
    updateProfile
};