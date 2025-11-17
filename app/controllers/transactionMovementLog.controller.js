const TransactionMovementLogRepository = require("../repositories/transactionMovementLog.repository");
const { Op } = require("sequelize");

const getAllTransactionMovementLog = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, dateFrom, dateTo } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const whereClause = {};
    
    if (action) {
      whereClause.action = action;
    }
    
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        whereClause.createdAt[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        // Add one day to include the entire day
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        whereClause.createdAt[Op.lt] = endDate;
      }
    }
    
    const result = await TransactionMovementLogRepository.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({
      result: {
        rows: result.rows,
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Error fetching transaction movement log:", error);
    res.status(500).json({
      result: {
        message: "Internal server error"
      }
    });
  }
};

module.exports = {
  getAllTransactionMovementLog
};
