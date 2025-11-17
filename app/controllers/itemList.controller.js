const ItemListUploadValidator = require("../validators/itemList.validator");
const ItemListService = require("../services/itemList.service");
const { Op } = require("sequelize");

class ItemListController {
    async uploadItemList(req, res) {
        try {
            const { filename = "", headers = [], rows = [] } = req.body || {};
            const { normalizedRows } = ItemListUploadValidator.validateAndNormalize(headers, rows);
            const result = await ItemListService.ingestItemList({
                filename,
                rows: normalizedRows,
                userId: req.user?.userId,
            });

            return res.status(201).json({ result });
        } catch (err) {
            console.error("[ItemListController] uploadItemList error:", err);
            if (err?.original?.message) console.error("DB:", err.original.message);
            if (err?.status && err?.body) {
                return res.status(err.status).json(err.body);
            }
            if (err?.code === "LOOKUP_NOT_FOUND") {
                return res.status(422).json({
                    message: "Lookup id not found",
                    result: { message: err.message, details: err.details || [] },
                });
            }
            if (err?.name === "SequelizeUniqueConstraintError") {
                return res.status(409).json({
                    message: "Duplicate rows",
                    result: { message: "One or more rows duplicate existing data." },
                });
            }
            console.error("[ItemListController] uploadItemList error:", err);
            return res.status(500).json({ message: err?.message || "Internal error" });
        }
    }

    async getAllItemList(req, res) {
        try {
            const { page = 1, limit = 50, spec, size } = req.query;
            const result = await ItemListService.getAllItemList({ page, limit, spec, size });
            return res.status(200).json({ 
                status: "success",
                total: result.total,
                rows: result.rows,
                page: result.page,
                limit: result.limit,
            });
        } catch (error) {
            console.error("[ItemListController] getAllItemList error:", error);
            return res.status(500).json({ 
                status: "error",
                message: error?.message || "Internal server error" 
            });
        }
    }

    async getUnmatchedProductDetails(req, res) {
        try {
            const result = await ItemListService.getUnmatchedProductDetails();
            return res.status(200).json({ 
                status: "success",
                result 
            });
        } catch (error) {
            console.error("[ItemListController] getUnmatchedProductDetails error:", error);
            return res.status(500).json({ 
                status: "error",
                message: error?.message || "Internal server error" 
            });
        }
    }
}

module.exports = new ItemListController();
