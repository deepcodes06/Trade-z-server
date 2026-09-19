// =============================================================================
// market.stream.controller.js
// -----------------------------------------------------------------------------
// SSE endpoint that streams the simulator's per-tick price updates to the
// Flutter app. Wire it in market.routes.js as:
//
//     const streamController = require("../controllers/market.stream.controller");
//     router.get("/stream", streamController.stream);
// =============================================================================

const marketProvider = require("../provider/simulator.provider");

async function stream(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no",
  });

  const writeEvent = (eventName, data) => {
    if (eventName) res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  writeEvent("snapshot", {
    success: true,
    message: "Success",
    marketStatus: marketProvider.getMarketStatus(),
    data: marketProvider.snapshot(),
  });

  const heartbeat = setInterval(() => res.write(`: heartbeat ${Date.now()}\n\n`), 15000);
  const off = marketProvider.onTick((payload) => writeEvent("tick", payload));

  req.on("close", () => {
    clearInterval(heartbeat);
    off();
  });
}

module.exports = { stream };