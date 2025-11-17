const MrRequestLogService = require("../services/mrRequestLog.service");

class MrRequestLogController {
  async getAllMrRequestLog(req, res) {
    try {
      const result = await MrRequestLogService.searchMrRequestLogs(req.query);
      return res.status(200).json(result);
    } catch (error) {
      console.error("[MrRequestLogController] getAllMrRequestLog error:", error);
      return res.status(500).json({ message: error?.message || "Internal Server Error" });
    }
  }

  async getAllVendorReportsV2(req, res) {
    try {
      const filters = {
        vendorMasterId: req.query.vendorMasterId,
        stockInStartDate: req.query.stockInStartDate,
        stockInEndDate: req.query.stockInEndDate,
        stockOutStartDate: req.query.stockOutStartDate,
        stockOutEndDate: req.query.stockOutEndDate,
        vendor: req.query.vendor,
        vendorName: req.query.vendorName,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const result = await MrRequestLogService.getAllVendorReportsV2(filters);
      
      return res.status(200).json({
        result: result,
        message: "Vendor reports retrieved successfully (V2)"
      });
    } catch (error) {
      console.error("[MrRequestLogController] getAllVendorReportsV2 error:", error);
      return res.status(500).json({ 
        result: error.message,
        message: "Error retrieving vendor reports (V2)"
      });
    }
  }

  async getAllProductLogStatusPutaway(req, res) {
    try {
      const filters = {
        vendorMasterId: req.query.vendorMasterId,
        vendor: req.query.vendor,
        vendorName: req.query.vendorName,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const result = await MrRequestLogService.getAllProductLogStatusPutaway(filters);
      
      return res.status(200).json({
        result: result,
        message: "Product log status putaway retrieved successfully"
      });
    } catch (error) {
      console.error("[MrRequestLogController] getAllProductLogStatusPutaway error:", error);
      return res.status(500).json({ 
        result: error.message,
        message: "Error retrieving product log status putaway"
      });
    }
  }

  async calculateBilling(req, res) {
    try {
      const filters = {
        vendorName: req.query.vendorName,
        stockInDateFrom: req.query.stockInDateFrom,
        stockOutDateTo: req.query.stockOutDateTo,
        page: req.query.page,
        limit: req.query.limit
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const result = await MrRequestLogService.calculateBilling(filters);
      
      return res.status(200).json({
        result: result,
        message: "Billing calculated successfully"
      });
    } catch (error) {
      console.error("[MrRequestLogController] calculateBilling error:", error);
      return res.status(500).json({ 
        result: error.message,
        message: "Error calculating billing"
      });
    }
  }
}

module.exports = new MrRequestLogController();
