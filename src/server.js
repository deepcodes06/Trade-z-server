require("dotenv").config();

const http = require("http");
const app = require("./app");

const { connectDB } = require("./config/db");

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await connectDB();

        const server = http.createServer(app);

        server.listen(PORT, () => {
            console.log("================================");
            console.log("🚀 Trade-Z Backend Running");
            console.log(`🌐 http://localhost:${PORT}`);
            console.log("================================");
        });

    } catch (error) {
        console.error(error);
    }
}

startServer();