const bcrypt = require("bcrypt");
const crypto = require("crypto");

const db = require("../config/db");

const { prisma } = db;

const { generateAccessToken } = require("../utils/token");

const HUNDRED_DAYS_MS = 100 * 24 * 60 * 60 * 1000;

const signup = async (req, res) => {

    try {
        const { name, email, password, phone } = req.body;

        const exists = await prisma.user.findUnique({
            where: { email }
        });

        if (exists) {

            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });

        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const user =
            await prisma.user.create({

                data: {

                    name,

                    email,

                    password: hashedPassword,

                    phone: phone || null

                }

            });
            

        const accessToken =
            generateAccessToken(user.id);

        const refreshToken =
            crypto.randomBytes(64).toString("hex");

        await prisma.refreshToken.create({

            data: {

                token: refreshToken,

                expiresAt: new Date(
                    Date.now() + HUNDRED_DAYS_MS
                ),

                userId: user.id

            }

        });

        return res.status(201).json({

            success: true,

            accessToken,

            refreshToken,

            user: {

                id: user.id,

                name: user.name,

                email: user.email,

                phone: user.phone

            }

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

};

const login = async (req, res) => {

    try {

        const { email, password } = req.body;

        const user =
            await prisma.user.findUnique({
                where: { email }
            });

        if (!user) {

            return res.status(400).json({
                success: false,
                message: "Invalid Credentials"
            });

        }

        const valid =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!valid) {

            return res.status(400).json({

                success: false,

                message: "Invalid Credentials"

            });

        }

        const accessToken =
            generateAccessToken(user.id);

        const refreshToken =
            crypto.randomBytes(64).toString("hex");

        await prisma.refreshToken.upsert({

            where: {
                userId: user.id
            },

            update: {

                token: refreshToken,

                expiresAt: new Date(
                    Date.now() + HUNDRED_DAYS_MS
                )

            },

            create: {

                token: refreshToken,

                expiresAt: new Date(
                    Date.now() + HUNDRED_DAYS_MS
                ),

                userId: user.id

            }

        });

        return res.json({

            success: true,

            accessToken,

            refreshToken,

            user: {

                id: user.id,

                name: user.name,

                email: user.email,

                phone: user.phone

            }

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

};

module.exports = {

    signup,

    login

};