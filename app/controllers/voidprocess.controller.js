const voidProcessService = require("../services/voidprocess.services");
const voidProcessValidator = require("../validators/voidprocess.validators");

class VoidProcessController {
  async getAllByMrisNull(req, res) {
    try {
      const v = voidProcessValidator.validateListQuery(req.query);
      const baseRows = await voidProcessService.getProductBalanceMrisNull(v.value);
      const finalRows = await voidProcessService.checkRowsInProductDetails(
        baseRows,
        { receiveDate: v.value.receiveDate, vendor: v.value.vendor || "" }
      );

      return res.status(200).json({
        status: "success",
        receiveDate: v.value.receiveDate || "",
        vendor: v.value.vendor || null,
        total: Array.isArray(finalRows) ? finalRows.length : 0,
        rows: Array.isArray(finalRows) ? finalRows : [],
      });
    } catch (error) {
      console.error("[VoidProcessController.list] error:", error);
      return res
        .status(500)
        .json({ status: "error", message: error?.message || "Server error" });
    }
  }
  async vendorOptions(req, res) {
    try {
      const vendors = await voidProcessService.getVendors();
      return res.status(200).json(vendors || []);
    } catch (error) {
      console.error("[VoidProcessController.vendorOptions] error:", error);
      return res
        .status(500)
        .json({ status: "error", message: error?.message || "Server error" });
    }
  }
}

module.exports = new VoidProcessController();
