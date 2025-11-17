const MonthlyValidator = require("../validators/monthly.validators");
const MovementValidator = require("../validators/transactionMovement.validators");
const MasterUploadService = require("../services/masterUpload.service");

class MasterUploadController {
  async uploadMonthly(req, res) {
    try {
      const { filename, headers = [], rows = [] } = req.body || {};

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ result: { message: "File has no data (rows is empty)." } });
      }

      const validation = MonthlyValidator.validateCsv({ headers, rows });
      if (!validation.ok) {
        return res.status(400).json({
          result: {
            message: `Missing required columns: ${validation.missingDisplay?.join(", ") || validation.missing.join(", ")}`,
            required: validation.required,
          },
        });
      }

      const normalized = validation.rows;
      if (validation.valueErrors && validation.valueErrors.length) {
        const cols = Array.from(new Set(validation.valueErrors.map(e => e.displayField || e.field)));
        return res.status(400).json({
          result: {
            message: `Some required fields are empty: ${cols.join(", ")}`,
            columns: cols,
            headerMap: validation.headerMap,
          },
        });
      }
      const step1 = await MasterUploadService.insertMonthly(normalized);
      const step2 = await MasterUploadService.logMonthly(normalized, { action: "INSERT" });

      return res.status(200).json({
        status: "success",
        filename,
        result: {
          totalParsedRows: normalized.length,
          totalInsertedRows: step1.inserted,
          loggedRows: step2.inserted,
        },
      });
    } catch (error) {
      console.error("[uploadMonthly] error:", error);
      return res.status(500).json({ result: { message: String(error?.message || error) } });
    }
  }

  async uploadTransactionMovement(req, res) {
    try {
      const { filename, headers = [], rows = [] } = req.body || {};

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ result: { message: "File has no data (rows is empty)." } });
      }

      const validation = MovementValidator.validateCsv({ headers, rows });
      if (!validation.ok) {
        return res.status(400).json({
          result: {
            message: `Missing required columns: ${validation.missingDisplay?.join(", ") || validation.missing.join(", ")}`,
            required: validation.required,
          },
        });
      }

      const normalized = validation.rows;
      if (validation.valueErrors && validation.valueErrors.length) {
        const cols = Array.from(new Set(validation.valueErrors.map(e => e.displayField || e.field)));
        return res.status(400).json({
          result: {
            message: `Some required fields are empty: ${cols.join(", ")}`,
            columns: cols,
            headerMap: validation.headerMap,
          },
        });
      }
      const step1 = await MasterUploadService.insertMovement(normalized);
      const step2 = await MasterUploadService.logMovement(normalized, { action: "INSERT" });

      return res.status(200).json({
        status: "success",
        filename,
        result: {
          totalParsedRows: normalized.length,
          totalInsertedRows: step1.inserted,
          loggedRows: step2.inserted,
        },
      });
    } catch (error) {
      console.error("[uploadTransactionMovement] error:", error);
      return res.status(500).json({ result: { message: String(error?.message || error) } });
    }
  }
}

module.exports = new MasterUploadController();


