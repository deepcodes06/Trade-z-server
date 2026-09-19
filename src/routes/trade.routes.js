const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth.middleware");

const {

    buyStock,

    sellStock,

    getTradeHistory

} = require("../controllers/trade.controller");

router.use(auth);

router.post("/buy", buyStock);

router.post("/sell", sellStock);

router.get("/history", getTradeHistory);

module.exports = router;