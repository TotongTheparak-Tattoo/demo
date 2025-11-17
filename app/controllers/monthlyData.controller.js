const MonthlyDataRepository = require("../repositories/monthlyData.repository");
const MonthlyDataLogRepository = require("../repositories/monthlyDataLog.repository");
const { Op } = require("sequelize");
const db = require("../models");

const getAllMonthlyData = async (req, res) => {
  try {
    const { page = 1, limit = 50, invoiceNo, itemNo, importerNameEN, dateFrom, dateTo } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const whereClause = {};
    
    if (invoiceNo) {
      whereClause.invoiceNo = { [Op.like]: `%${invoiceNo}%` };
    }
    
    if (itemNo) {
      whereClause.itemNo = { [Op.like]: `%${itemNo}%` };
    }
    
    if (importerNameEN) {
      whereClause.importerNameEN = { [Op.like]: `%${importerNameEN}%` };
    }
    
    // Date filtering - From Date and To Date (use arrivalDate)
    if (dateFrom || dateTo) {
      whereClause.arrivalDate = {};
      if (dateFrom) {
        whereClause.arrivalDate[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.arrivalDate[Op.lte] = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    // First get the monthly data
    const result = await MonthlyDataRepository.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['itemNo', 'ASC']]
    });

    // Then get received dates for each record
    const rowsWithReceivedDate = await Promise.all(
      result.rows.map(async (row) => {
        try {
          const receivedDateQuery = `
            SELECT TOP 1 pl.createdAt as receivedDate
            FROM ProductDetails pd
            INNER JOIN ProductLog pl ON pd.productDetailsId = pl.productDetailsId
            WHERE pd.importEntryNo = :ctrlDeclarationNo
            AND pl.productStatusId = 1
            ORDER BY pl.createdAt DESC
          `;
          
          const receivedDateResult = await db.sequelize.query(receivedDateQuery, {
            replacements: { ctrlDeclarationNo: row.ctrlDeclarationNo },
            type: db.Sequelize.QueryTypes.SELECT
          });
          
          const receivedDate = receivedDateResult.length > 0 ? receivedDateResult[0].receivedDate : null;
          return {
            ...row,
            receivedDate: receivedDate
          };
        } catch (error) {
          console.error(`[getAllMonthlyData] Error getting received date for ctrlDeclarationNo: ${row.ctrlDeclarationNo}`, error);
          return {
            ...row,
            receivedDate: null
          };
        }
      })
    );

    const resultWithReceivedDate = {
      rows: rowsWithReceivedDate,
      count: result.count
    };
    
    res.status(200).json({
      result: {
        rows: resultWithReceivedDate.rows,
        total: resultWithReceivedDate.count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Error fetching monthly data:", error);
    res.status(500).json({
      result: {
        message: "Internal server error"
      }
    });
  }
};

const updateMonthlyData = async (req, res) => {
  try {
    const { monthlyDataId, ...updateData } = req.body;
    
    if (!monthlyDataId) {
      return res.status(400).json({
        result: {
          message: "monthlyDataId is required"
        }
      });
    }

    // Get the original data before update
    const originalData = await MonthlyDataRepository.findByPk(monthlyDataId);
    if (!originalData) {
      return res.status(404).json({
        result: {
          message: "Monthly data not found"
        }
      });
    }

    // Update the data
    const updatedData = await MonthlyDataRepository.update(monthlyDataId, updateData);

    if (!updatedData) {
      return res.status(400).json({
        result: {
          message: "No data was updated"
        }
      });
    }

    // Log the update action
    const logData = {
      ...originalData,
      action: "UPDATE",
      createdAt: new Date(), // Set current timestamp for log
      updatedAt: new Date()   // Set current timestamp for log
    };
    
    await MonthlyDataLogRepository.create(logData);

    res.status(200).json({
      result: {
        message: "Monthly data updated successfully"
      }
    });
  } catch (error) {
    console.error("Error updating monthly data:", error);
    res.status(500).json({
      result: {
        message: "Internal server error"
      }
    });
  }
};

module.exports = {
  getAllMonthlyData,
  updateMonthlyData
};
