const VendorMasterService = require("../services/vendorMaster.service");

class VendorMasterController {
  async getAllVendorMaster(req, res) {
    try {
      let getAllVendorMaster = await VendorMasterService.getVendorMaster();
      return res.status(200).json({
        result: getAllVendorMaster,
      });
    } catch (error) {
      return res.status(500).json({ result: error });
    }
  }
  async getMaker(req, res) {
    try {
      let getAllMaker = await VendorMasterService.getMaker();
      return res.status(200).json({
        result: getAllMaker,
      });
    } catch (error) {
      return res.status(500).json({ result: error });
    }
  }
  // controllers/vendorMaster.controller.js
  async insertVendorMaster(req, res) {
    try {
      const { vendorMasterCode, vendorMasterName } = req.body || {};

      // ตรวจสอบค่าว่างให้เป็นรูปแบบเดียวกัน
      if (!vendorMasterCode || !vendorMasterName) {
        return res.status(400).json({
          result: { message: "vendorMasterCode, vendorMasterName are required" },
        });
      }

      const created = await VendorMasterService.insertVendorMaster({
        vendorMasterCode,
        vendorMasterName,
      });

      // ให้ success response มีโครงสร้างเหมือนกัน
      return res.status(201).json({ status: "success", result: created });
    } catch (err) {
      console.error("[VendorMasterController.insertVendorMaster] error:", err);

      // เคส Duplicate
      if (err?.code === "DUPLICATE_VENDOR_CODE") {
        return res.status(409).json({ result: { message: "Duplicate vendorMasterCode" } });
      }

      // รองรับรูปแบบ error ที่ service อาจโยนมาให้ (status/error details)
      if (err && err.status === "error" && err.message) {
        return res.status(err.statusCode || 400).json({
          result: { message: err.message, ...(err.details ? { details: err.details } : {}) },
        });
      }

      // Fallback
      return res.status(500).json({ result: { message: err?.message || "Internal server error" } });
    }
  }
}

module.exports = new VendorMasterController();
