const Redis = require("ioredis");

const redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        // Stop retrying in production — Redis is optional.
        if (times > 5) return null;
        return Math.min(times * 100, 3000);
    },
    lazyConnect: true,
});

redis.on("connect", () => {
    console.log("Redis connected");
});

redis.on("error", (err) => {
    // Non-fatal — the app works without Redis.
    console.warn("Redis unavailable:", err.message);
});

module.exports = redis;