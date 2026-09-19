const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth.middleware");

const {
    createPortfolio,
    getPortfolio,
    updatePortfolio,
    deletePortfolio
} = require("../controllers/portfolio.controller");

router.use(auth);

router.post("/", createPortfolio);

router.get("/", getPortfolio);

router.put("/:id", updatePortfolio);

router.delete("/:id", deletePortfolio);

module.exports = router;