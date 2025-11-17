const voidScanService = require("../services/voidscan.services");

class VoidScanController {
  async deleteByPalletNo(req, res) {
    try {
      const { palletNo } = req.params;
      const v = String(palletNo ?? "").trim();
      if (!v) {
        return res.status(400).json({ status: "error", message: "palletNo is required" });
      }

      const { deletedCount } = await voidScanService.deleteByPalletNo(v);

      return res.json({ status: "ok", deletedCount, palletNo: v });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        status: "error",
        message: err?.message || "Internal server error",
      });
    }
  }
}

module.exports = new VoidScanController();
