const MonthlyDataLogService = require("../services/monthlyDataLog.service");

class MonthlyDataLogController {
  async list(req, res) {
    try {
      const {
        page = "1",
        limit = "50",
        invoiceNo = "",
        ctrlDeclarationNo = "",
        currency = "",
        action = "",
        dateFrom = "",
        dateTo = "",
      } = req.query || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

      const toStartOfDayUTC = (s) => (s ? new Date(`${s}T00:00:00.000Z`) : null);
      const toEndOfDayUTC = (s) => (s ? new Date(`${s}T23:59:59.999Z`) : null);

      const query = {
        page: pageNum,
        limit: limitNum,
        invoiceNo: String(invoiceNo || "").trim(),
        ctrlDeclarationNo: String(ctrlDeclarationNo || "").trim(),
        currency: String(currency || "").trim(),
        action: String(action || "").trim(),
        createdAtFrom: toStartOfDayUTC(dateFrom),
        createdAtTo: toEndOfDayUTC(dateTo),
      };

      const result = await MonthlyDataLogService.searchMonthlyDataLog(query);

      return res.status(200).json(result);
    } catch (error) {
      console.error("[MonthlyDataLogController] list error:", error);
      return res.status(500).json({ message: "Internal server error", detail: error?.message || error });
    }
  }
}

module.exports = new MonthlyDataLogController();


