const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const portfolioRoutes = require("./routes/portfolio.routes");
const tradeRoutes = require("./routes/trade.routes");
const marketRoutes = require("./routes/market.routes");
const watchlistRoutes = require("./routes/watchlist.routes");

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));


const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
});

app.use(limiter);

// Test Route
app.get("/", (req, res) => {
    console.log("✅ Root route hit");

    res.json({
        success: true,
        message: "Welcome to Trade-Z API",
        version: "1.0.0"
    });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/trade", tradeRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/watchlist", watchlistRoutes);
// 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route Not Found",
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

module.exports = app;