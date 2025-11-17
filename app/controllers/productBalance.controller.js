const productBalanceService = require("../services/productBalance.services");
const pickingService = require("../services/picking.services");

class ProductBalanceController {
  async getAllByPB(req, res) {
    try {
      const result = await productBalanceService.searchProductBalance();
      return res.status(200).json({
        status: "success",
        total: result.total,
        rows: result.rows,
      });
    } catch (error) {
      console.error("[ProductBalanceController.getAllByPB] error:", error);
      return res.status(500).json({ status: "error" });
    }
  }

  async getByPallet(req, res) {
    try {
      const palletParam = req.params?.palletNo;
      const palletNo = Number.parseInt(palletParam, 10);

      if (!Number.isFinite(palletNo)) {
        return res.status(400).json({
          status: "error",
          message: "palletNo (int) is required in path param",
        });
      }

      const row = await productBalanceService.getProductBalanceByPallet(palletNo);
      if (!row) {
        return res.status(404).json({
          status: "error",
          message: `Not found: palletNo=${palletNo}`,
        });
      }

      return res.status(200).json({ status: "success", row });
    } catch (error) {
      console.error("[ProductBalanceController.getByPallet] error:", error);
      return res.status(500).json({
        status: "error",
        message: error?.message || "Internal server error",
      });
    }
  }

  async getReceiveLocation(req, res) {
    try {
      const raw = req.params?.code ?? req.query?.code ?? req.body?.locationCode ?? "";
      const code = String(raw).trim();
      console.log("[ProductBalanceController.getReceiveLocation] code:", code);

      const locationId = await productBalanceService.getReceiveLocation(code);
      return res.status(200).json({ result: locationId });
    } catch (error) {
      console.error("[ProductBalanceController.getReceiveLocation] error:", error);
      return res
        .status(500)
        .json({ result: error?.message || "Internal server error" });
    }
  }

  async deleteByPalletNo(req, res) {
    try {
      const { palletNo } = req.params;
      const v = String(palletNo ?? "").trim();
      if (!v) {
        return res.status(400).json({ status: "error", message: "palletNo is required" });
      }

      // Check if any productBalance records have mrRequestId and check exportEntryNo
      const productBalances = await productBalanceService.getProductBalanceByPallet(v);      
      // Check if there are any rows with mrRequestId
      if (productBalances && productBalances.rows && productBalances.rows.length > 0) {
        const firstRow = productBalances.rows[0];
        if (firstRow.mrRequestId) {
          const mrRequest = await productBalanceService.getMrRequestById(firstRow.mrRequestId);
          if (mrRequest && mrRequest.exportEntryNo === '-') {
            return res.status(400).json({ 
              status: "error", 
              message: "Cannot picking: exportEntryNo is '-' for this pallet" 
            });
          }
        }
      }

      const { deletedCount } = await productBalanceService.deleteByPalletNo(v);

      return res.json({ status: "ok", deletedCount, palletNo: v });
    } catch (err) {
      console.error("[ProductBalanceController.deleteByPalletNo] error:", err);
      return res.status(500).json({
        status: "error",
        message: err?.message || "Internal server error",
      });
    }
  }

  async getAllByMrIdNotNull(req, res) {
    try {
      const rows = await productBalanceService.getAllByMrIdNotNull();
      return res.status(200).json({
        result: rows,
      });
    } catch (error) {
      console.error("[ProductBalanceController.getAllByMrIdNotNull] error:", error);
      return res.status(500).json({ result: error });
    }
  }

  async updatePbByMrId(req, res) {
    try {
      const rows = await productBalanceService.getAllByMrIdNotNull();
      return res.status(200).json({
        result: rows,
      });
    } catch (error) {
      console.error("[ProductBalanceController.updatePbByMrId] error:", error);
      return res.status(500).json({ result: error });
    }
  }

  async clearMrRequest(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid id" });
      }

      const result = await productBalanceService.clearMrRequestByProductBalanceId(id);

      const mrId =
        result?.mrRequestId != null
          ? result.mrRequestId
          : (Array.isArray(result?.mrRequestIds) && result.mrRequestIds[0] != null
            ? result.mrRequestIds[0]
            : null);

      if (mrId != null) {
        await pickingService.deleteMrById(mrId);
      }

      return res.json({
        status: "ok",
        ...result,
        deletedMrId: mrId ?? null,
      });
    } catch (err) {
      console.error("[ProductBalanceController.clearMrRequest] error:", err);
      return res.status(500).json({
        status: "error",
        message: err?.message || "Server error",
      });
    }
  }

  async moveLocationBulk(req, res) {
    try {
      const { locationId, items } = req.body || {};

      if (!locationId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          result: { message: "locationId and items (array) must be provided" },
        });
      }

      const invalid = items.find((it) => !it?.productBalanceId);
      if (invalid) {
        return res.status(400).json({
          result: { message: "Each item must include productBalanceId" },
        });
      }

      const result = await productBalanceService.moveLocationBulk(locationId, items);
      return res.status(200).json({ status: "success", result });
    } catch (err) {
      console.error("[ProductBalanceController.moveLocationBulk] error:", err);

      if (err && err.status === "error" && err.message) {
        return res.status(err.statusCode || 400).json({
          result: { message: err.message, ...(err.details ? { details: err.details } : {}) },
        });
      }

      return res.status(500).json({ result: { message: err?.message || "Internal server error" } });
    }
  }

  async getAllLocationByProductBance(req, res) {
    try {
      const rows = await productBalanceService.getAllByLocationIdNotNull();
      return res.status(200).json({
        result: rows,
      });
    } catch (error) {
      console.error("[ProductBalanceController.getAllLocationByProductBance] error:", error);
      return res.status(500).json({ result: error });
    }
  }

  async getMasterInvoiceNos(req, res) {
    try {
      const search = req.query?.q || "";
      const result = await productBalanceService.getDistinctMasterInvoiceNos(search);
      return res.status(200).json({ status: "success", rows: result });
    } catch (error) {
      console.error("[ProductBalanceController.getMasterInvoiceNos] error:", error);
      return res.status(500).json({ status: "error" });
    }
  }

  async getPartialInvoices(req, res) {
    try {
      const search = req.query?.q || "";
      const result = await productBalanceService.getDistinctPartialInvoices(search);
      return res.status(200).json({ status: "success", rows: result });
    } catch (error) {
      console.error("[ProductBalanceController.getPartialInvoices] error:", error);
      return res.status(500).json({ status: "error" });
    }
  }

  async updateImportEntryNoByMaster(req, res) {
    try {
      const { masterInvoiceNo, importEntryNo } = req.body || {};
      if (!masterInvoiceNo) {
        return res.status(400).json({ status: "error", message: "masterInvoiceNo is required" });
      }
      const result = await productBalanceService.updateImportEntryNoForMaster(masterInvoiceNo, importEntryNo ?? null);
      return res.status(200).json({ status: "success", result });
    } catch (error) {
      console.error("[ProductBalanceController.updateImportEntryNoByMaster] error:", error);
      return res.status(500).json({ status: "error" });
    }
  }

  async updateExportEntryNoByPartialInvoice(req, res) {
    try {
      const { partialInvoice, exportEntryNo } = req.body || {};
      if (!partialInvoice) {
        return res.status(400).json({ status: "error", message: "partialInvoice is required" });
      }
      const result = await productBalanceService.updateExportEntryNoForPartialInvoice(partialInvoice, exportEntryNo ?? null);
      return res.status(200).json({ status: "success", result });
    } catch (error) {
      console.error("[ProductBalanceController.updateExportEntryNoByPartialInvoice] error:", error);
      return res.status(500).json({ status: "error" });
    }
  }

  async getProductDetailsByStatus4(req, res) {
    try {
      const { page = 1, limit = 50, masterInvoiceNo, caseNo } = req.query;
      const result = await productBalanceService.getProductDetailsByStatus4({ 
        page, 
        limit, 
        masterInvoiceNo, 
        caseNo 
      });
      return res.status(200).json({
        status: "success",
        total: result.total,
        rows: result.rows,
        page: result.page,
        limit: result.limit,
      });
    } catch (error) {
      console.error("[ProductBalanceController.getProductDetailsByStatus4] error:", error);
      return res.status(500).json({ status: "error", message: error?.message || "Internal server error" });
    }
  }

  async deleteByProductDetailsId(req, res) {
    try {
      const productDetailsId = parseInt(req.params.productDetailsId, 10);
      
      if (!Number.isInteger(productDetailsId) || productDetailsId <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Invalid productDetailsId",
        });
      }

      const result = await productBalanceService.deleteByProductDetailsId(productDetailsId);
      
      return res.status(200).json({
        status: "success",
        message: result.message,
        deletedCounts: result.deletedCounts,
      });
    } catch (error) {
      console.error("[ProductBalanceController.deleteByProductDetailsId] error:", error);
      return res.status(500).json({
        status: "error",
        message: error?.message || "Internal server error",
      });
    }
  }
}

module.exports = new ProductBalanceController();
