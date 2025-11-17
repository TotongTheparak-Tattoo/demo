const ProductLogService = require("../services/productLog.service");

class ProductLogController {
  async getAllProductLog(req, res) {
    try {
      const {
        page = "1",
        limit = "50",
        statusName = "",
        masterInvoiceNo = "",
        dateFrom = "",
        dateTo = "",
      } = req.query || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(1000, Math.max(1, parseInt(limit, 10) || 50));

      const toStartOfDayUTC = (s) => (s ? new Date(`${s}T00:00:00.000Z`) : null);
      const toEndOfDayUTC = (s) => (s ? new Date(`${s}T23:59:59.999Z`) : null);

      const query = {
        page: pageNum,
        limit: limitNum,
        statusName: String(statusName || "").trim(),
        masterInvoiceNo: String(masterInvoiceNo || "").trim(),
        updatedFrom: toStartOfDayUTC(dateFrom),
        updatedTo: toEndOfDayUTC(dateTo),
      };

      const result = await ProductLogService.searchProductLog(query);

      return res.status(200).json(result);
    } catch (error) {
      console.error("[ProductLogController] getAllProductLog error:", error);
      return res.status(500).json({ message: "Internal server error", detail: error?.message || error });
    }
  }
}

module.exports = new ProductLogController();
