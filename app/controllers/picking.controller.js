// controllers/picking.controller.js
const pickingService = require("../services/picking.services");
const PickingValidator = require("../validators/picking.validators");

class PickingController {
  async uploadtoMrRequest(req, res) {
    try {
      const { filename, headers = [], rows = [] } = req.body || {};

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
          result: { message: "File has no data (rows is empty)." },
        });
      }

      const validation = PickingValidator.validateCsvForMrUpload(
        { headers, rows },
        { overwriteMrNo: false }
      );

      if (!validation.ok) {
        return res.status(400).json({
          result: {
            message: `Missing required columns: ${validation.missing.join(", ")}`,
            required: validation.required,
            details: validation.missing.map((m) => ({ field: m, message: "required" })),
          },
        });
      }

      const warnings = (validation.mrNoErrors || []).map((e) => ({
        index: e.index,
        message: e.reason,
      }));

      const items  = await pickingService.buildformCsvAndfindVendorId(validation.rowsWithMr);
      const step1  = await pickingService.insertMrRequestsUnique(items);
      const pbRows = await pickingService.step1FindPbToUpdate({ onlyNull: true });

      let updatedIds = [];
      if (pbRows?.length) {
        const groups   = await pickingService.step2BuildGroupsFromPd(pbRows);
        if (groups.size) {
          const latestBy = await pickingService.step3FindLatestMrMapByGroups(groups);
          updatedIds     = await pickingService.step4UpdatePbByLatest(groups, latestBy);
        }
      }

      const step3 = await pickingService.buildformMrRequestLog(updatedIds);
      const step4 = await pickingService.insertMrRequestLog(step3);

      const result = {
        totalParsedRows: items.length,
        totalInsertedRows: step1.inserted,
        totalSkippedRowsBecauseOfDuplicate: step1.skipped,
        updatedProductBalanceRowCount: updatedIds.length,
        loggedRows: step4.inserted,
      };

      return res.status(200).json({
        status: "success",
        filename,
        result,
        warnings,
      });

    } catch (error) {
      console.error("[uploadtoMrRequest] error:", error);
      return res.status(500).json({ result: error });
    }
  }
}

module.exports = new PickingController();
