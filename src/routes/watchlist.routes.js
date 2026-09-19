const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth.middleware");

const {
    getWatchlists,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    addSymbol,
    removeSymbol
} = require("../controllers/watchlist.controller");

router.use(auth);

router.get("/", getWatchlists);

router.post("/", createWatchlist);

router.put("/:id", renameWatchlist);

router.delete("/:id", deleteWatchlist);

router.post("/:id/symbols", addSymbol);

router.delete("/:id/symbols/:symbol", removeSymbol);

module.exports = router;