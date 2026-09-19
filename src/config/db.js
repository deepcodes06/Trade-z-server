const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
    log: ["query", "info", "warn", "error"]
});

async function connectDB() {
    try {
        await prisma.$connect();
        console.log("✅ PostgreSQL Connected");
    } catch (error) {
        console.error("❌ PostgreSQL Connection Failed");
        console.error(error.message);
        process.exit(1);
    }
}

module.exports = {
    prisma,
    connectDB
};