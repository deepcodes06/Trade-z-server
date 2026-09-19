// =============================================================================
// market-hours.js
// -----------------------------------------------------------------------------
// NSE market-hours awareness (IST, UTC+5:30, no DST).
//   - Weekdays Mon-Fri
//   - Trading window 09:15 - 15:30 IST
// Used by the simulator to freeze prices when the market is closed and by the
// dashboard/SSE to report market status to the app.
// =============================================================================

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // +05:30
const OPEN_MS = (9 * 60 + 15) * 60 * 1000; // 09:15 IST
const CLOSE_MS = (15 * 60 + 30) * 60 * 1000; // 15:30 IST

function marketInfo(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const dow = ist.getUTCDay();
  const isWeekday = dow !== 0 && dow !== 6;
  const dayMs = ist.getUTCHours() * 3600 * 1000 + ist.getUTCMinutes() * 60 * 1000 + ist.getUTCSeconds() * 1000;
  const isOpen = isWeekday && dayMs >= OPEN_MS && dayMs < CLOSE_MS;
  return { ist, isOpen, message: isOpen ? "Market open" : "Market closed" };
}

function isMarketOpen(now = new Date()) {
  return marketInfo(now).isOpen;
}

module.exports = { isMarketOpen, marketInfo };