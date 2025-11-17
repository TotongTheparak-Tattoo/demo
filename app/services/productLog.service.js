const { Op } = require("sequelize");
const ProductLogRepository     = require("../repositories/productLog.repository");
const VendorMaster             = require("../repositories/vendorMaster.repository");
const ProductStatus            = require("../repositories/productStatus.repository");
const ProductDetailsRepository = require("../repositories/productDetails.repository");
const LocationRepository       = require("../repositories/location.repository");

class ProductLogService {
  async getAllProductLog() {
    return ProductLogRepository.findAll();
  }
  async findVendorByVendorId() {
    return VendorMaster.getVendorMaster();
  }
  async getAllProductDetail() {
    return ProductDetailsRepository.findAll();
  }
  async searchProductLog(query = {}) {
    const page   = Math.max(1, Number(query.page) || 1);
    const limit  = Math.max(1, Number(query.limit) || 50);
    const offset = (page - 1) * limit;

    const where = {
      productStatusId: { [Op.ne]: 4 },
    };

    // updatedAt range filter
    if (query.updatedFrom || query.updatedTo) {
      where.createdAt = {
        ...(query.updatedFrom && { [Op.gte]: query.updatedFrom }),
        ...(query.updatedTo   && { [Op.lte]: query.updatedTo   }),
      };
    }

    // ----- Map statusName -> productStatusId (partial match) -----
    if (query.statusName) {
      const statuses = await ProductStatus.findAll({
        where: { productStatusName: { [Op.like]: `%${query.statusName}%` } },
        attributes: ["productStatusId"],
        raw: true,
      });
      const statusIds = statuses.map(s => s.productStatusId);
      if (statusIds.length === 0) {
        return { total: 0, page, limit, rows: [] };
      }
      where.productStatusId = where.productStatusId
        ? { [Op.and]: [where.productStatusId, { [Op.in]: statusIds }] }
        : { [Op.in]: statusIds };
    }

    // ----- Map masterInvoiceNo -> productDetailsId (partial match) -----
    if (query.masterInvoiceNo) {
      const pds = await ProductDetailsRepository.findAll({
        where: { masterInvoiceNo: { [Op.like]: `%${query.masterInvoiceNo}%` } },
        attributes: ["productDetailsId"],
        raw: true,
      });
      const pdIds = pds.map(d => d.productDetailsId);
      if (pdIds.length === 0) {
        return { total: 0, page, limit, rows: [] };
      }
      where.productDetailsId = { [Op.in]: pdIds };
    }

    // ---------- Fetch with pagination + total count ----------
    const { rows: logs, count: total } = await ProductLogRepository.findAndCountAll({
      where,
      attributes: [
        "productLogId",
        "productDetailsId",
        "productStatusId",
        "locationId",
        "palletNo",
        "mrRequestId",
        "createdAt",
        "updatedAt",
      ],
      order: [["updatedAt", "DESC"]],
      offset,
      limit,
      raw: true,
    });

    if (!total || logs.length === 0) {
      return { total: 0, page, limit, rows: [] };
    }

    // ---------- Prepare side data for current page ----------
    const pdIds     = [...new Set(logs.map(l => l.productDetailsId).filter(Boolean))];
    const statusIds = [...new Set(logs.map(l => l.productStatusId).filter(Boolean))];
    const locIds    = [...new Set(logs.map(l => l.locationId).filter(Boolean))];

    // ProductDetails (only for ids present in this page)
    const pdList = pdIds.length
      ? await ProductDetailsRepository.findAll({
          where: { productDetailsId: { [Op.in]: pdIds } },
          attributes: [
            "productDetailsId",
            "masterInvoiceNo",
            "boxNo",
            "caseNo",
            "itemName",
            "poNo",
            "lotNo",
            "spec",
            "size",
            "mfgDate",
            "unit",
            "quantity",
            "currency",
            "unitPrice",
            "amount",
            "netWeight",
            "grossWeight",
            "importEntryNo",
            "vendorMasterId",
            "remark",
          ],
          raw: true,
        })
      : [];
    const pdById = new Map(pdList.map(d => [d.productDetailsId, d]));

    // Status
    const statusById = new Map(
      statusIds.length
        ? (await ProductStatus.findAll({
            where: { productStatusId: { [Op.in]: statusIds } },
            attributes: ["productStatusId", "productStatusName"],
            raw: true,
          })).map(s => [s.productStatusId, s])
        : []
    );

    // Vendor
    const vendorIds = [...new Set(pdList.map(d => d.vendorMasterId).filter(Boolean))];
    const vendorById = new Map(
      vendorIds.length
        ? (await VendorMaster.findAll({
            where: { vendorMasterId: { [Op.in]: vendorIds } },
            attributes: ["vendorMasterId", "vendorMasterCode", "vendorMasterName"],
            raw: true,
          })).map(v => [v.vendorMasterId, v])
        : []
    );

    // Location
    const locById = new Map(
      locIds.length
        ? (await LocationRepository.findAll({
            where: { locationId: { [Op.in]: locIds } },
            attributes: ["locationId", "locationCode"],
            raw: true,
          })).map(loc => [loc.locationId, loc.locationCode])
        : []
    );

    // ---------- Compose result rows (current page only) ----------
    const resultRows = logs.map(l => {
      const pd = pdById.get(l.productDetailsId) || {};
      const st = statusById.get(l.productStatusId) || {};
      const v  = pd.vendorMasterId ? (vendorById.get(pd.vendorMasterId) || {}) : {};

      return {
        // ProductLog
        productLogId: l.productLogId,
        productDetailsId: l.productDetailsId,
        productStatusId: l.productStatusId,
        productStatusName: st.productStatusName ?? null,
        palletNo: l.palletNo ?? null,
        locationId: l.locationId ?? null,
        locationCode: l.locationId ? (locById.get(l.locationId) ?? null) : null,
        remark: pd.remark ?? null,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,

        // ProductDetails
        masterInvoiceNo: pd.masterInvoiceNo ?? null,
        boxNo: pd.boxNo ?? null,
        caseNo: pd.caseNo ?? null,
        itemName: pd.itemName ?? null,
        poNo: pd.poNo ?? null,
        lotNo: pd.lotNo ?? null,
        spec: pd.spec ?? null,
        size: pd.size ?? null,
        unit: pd.unit ?? null,
        quantity: pd.quantity ?? null,
        currency: pd.currency ?? null,
        unitPrice: pd.unitPrice ?? null,
        amount: pd.amount ?? null,
        netWeight: pd.netWeight ?? null,
        grossWeight: pd.grossWeight ?? null,
        importEntryNo: pd.importEntryNo ?? null,
        mfgDate: pd.mfgDate ?? null,

        // Vendor
        vendorMasterId: pd.vendorMasterId ?? null,
        vendorMasterCode: v.vendorMasterCode ?? null,
        vendorMasterName: v.vendorMasterName ?? null,

        // Raw object (optional, for compatibility with existing front-end)
        ProductDetails: Object.keys(pd).length ? pd : null,
      };
    });

    return { total, page, limit, rows: resultRows };
  }
}

module.exports = new ProductLogService();
