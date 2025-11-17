const MrRequestRepository = require("../repositories/mrRequest.repository");
const MrRequestLogRepository = require("../repositories/mrRequestLog.repository");
const VendorMasterRepository = require("../repositories/vendorMaster.repository");
const ProductDetailsRepository = require("../repositories/productDetails.repository");
const ProductLogRepository = require("../repositories/productLog.repository");
const LocationRepository = require("../repositories/location.repository");
const { Op } = require("sequelize");
class MrRequestLogService {
  async getAllMrRequestLog() {
    return MrRequestLogRepository.findAll();
  }
  async searchMrRequestLogs(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const {
      masterLot,
      partialInv,
      mrNo,
      dateFrom,
      dateTo,
    } = query;

    const where = {
      ...(mrNo && { mrNo: { [Op.like]: `%${mrNo}%` } }),
      ...(masterLot && { invoiceNo_MasterLot: { [Op.like]: `%${masterLot}%` } }),
      ...(partialInv && { invoiceNo_PartialInv: { [Op.like]: `%${partialInv}%` } }),
      ...((dateFrom || dateTo) && {
        stockOutDate: {
          ...(dateFrom && { [Op.gte]: dateFrom }),
          ...(dateTo && { [Op.lte]: dateTo }),
        },
      }),
    };

    const { rows, count } = await MrRequestLogRepository.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ["stockOutDate", "DESC"],
        ["mrRequestLogId", "DESC"],
      ],
      raw: true,
    });

    return {
      total: count,
      rows,
      page,
      limit,
    };
  }
  async getVendorMaster() {
    return VendorMasterRepository.getVendorMaster();
  }

  async getAllVendorReportsV2(filters = {}) {
    try {
      // Pagination parameters
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 50;
      const offset = (page - 1) * limit;

      // Build where clause for ProductDetails - start with ProductDetails as main loop
      let whereClause = {};

      // Add vendor filters if provided
      if (filters.vendorMasterId) {
        whereClause.vendorMasterId = filters.vendorMasterId;
      }

      // If vendorName provided, get matching vendor ids
      if (filters.vendorName) {
        const vendors = await VendorMasterRepository.findAll({
          where: { vendorMasterName: { [Op.like]: `%${filters.vendorName}%` } },
          attributes: ["vendorMasterId", "vendorMasterCode", "vendorMasterName"],
          raw: true
        });
        const vendorIds = vendors.map(v => v.vendorMasterId);
        if (!vendorIds.length) {
          return {
            data: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: page,
            limit: limit
          };
        }
        if (whereClause.vendorMasterId) {
          const enforced = Array.isArray(whereClause.vendorMasterId?.[Op.in]) ? whereClause.vendorMasterId[Op.in] : [whereClause.vendorMasterId];
          const intersection = vendorIds.filter(id => enforced.includes(id));
          if (!intersection.length) {
            return {
              data: [],
              totalCount: 0,
              totalPages: 0,
              currentPage: page,
              limit: limit
            };
          }
          whereClause.vendorMasterId = { [Op.in]: intersection };
        } else {
          whereClause.vendorMasterId = { [Op.in]: vendorIds };
        }
      }

      // Get total count for pagination
      const totalCount = await ProductDetailsRepository.countWithVendor(whereClause);

      // Get ProductDetails with pagination - ProductDetails is the main loop
      const productDetails = await ProductDetailsRepository.findAllWithVendor(
        whereClause,
        { order: [['mfgDate', 'DESC'], ['productDetailsId', 'DESC']], limit, offset }
      );

      if (productDetails.length === 0) {
        return {
          data: [],
          totalCount: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
          limit: limit
        };
      }

      const productDetailsIds = productDetails.map(pd => pd.productDetailsId);

      // Get ProductLog records with productStatusId = 1 (received/stock in) for stockInDate
      // Build where clause for ProductLog query including date filter
      let productLogWhere = {
        productDetailsId: { [Op.in]: productDetailsIds },
        productStatusId: 1
      };
      
      // If date filter provided, filter by createdAt (when status changed to 1)
      // Support both: stockInStartDate + stockInEndDate, or just stockInEndDate (from past to end date)
      if (filters.stockInEndDate) {
        if (filters.stockInStartDate) {
          // Both start and end date provided
          productLogWhere.createdAt = {
            [Op.between]: [
              new Date(`${filters.stockInStartDate}T00:00:00.000Z`),
              new Date(`${filters.stockInEndDate}T23:59:59.999Z`)
            ]
          };
        } else {
          // Only end date provided - filter from past to end date
          productLogWhere.createdAt = {
            [Op.lte]: new Date(`${filters.stockInEndDate}T23:59:59.999Z`)
          };
        }
      }
      
      const productLogs = productDetailsIds.length > 0 
        ? await ProductLogRepository.findAll({
            where: productLogWhere,
            attributes: ['productDetailsId', 'createdAt', 'updatedAt'],
            order: [['createdAt', 'ASC']], // Get earliest date when status changed to 1
            raw: true
          })
        : [];

      // Create a map of productDetailsId -> stockInDate (from log)
      // Get the earliest date when status was changed to 1
      const stockInDateMap = new Map();
      productLogs.forEach(log => {
        const productDetailsId = log.productDetailsId;
        // Use createdAt as stockInDate (when status was changed to 1)
        const stockInDate = log.createdAt ? new Date(log.createdAt).toISOString().split('T')[0] : null;
        if (stockInDate) {
          // Keep the earliest date (since logs are ordered by createdAt ASC)
          if (!stockInDateMap.has(productDetailsId)) {
            stockInDateMap.set(productDetailsId, stockInDate);
          }
        }
      });

      // Get ProductLog records with productStatusId = 3 (stock out) and mrRequestId
      const productLogsStockOut = productDetailsIds.length > 0
        ? await ProductLogRepository.findAll({
            where: {
              productDetailsId: { [Op.in]: productDetailsIds },
              productStatusId: 3,
              mrRequestId: { [Op.ne]: null } // Has mrRequestId
            },
            attributes: ['productDetailsId', 'mrRequestId'],
            raw: true
          })
        : [];

      // Get unique mrRequestIds from stock out logs
      const mrRequestIds = [...new Set(productLogsStockOut.map(log => log.mrRequestId).filter(id => id))];

      // Get MrRequest data for those mrRequestIds
      const mrRequests = mrRequestIds.length > 0
        ? await MrRequestRepository.findAll({
            where: { mrRequestId: { [Op.in]: mrRequestIds } },
            attributes: [
              'mrRequestId', 'masterInvoiceNo', 'caseNo', 'lotNo', 'spec', 'size',
              'requestDate', 'partialInvoice', 'exportEntryNo', 'poNo',
              'description', 'quantity', 'unit', 'netWeight', 'grossWeight', 'deliveryTo'
            ],
            raw: true
          })
        : [];

      // Create a map of mrRequestId -> quantity from MrRequest
      const mrRequestQuantityMap = new Map();
      mrRequests.forEach(mr => {
        if (mr.mrRequestId) {
          mrRequestQuantityMap.set(mr.mrRequestId, mr.quantity || 0);
        }
      });

      // Create a lookup map for MrRequest data by key
      const mrRequestMap = new Map();
      mrRequests.forEach(mr => {
        const key = `${mr.masterInvoiceNo}_${mr.caseNo}_${mr.lotNo}_${mr.spec}_${mr.size}`;
        mrRequestMap.set(key, mr);
      });

      // Calculate stockOutQty for each productDetailsId by summing quantities from mrRequestId
      const stockOutQtyMap = new Map();
      productLogsStockOut.forEach(log => {
        const productDetailsId = log.productDetailsId;
        const mrRequestId = log.mrRequestId;
        const quantity = mrRequestQuantityMap.get(mrRequestId) || 0;
        
        if (!stockOutQtyMap.has(productDetailsId)) {
          stockOutQtyMap.set(productDetailsId, 0);
        }
        stockOutQtyMap.set(productDetailsId, stockOutQtyMap.get(productDetailsId) + quantity);
      });

      // Filter productDetailsIds by those that have logs matching date filter
      // Apply filter if stockInEndDate is provided (with or without stockInStartDate)
      const filteredProductDetailsIds = productDetailsIds.length > 0 && filters.stockInEndDate
        ? new Set(productLogs.map(log => log.productDetailsId))
        : null;

      // Transform ProductDetails to VendorReport format - loop through ProductDetails
      const vendorReports = productDetails
        .filter(product => {
          // If date filter is applied, only include products that have matching logs
          if (filteredProductDetailsIds && !filteredProductDetailsIds.has(product.productDetailsId)) {
            return false;
          }
          return true;
        })
        .map(product => {
          // Lookup MrRequest by key
          const key = `${product.masterInvoiceNo}_${product.caseNo}_${product.lotNo}_${product.spec}_${product.size}`;
          const mrData = mrRequestMap.get(key);

          // Get stockInDate from log (productStatusId = 1), fallback to mfgDate
          const stockInDateFromLog = stockInDateMap.get(product.productDetailsId);
          const stockInDate = stockInDateFromLog || product.mfgDate;

          // Get stockOutQty from map (sum of quantities from mrRequestId)
          const stockOutquantity = stockOutQtyMap.get(product.productDetailsId) || 0;

          return {
            vendorReportId: product.productDetailsId,
            vendor: product.VendorMaster?.vendorMasterCode || '',
            vendorName: product.VendorMaster?.vendorMasterName || '',
            invoiceNo: product.masterInvoiceNo,
            caseNo: product.caseNo,
            boxNo: product.boxNo,
            poNo: product.poNo,
            lotNo: product.lotNo,
            heatNo: product.heatNo,
            description: product.itemName,
            spec: product.spec,
            size: product.size,
            currency: product.currency,
            unitPrice: product.unitPrice,
            amount: product.amount,
            quantity: product.quantity,
            stockOutquantity: stockOutquantity,
            productNetWeight: product.netWeight,
            grossWeight: product.grossWeight,
            // m3: product.m3,
            stockInDate: stockInDate,
            mrNetWeight: mrData?.netWeight || null,
            masterLotImportEntry: product.importEntryNo,
            stockOutDate: mrData?.requestDate || null,
            partialLotInvoiceNo: mrData?.partialInvoice || null,
            partialLotExportEntryNo: mrData?.exportEntryNo || null,
            deliveryTo: mrData?.deliveryTo || null,
            VendorMaster: product.VendorMaster
          };
        });

      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: vendorReports,
        totalCount: totalCount,
        totalPages: totalPages,
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Error getting vendor reports V2: ${error.message}`);
    }
  }

  async getAllProductLogStatusPutaway(filters = {}) {
    try {
      // Pagination parameters
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 50;
      const offset = (page - 1) * limit;

      // Build where clause for ProductDetails - start with ProductDetails as main loop
      let whereClause = {};

      // Add vendor filters if provided
      if (filters.vendorMasterId) {
        whereClause.vendorMasterId = filters.vendorMasterId;
      }

      // If vendorName provided, get matching vendor ids
      if (filters.vendorName) {
        const vendors = await VendorMasterRepository.findAll({
          where: { vendorMasterName: { [Op.like]: `%${filters.vendorName}%` } },
          attributes: ["vendorMasterId", "vendorMasterCode", "vendorMasterName"],
          raw: true
        });
        const vendorIds = vendors.map(v => v.vendorMasterId);
        if (!vendorIds.length) {
          return {
            data: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: page,
            limit: limit
          };
        }
        if (whereClause.vendorMasterId) {
          const enforced = Array.isArray(whereClause.vendorMasterId?.[Op.in]) ? whereClause.vendorMasterId[Op.in] : [whereClause.vendorMasterId];
          const intersection = vendorIds.filter(id => enforced.includes(id));
          if (!intersection.length) {
            return {
              data: [],
              totalCount: 0,
              totalPages: 0,
              currentPage: page,
              limit: limit
            };
          }
          whereClause.vendorMasterId = { [Op.in]: intersection };
        } else {
          whereClause.vendorMasterId = { [Op.in]: vendorIds };
        }
      }

      // First, get all ProductLog records with productStatusId = 2 to filter ProductDetails
      const allProductLogsWithStatus2 = await ProductLogRepository.findAll({
        where: {
          productStatusId: 2
        },
        attributes: ['productDetailsId'],
        raw: true
      });

      // Get unique productDetailsIds that have productStatusId = 2
      const productDetailsIdsWithStatus2 = [...new Set(allProductLogsWithStatus2.map(log => log.productDetailsId).filter(id => id))];

      if (productDetailsIdsWithStatus2.length === 0) {
        return {
          data: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
          limit: limit
        };
      }

      // Add filter for productDetailsIds that have productStatusId = 2
      whereClause.productDetailsId = { [Op.in]: productDetailsIdsWithStatus2 };

      // Get total count for pagination (only products with productStatusId = 2)
      const totalCount = await ProductDetailsRepository.countWithVendor(whereClause);

      // Get ProductDetails with pagination - only products with productStatusId = 2
      const productDetails = await ProductDetailsRepository.findAllWithVendor(
        whereClause,
        { order: [['mfgDate', 'DESC'], ['productDetailsId', 'DESC']], limit, offset }
      );

      if (productDetails.length === 0) {
        return {
          data: [],
          totalCount: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
          limit: limit
        };
      }

      const productDetailsIds = productDetails.map(pd => pd.productDetailsId);

      // Get ProductLog records with productStatusId = 2 (put away) for stockInDate and locationCode
      // Get all without date filter
      const productLogs = productDetailsIds.length > 0 
        ? await ProductLogRepository.findAll({
            where: {
              productDetailsId: { [Op.in]: productDetailsIds },
              productStatusId: 2
            },
            attributes: ['productDetailsId', 'createdAt', 'updatedAt', 'locationId'],
            order: [['createdAt', 'ASC']], // Get earliest date when status changed to 2
            raw: true
          })
        : [];

      // Get unique locationIds from productLogs
      const locationIds = [...new Set(productLogs.map(log => log.locationId).filter(id => id))];
      
      // Get Location data using LocationRepository
      const locations = locationIds.length > 0
        ? await LocationRepository.findAllByIds(locationIds, { raw: true })
        : [];
      
      // Create a map of locationId -> locationCode
      const locationIdToCodeMap = new Map();
      locations.forEach(loc => {
        if (loc.locationId && loc.locationCode) {
          locationIdToCodeMap.set(loc.locationId, loc.locationCode);
        }
      });

      // Create a map of productDetailsId -> stockInDate (from log)
      // Get the earliest date when status was changed to 2
      const stockInDateMap = new Map();
      const locationCodeMap = new Map();
      productLogs.forEach(log => {
        const productDetailsId = log.productDetailsId;
        // Use createdAt as stockInDate (when status was changed to 2)
        const stockInDate = log.createdAt ? new Date(log.createdAt).toISOString().split('T')[0] : null;
        if (stockInDate) {
          // Keep the earliest date (since logs are ordered by createdAt ASC)
          if (!stockInDateMap.has(productDetailsId)) {
            stockInDateMap.set(productDetailsId, stockInDate);
          }
        }
        // Get locationCode from Location map (if available)
        if (log.locationId && !locationCodeMap.has(productDetailsId)) {
          const locationCode = locationIdToCodeMap.get(log.locationId) || null;
          locationCodeMap.set(productDetailsId, locationCode);
        }
      });

      // Get ProductLog records with productStatusId = 3 (stock out) and mrRequestId
      const productLogsStockOut = productDetailsIds.length > 0
        ? await ProductLogRepository.findAll({
            where: {
              productDetailsId: { [Op.in]: productDetailsIds },
              productStatusId: 3,
              mrRequestId: { [Op.ne]: null } // Has mrRequestId
            },
            attributes: ['productDetailsId', 'mrRequestId'],
            raw: true
          })
        : [];

      // Get unique mrRequestIds from stock out logs
      const mrRequestIds = [...new Set(productLogsStockOut.map(log => log.mrRequestId).filter(id => id))];

      // Get MrRequest data for those mrRequestIds
      const mrRequests = mrRequestIds.length > 0
        ? await MrRequestRepository.findAll({
            where: { mrRequestId: { [Op.in]: mrRequestIds } },
            attributes: [
              'mrRequestId', 'masterInvoiceNo', 'caseNo', 'lotNo', 'spec', 'size',
              'requestDate', 'partialInvoice', 'exportEntryNo', 'poNo',
              'description', 'quantity', 'unit', 'netWeight', 'grossWeight', 'deliveryTo'
            ],
            raw: true
          })
        : [];

      // Create a map of mrRequestId -> quantity from MrRequest
      const mrRequestQuantityMap = new Map();
      mrRequests.forEach(mr => {
        if (mr.mrRequestId) {
          mrRequestQuantityMap.set(mr.mrRequestId, mr.quantity || 0);
        }
      });

      // Create a lookup map for MrRequest data by key
      const mrRequestMap = new Map();
      mrRequests.forEach(mr => {
        const key = `${mr.masterInvoiceNo}_${mr.caseNo}_${mr.lotNo}_${mr.spec}_${mr.size}`;
        mrRequestMap.set(key, mr);
      });

      // Calculate stockOutQty for each productDetailsId by summing quantities from mrRequestId
      const stockOutQtyMap = new Map();
      productLogsStockOut.forEach(log => {
        const productDetailsId = log.productDetailsId;
        const mrRequestId = log.mrRequestId;
        const quantity = mrRequestQuantityMap.get(mrRequestId) || 0;
        
        if (!stockOutQtyMap.has(productDetailsId)) {
          stockOutQtyMap.set(productDetailsId, 0);
        }
        stockOutQtyMap.set(productDetailsId, stockOutQtyMap.get(productDetailsId) + quantity);
      });

      // Transform ProductDetails to VendorReport format - loop through ProductDetails
      // All products already have productStatusId = 2 (filtered in query)
      const vendorReports = productDetails
        .map(product => {
          // Lookup MrRequest by key
          const key = `${product.masterInvoiceNo}_${product.caseNo}_${product.lotNo}_${product.spec}_${product.size}`;
          const mrData = mrRequestMap.get(key);

          // Get stockInDate from log (productStatusId = 2), fallback to mfgDate
          const stockInDateFromLog = stockInDateMap.get(product.productDetailsId);
          const stockInDate = stockInDateFromLog || product.mfgDate;

          // Get stockOutQty from map (sum of quantities from mrRequestId)
          const stockOutquantity = stockOutQtyMap.get(product.productDetailsId) || 0;

          // Get locationCode from map (from ProductLog with productStatusId = 2)
          const locationCode = locationCodeMap.get(product.productDetailsId) || null;

          return {
            vendorReportId: product.productDetailsId,
            vendor: product.VendorMaster?.vendorMasterCode || '',
            vendorName: product.VendorMaster?.vendorMasterName || '',
            invoiceNo: product.masterInvoiceNo,
            caseNo: product.caseNo,
            boxNo: product.boxNo,
            poNo: product.poNo,
            lotNo: product.lotNo,
            heatNo: product.heatNo,
            description: product.itemName,
            spec: product.spec,
            size: product.size,
            currency: product.currency,
            unitPrice: product.unitPrice,
            amount: product.amount,
            quantity: product.quantity,
            stockOutquantity: stockOutquantity,
            productNetWeight: product.netWeight,
            grossWeight: product.grossWeight,
            // m3: product.m3,
            stockInDate: stockInDate,
            locationCode: locationCode,
            mrNetWeight: mrData?.netWeight || null,
            masterLotImportEntry: product.importEntryNo,
            stockOutDate: mrData?.requestDate || null,
            partialLotInvoiceNo: mrData?.partialInvoice || null,
            partialLotExportEntryNo: mrData?.exportEntryNo || null,
            deliveryTo: mrData?.deliveryTo || null,
            VendorMaster: product.VendorMaster
          };
        });

      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: vendorReports,
        totalCount: totalCount,
        totalPages: totalPages,
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Error getting product log status putaway: ${error.message}`);
    }
  }

  async calculateBilling(filters = {}) {
    try {
      // Pagination parameters
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 50;
      const offset = (page - 1) * limit;

      // Get billing date range
      const stockInDateFrom = filters.stockInDateFrom;
      const stockOutDateTo = filters.stockOutDateTo;

      // Get vendor filter if provided
      let vendorIds = [];
      if (filters.vendorName) {
        const vendors = await VendorMasterRepository.findAll({
          where: { vendorMasterName: { [Op.like]: `%${filters.vendorName}%` } },
          attributes: ["vendorMasterId", "vendorMasterCode", "vendorMasterName"],
          raw: true
        });
        vendorIds = vendors.map(v => v.vendorMasterId);
        if (!vendorIds.length) {
          return {
            data: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: page,
            limit: limit
          };
        }
      }

      // Get ProductLog records via repository (statusId = 1) without heavy associations
      const allLogs = await ProductLogRepository.findAll({
        where: { productStatusId: 1 },
        order: [["mfgDate", "DESC"], ["productLogId", "DESC"]],
        raw: true,
      });

      // Filter by stockInDateFrom (mfgDate)
      const productLogs = (allLogs || []).filter((r) => {
        const mfg = r && r.mfgDate ? new Date(r.mfgDate) : null;
        if (stockInDateFrom && mfg) {
          const start = new Date(`${stockInDateFrom}T00:00:00`);
          if (mfg < start) return false;
        }
        return true;
      });

      // Join with ProductDetails and VendorMaster via repositories
      const detailIds = [...new Set(productLogs.map(l => l.productDetailsId).filter(Boolean))];
      const details = detailIds.length ? await ProductDetailsRepository.findAllByIds(detailIds, { raw: true }) : [];
      const detailsById = new Map(details.map(d => [d.productDetailsId, d]));

      const vendorIdsFromDetails = [...new Set(details.map(d => d.vendorMasterId).filter(Boolean))];
      const vendors = vendorIdsFromDetails.length ? await VendorMasterRepository.findAllByIds(vendorIdsFromDetails, { raw: true }) : [];
      const vendorById = new Map(vendors.map(v => [v.vendorMasterId, v]));

      // Get all MRRequests for matching
      const allMRRequests = await MrRequestRepository.findAll({ raw: true });
      const mrByKey = new Map();
      allMRRequests.forEach(mr => {
        const key = `${mr.masterInvoiceNo}_${mr.caseNo}_${mr.lotNo}_${mr.spec}_${mr.size}`;
        mrByKey.set(key, mr);
      });

      // Merge and optional vendorName filter
      let merged = productLogs.map(log => {
        const d = detailsById.get(log.productDetailsId) || {};
        const v = d.vendorMasterId ? vendorById.get(d.vendorMasterId) || {} : {};
        
        // Match MR Request by compound key
        const mrKey = `${d.masterInvoiceNo}_${d.caseNo}_${d.lotNo}_${d.spec}_${d.size}`;
        const matchedMR = mrByKey.get(mrKey);
        
        return {
          productLogId: log.productLogId,
          stockInDate: log.mfgDate,
          palletNo: log.palletNo,
          productDetailsId: log.productDetailsId,
          masterInvoiceNo: d.masterInvoiceNo,
          caseNo: d.caseNo,
          lotNo: d.lotNo,
          spec: d.spec,
          size: d.size,
          grossWeight: d.grossWeight,
          vendorMasterId: d.vendorMasterId,
          vendor: v.vendorMasterCode || '',
          vendorName: v.vendorMasterName || '',
          mrRequestId: matchedMR?.mrRequestId || null,
          stockOutDate: matchedMR?.requestDate || null,
          deliveryTo: matchedMR?.deliveryTo || null,
        };
      });

      if (filters.vendorName) {
        const needle = String(filters.vendorName).toLowerCase();
        merged = merged.filter(row => String(row.vendorName).toLowerCase().includes(needle));
      }

      const filteredLogs = merged;

      const total = filteredLogs.length;
      
      // Apply pagination
      const paginatedLogs = filteredLogs
        .sort((a,b) => new Date(b.stockInDate) - new Date(a.stockInDate) || (b.productLogId||0) - (a.productLogId||0))
        .slice(offset, offset + limit);
      
      // Format product balances data
      const productBalances = paginatedLogs;

      // Calculate billing for each product
      const billingData = productBalances
        .map(productBalance => {
          // Filter by stockOutDateTo - only show items that were stocked out on or before this date
          if (stockOutDateTo && productBalance.stockOutDate) {
            const filterEnd = new Date(stockOutDateTo + 'T23:59:59');
            const stockOut = new Date(productBalance.stockOutDate);
            if (stockOut > filterEnd) {
              return null;
            }
          }

          const grossWeightTon = productBalance.grossWeight ? productBalance.grossWeight / 1000 : 0;
          const stockInDate = productBalance.stockInDate;
          const stockOutDate = productBalance.stockOutDate;
          const outStockOutDate = stockOutDate || (stockOutDateTo ? stockOutDateTo : null);
          const deliveryTo = productBalance.deliveryTo;

          // Calculate storage days - up to stockOutDate if exists, otherwise up to stockOutDateTo
          let storageDays = 0;
          if (stockInDate) {
            const stockIn = new Date(stockInDate);
            const endDate = stockOutDate 
              ? new Date(stockOutDate) 
              : (stockOutDateTo ? new Date(stockOutDateTo + 'T23:59:59') : new Date());
            storageDays = Math.max(0, Math.ceil((endDate - stockIn) / (1000 * 60 * 60 * 24)));
          }

          // Calculate fees based on the document
          const storageFee = storageDays * 9 * grossWeightTon; // 9 THB per ton per day
          
          // Handling-In fee: always applies
          const handlingInFee = grossWeightTon * 18; // 18 THB per ton
          
          // Handling-Out fee: only if there's a stockOutDate
          const handlingOutFee = stockOutDate ? grossWeightTon * 18 : 0; // 18 THB per ton
          
          // Special handling fee for BPI factory
          let specialHandlingFee = 0;
          // Only calculate if deliveryTo is one of the BPI divisions
          if (stockOutDate && deliveryTo) {
            const bpiDivisions = ['NAT', 'NHT', 'NHB', 'PELMEC', 'NPB', 'BALL-BPI'];
            if (bpiDivisions.some(div => deliveryTo.includes(div))) {
              // Special handling fee: 310 THB per ton
              specialHandlingFee = grossWeightTon * 310;
            }
            // If deliveryTo is not in bpiDivisions, specialHandlingFee remains 0
          }

          return {
            vendor: productBalance.vendor || '',
            vendorName: productBalance.vendorName || '',
            masterLot: productBalance.masterInvoiceNo || '',
            grossWeightTon: grossWeightTon,
            deliveryTo: deliveryTo,
            stockInDate: stockInDate,
            stockOutDate: outStockOutDate,
            storageDays: storageDays,
            storageFee: Math.round(storageFee * 100) / 100,
            handlingInFee: Math.round(handlingInFee * 100) / 100,
            handlingOutFee: Math.round(handlingOutFee * 100) / 100,
            specialHandlingFee: Math.round(specialHandlingFee * 100) / 100
          };
        })
        .filter(item => item !== null); // Remove null entries

      const totalPages = Math.ceil(total / limit);

      return {
        data: billingData,
        totalCount: total,
        totalPages: totalPages,
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Error calculating billing: ${error.message}`);
    }
  }
}

module.exports = new MrRequestLogService();
