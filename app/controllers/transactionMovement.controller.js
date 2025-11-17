const TransactionMovementRepository = require("../repositories/transactionMovement.repository");
const TransactionMovementLogRepository = require("../repositories/transactionMovementLog.repository");
const MonthlyDataRepository = require("../repositories/monthlyData.repository");
const db = require("../models");
const { Op } = require("sequelize");

const getAllTransactionMovement = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      invoiceNo, 
      itemNo, 
      exporterNameEN,
      dateFrom,
      dateTo
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build where clause for MonthlyData
    const whereClause = {};
    
    // Map TransactionMovement filters to MonthlyData fields
    if (invoiceNo) {
      // Search in ctrlDeclarationNo for invoiceNo pattern
      whereClause.ctrlDeclarationNo = { [Op.like]: `%${invoiceNo}%` };
    }
    
    if (itemNo) {
      whereClause.itemNo = { [Op.like]: `%${itemNo}%` };
    }
    
    if (exporterNameEN) {
      whereClause.importerNameEN = { [Op.like]: `%${exporterNameEN}%` };
    }

    // Date filtering - From Date and To Date (use arrivalDate from MonthlyData)
    if (dateFrom || dateTo) {
      whereClause.arrivalDate = {};
      if (dateFrom) {
        whereClause.arrivalDate[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.arrivalDate[Op.lte] = new Date(dateTo + 'T23:59:59.999Z');
      }
    }
    
    // Get MonthlyData as primary table
    const monthlyResult = await MonthlyDataRepository.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['itemNo', 'DESC']]
    });
    
    // Join with TransactionMovement for each MonthlyData record
    const enhancedRows = [];
    
    for (const monthlyRow of monthlyResult.rows) {
      const monthlyData = monthlyRow.get ? monthlyRow.get({ plain: true }) : monthlyRow;
      
      // Find matching TransactionMovement records
      const transactionResult = await TransactionMovementRepository.findAndCountAll({
        where: {
          declarationNo: monthlyData.ctrlDeclarationNo,
          declarationLineNumber: monthlyData.itemNo
        }
      });
      
      // Get receivedDate from ProductDetails and ProductLog
      let receivedDate = null;
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
          replacements: { ctrlDeclarationNo: monthlyData.ctrlDeclarationNo },
          type: db.Sequelize.QueryTypes.SELECT
        });
        
        receivedDate = receivedDateResult.length > 0 ? receivedDateResult[0].receivedDate : null;
      } catch (error) {
        console.error('Error getting received date for row:', error);
        receivedDate = null;
      }
      
      // Use MonthlyData as base and add TransactionMovement metadata
      enhancedRows.push({
        // MonthlyData fields (primary data)
        monthlyDataId: monthlyData.monthlyDataId,
        importerNameEN: monthlyData.importerNameEN,
        arrivalDate: monthlyData.arrivalDate,
        description: monthlyData.description,
        quantity: monthlyData.quantity,
        netWeight: monthlyData.netWeight,
        amount: monthlyData.amount,
        currency: monthlyData.currency,
        cifTHB: monthlyData.cifTHB,
        tariff: monthlyData.tariff,
        dutyRate: monthlyData.dutyRate,
        dutyAmt: monthlyData.dutyAmt,
        remarks: monthlyData.remarks,
        consignmentCountry: monthlyData.consignmentCountry,
        itemNo: monthlyData.itemNo,
        // Use ctrlDeclarationNo only from TransactionMovement; empty if not found
        ctrlDeclarationNo: transactionResult.rows.length > 0 ? transactionResult.rows[0].ctrlDeclarationNo : "",
        monthlyUnit: monthlyData.unit,
        receivedDate: receivedDate,
        // TransactionMovement fields (if found)
        transactionMovementId: transactionResult.rows.length > 0 ? transactionResult.rows[0].transactionMovementId : null,
        invoiceNo: transactionResult.rows.length > 0 ? transactionResult.rows[0].invoiceNo : null,
        transactionitemNo: transactionResult.rows.length > 0 ? transactionResult.rows[0].itemNo : null,
        declarationNo: transactionResult.rows.length > 0 ? transactionResult.rows[0].declarationNo : monthlyData.ctrlDeclarationNo,
        declarationLineNumber: transactionResult.rows.length > 0 ? transactionResult.rows[0].declarationLineNumber : monthlyData.itemNo,
        exporterNameEN: transactionResult.rows.length > 0 ? transactionResult.rows[0].exporterNameEN : monthlyData.importerNameEN,
        transactionQuantity: transactionResult.rows.length > 0 ? transactionResult.rows[0].quantity : null,
        transactionUnit: transactionResult.rows.length > 0 ? transactionResult.rows[0].unit : null,
        transactionNetWeight: transactionResult.rows.length > 0 ? transactionResult.rows[0].netWeight : null,
        transactionNetWeightUnit: transactionResult.rows.length > 0 ? transactionResult.rows[0].netWeightUnit : null,
        transactionGrossWeight: transactionResult.rows.length > 0 ? transactionResult.rows[0].grossWeight : null,
        transactionGrossWeightUnit: transactionResult.rows.length > 0 ? transactionResult.rows[0].grossWeightUnit : null,
        createdAt: transactionResult.rows.length > 0 ? transactionResult.rows[0].createdAt : monthlyData.createdAt,
        
        unit: monthlyData.unit || 'KGM',
        netWeightUnit: 'KG',
        grossWeight: monthlyData.netWeight,
        grossWeightUnit: 'KG',
        outQty: 0,
        balanceQty: monthlyData.quantity,
        cost: monthlyData.cifTHB,
        totalCost: monthlyData.cifTHB,
        price: monthlyData.cifTHB,
        totalPrice: monthlyData.cifTHB,
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        rows: enhancedRows,
        count: monthlyResult.count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Error fetching transaction movement data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

const getBalanceReport = async (req, res) => {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      invoiceNo, 
      itemNo, 
      exporterNameEN,
      dateFrom,
      dateTo
    } = req.query;
    
    const offset = (page - 1) * pageSize;
    
    // Build where clause for MonthlyData - only show items with balance > 0
    const whereClause = {
      quantity: { [Op.gt]: 0 } // Only items with quantity > 0
    };
    
    // Map TransactionMovement filters to MonthlyData fields
    if (invoiceNo) {
      whereClause.ctrlDeclarationNo = { [Op.like]: `%${invoiceNo}%` };
    }
    
    if (itemNo) {
      whereClause.itemNo = { [Op.like]: `%${itemNo}%` };
    }
    
    if (exporterNameEN) {
      whereClause.importerNameEN = { [Op.like]: `%${exporterNameEN}%` };
    }

    // Date filtering - arrivalDate (support dateFrom and dateTo)
    if (dateFrom || dateTo) {
      whereClause.arrivalDate = {};
      if (dateFrom) whereClause.arrivalDate[Op.gte] = new Date(dateFrom);
      if (dateTo) whereClause.arrivalDate[Op.lte] = new Date(dateTo + 'T23:59:59.999Z');
    }
    
    // Get MonthlyData as primary table
    const monthlyResult = await MonthlyDataRepository.findAndCountAll({
      where: whereClause,
      limit: parseInt(pageSize),
      offset: parseInt(offset),
      order: [['itemNo', 'DESC']]
    });
    
    // Join with TransactionMovement for each MonthlyData record
    const enhancedRows = [];
    
    for (const monthlyRow of monthlyResult.rows) {
      const monthlyData = monthlyRow.get ? monthlyRow.get({ plain: true }) : monthlyRow;
      
      // Find matching TransactionMovement records
      const transactionResult = await TransactionMovementRepository.findAndCountAll({
        where: {
          declarationNo: monthlyData.ctrlDeclarationNo,
          declarationLineNumber: monthlyData.itemNo
        }
      });
      
      // Get receivedDate from ProductDetails and ProductLog
      let receivedDate = null;
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
          replacements: { ctrlDeclarationNo: monthlyData.ctrlDeclarationNo },
          type: db.Sequelize.QueryTypes.SELECT
        });
        
        receivedDate = receivedDateResult.length > 0 ? receivedDateResult[0].receivedDate : null;
      } catch (error) {
        console.error('Error getting received date for balance report row:', error);
        receivedDate = null;
      }
      
      // Use MonthlyData as base and add TransactionMovement metadata
      enhancedRows.push({
        // MonthlyData fields (primary data)
        monthlyDataId: monthlyData.monthlyDataId,
        importerNameEN: monthlyData.importerNameEN,
        arrivalDate: monthlyData.arrivalDate,
        stockInDate: monthlyData.stockInDate,
        description: monthlyData.description,
        quantity: monthlyData.quantity,
        netWeight: monthlyData.netWeight,
        amount: monthlyData.amount,
        currency: monthlyData.currency,
        cifTHB: monthlyData.cifTHB,
        tariff: monthlyData.tariff,
        dutyRate: monthlyData.dutyRate,
        dutyAmt: monthlyData.dutyAmt,
        remarks: monthlyData.remarks,
        consignmentCountry: monthlyData.consignmentCountry,
        itemNo: monthlyData.itemNo,
        ctrlDeclarationNo: monthlyData.ctrlDeclarationNo,
        unit: monthlyData.unit,
        monthlyUnit: monthlyData.unit,
        receivedDate: receivedDate,
        // TransactionMovement fields (if found)
        transactionMovementId: transactionResult.rows.length > 0 ? transactionResult.rows[0].transactionMovementId : null,
        invoiceNo: transactionResult.rows.length > 0 ? transactionResult.rows[0].invoiceNo : null,
        transactionitemNo: transactionResult.rows.length > 0 ? transactionResult.rows[0].itemNo : null,
        declarationNo: transactionResult.rows.length > 0 ? transactionResult.rows[0].declarationNo : monthlyData.ctrlDeclarationNo,
        declarationLineNumber: transactionResult.rows.length > 0 ? transactionResult.rows[0].declarationLineNumber : monthlyData.itemNo,
        exporterNameEN: transactionResult.rows.length > 0 ? transactionResult.rows[0].exporterNameEN : monthlyData.importerNameEN,
        transactionQuantity: transactionResult.rows.length > 0 ? transactionResult.rows[0].quantity : null,
        transactionUnit: transactionResult.rows.length > 0 ? transactionResult.rows[0].unit : null,
        transactionNetWeight: transactionResult.rows.length > 0 ? transactionResult.rows[0].netWeight : null,
        transactionNetWeightUnit: transactionResult.rows.length > 0 ? transactionResult.rows[0].netWeightUnit : null,
        transactionGrossWeight: transactionResult.rows.length > 0 ? transactionResult.rows[0].grossWeight : null,
        transactionGrossWeightUnit: transactionResult.rows.length > 0 ? transactionResult.rows[0].grossWeightUnit : null,
        createdAt: transactionResult.rows.length > 0 ? transactionResult.rows[0].createdAt : monthlyData.createdAt
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        rows: enhancedRows,
        count: monthlyResult.count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error("Error fetching balance report data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

const updateTransactionMovement = async (req, res) => {
  try {
    const { transactionMovementId, ...updateData } = req.body;
    
    if (!transactionMovementId) {
      return res.status(400).json({
        result: {
          message: "transactionMovementId is required"
        }
      });
    }

    // Get the original data before update
    const originalData = await TransactionMovementRepository.findByPk(transactionMovementId);
    if (!originalData) {
      return res.status(404).json({
        result: {
          message: "Transaction movement data not found"
        }
      });
    }

    // Update the data
    const updatedData = await TransactionMovementRepository.update(transactionMovementId, updateData);

    if (!updatedData) {
      return res.status(400).json({
        result: {
          message: "No data was updated"
        }
      });
    }

    // Log the update action
    const logData = {
      invoiceNo: originalData.invoiceNo,
      itemNo: originalData.itemNo,
      exporterNameEN: originalData.exporterNameEN,
      description: originalData.description,
      declarationNo: originalData.declarationNo,
      declarationLineNumber: originalData.declarationLineNumber,
      ctrlDeclarationNo: originalData.ctrlDeclarationNo,
      quantity: originalData.quantity,
      unit: originalData.unit,
      netWeight: originalData.netWeight,
      netWeightUnit: originalData.netWeightUnit,
      grossWeight: originalData.grossWeight,
      grossWeightUnit: originalData.grossWeightUnit,
      action: "UPDATE"
    };
    
    console.log("Logging TransactionMovement update:", logData);
    
    try {
      const logResult = await TransactionMovementLogRepository.create(logData);
      console.log("Log created successfully:", logResult);
    } catch (logError) {
      console.error("Error creating log:", logError);
      // Don't fail the update if logging fails
    }

    res.status(200).json({
      result: {
        message: "Transaction movement data updated successfully"
      }
    });
  } catch (error) {
    console.error("Error updating transaction movement data:", error);
    res.status(500).json({
      result: {
        message: "Internal server error"
      }
    });
  }
};

const getTransactionMovementOnly = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      invoiceNo, 
      itemNo, 
      exporterNameEN,
      dateFrom,
      dateTo
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build where clause for TransactionMovement only
    const whereClause = {};
    
    if (invoiceNo) {
      whereClause.invoiceNo = { [Op.like]: `%${invoiceNo}%` };
    }
    
    if (itemNo) {
      whereClause.itemNo = { [Op.like]: `%${itemNo}%` };
    }
    
    if (exporterNameEN) {
      whereClause.exporterNameEN = { [Op.like]: `%${exporterNameEN}%` };
    }

    // Date filtering - From Date and To Date (use createdAt from TransactionMovement)
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        whereClause.createdAt[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.createdAt[Op.lte] = new Date(dateTo + 'T23:59:59.999Z');
      }
    }
    
    // Get TransactionMovement data only
    const result = await TransactionMovementRepository.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['itemNo', 'DESC']]
    });
    
    res.status(200).json({
      success: true,
      data: {
        rows: result.rows,
        count: result.count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error("Error getting transaction movement data only:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  getAllTransactionMovement,
  getTransactionMovementOnly,
  getBalanceReport,
  updateTransactionMovement
};
