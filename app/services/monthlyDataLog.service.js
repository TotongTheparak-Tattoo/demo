const MonthlyDataLogRepo = require("../repositories/monthlyDataLog.repository");
const { Op } = require("sequelize");

class MonthlyDataLogService {
  async searchMonthlyDataLog(query) {
    try {
      const { page, limit, invoiceNo, ctrlDeclarationNo, currency, action, createdAtFrom, createdAtTo } = query;
      
      const offset = (page - 1) * limit;

      const where = {};
      
      // Optional filters
      if (invoiceNo) where.invoiceNo = invoiceNo;
      if (ctrlDeclarationNo) where.ctrlDeclarationNo = ctrlDeclarationNo;
      if (currency) where.currency = currency;
      if (action) where.action = action;
      
      // Date filters
      if (createdAtFrom) {
        where.createdAt = where.createdAt || {};
        where.createdAt[Op.gte] = createdAtFrom;
      }
      if (createdAtTo) {
        where.createdAt = where.createdAt || {};
        where.createdAt[Op.lte] = createdAtTo;
      }

      const { rows, count } = await MonthlyDataLogRepo.findAndCount(where, { 
        limit, 
        offset,
        order: [["monthlyDataLogId", "DESC"]]
      });

      return {
        rows,
        total: count,
        page,
        limit
      };
    } catch (error) {
      console.error("[MonthlyDataLogService] searchMonthlyDataLog error:", error);
      throw error;
    }
  }
}

module.exports = new MonthlyDataLogService();
