const MrRequestRepository = require("../repositories/mrRequest.repository");
const ProductBalanceRepository = require("../repositories/productBalance.repository");
const ProductDetailsRepository = require("../repositories/productDetails.repository");
const VendorMasterRepository = require("../repositories/vendorMaster.repository");
const ProductStatusRepository = require("../repositories/productStatus.repository");

class VoidProcessService {
  async getProductBalanceMrisNull(_payload = {}, { transaction } = {}) {
    const rows = await ProductBalanceRepository.findAllbymrRequestIdisNull(
      {
        attributes: [
          "productBalanceId",
          "productDetailsId",
          "productStatusId",
          "palletNo",
          "mrRequestId",
        ],
        order: [["productBalanceId", "DESC"]],
      },
      { transaction }
    );

    const plainRows = Array.isArray(rows) ? rows.map(r => r.get?.({ plain: true }) ?? r) : [];
    const ids = [...new Set(plainRows.map(r => r.productStatusId).filter(Boolean))];
    let statusMap = {};
    if (ids.length > 0) {
      const statuses = await ProductStatusRepository.findAllByIds(ids, { raw: true });
      statusMap = statuses.reduce((acc, s) => {
        acc[s.productStatusId] = s.productStatusName;
        return acc;
      }, {});
    }

    return plainRows.map(r => ({
      ...r,
      productStatusName: statusMap[r.productStatusId] || null,
    }));
  }
  async checkRowsInProductDetails(rows = [], { receiveDate, vendor = "" } = {}, { transaction } = {}) {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const pdIds = [...new Set(rows.map(r => r.productDetailsId).filter(Boolean))];

    const pdList = pdIds.length
      ? await ProductDetailsRepository.findAllByIds(
        pdIds,
        {
          attributes: [
            "productDetailsId", "mfgDate", "masterInvoiceNo", "caseNo", "lotNo",
            "spec", "size", "quantity", "unit", "importEntryNo", "vendorMasterId", "boxNo",
          ],
          raw: true,
        },
        { transaction }
      )
      : [];

    const pdById = new Map(pdList.map(pd => [pd.productDetailsId, pd]));

    const vendorIds = [...new Set(pdList.map(pd => pd.vendorMasterId).filter(Boolean))];
    let vendorRows = [];
    if (vendorIds.length && typeof VendorMasterRepository.findAllByIds === "function") {
      vendorRows = await VendorMasterRepository.findAllByIds(
        vendorIds,
        { attributes: ["vendorMasterId", "vendorMasterCode", "vendorMasterName"], raw: true },
        { transaction }
      );
    } else {
      const all = (await VendorMasterRepository.getVendorMaster()) || [];
      vendorRows = all.filter(v => vendorIds.includes(v.vendorMasterId));
    }
    const vendorById = new Map(vendorRows.map(v => [v.vendorMasterId, v]));

    const normDate = (v) => {
      if (v == null || v === "") return null;
      const s = String(v);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
    };
    const like = (hay, needle) =>
      !needle ? true : (hay != null && String(hay).toLowerCase().includes(String(needle).toLowerCase()));

    let enriched = rows.map(pb => {
      const pd = pdById.get(pb.productDetailsId) || {};
      const vm = vendorById.get(pd.vendorMasterId) || {};
      return {
        productBalanceId: pb.productBalanceId ?? null,
        productDetailsId: pb.productDetailsId ?? null,
        productStatusId: pb.productStatusId ?? null,
        palletNo: pb.palletNo ?? null,
        mrRequestId: pb.mrRequestId ?? null,
        productStatusName: pb.productStatusName ?? null,
        receiveDate: normDate(pd.mfgDate),
        masterInvoiceNo: pd.masterInvoiceNo ?? null,
        caseNo: pd.caseNo ?? null,
        boxNo: pd.boxNo ?? null,
        lotNo: pd.lotNo ?? null,
        spec: pd.spec ?? null,
        size: pd.size ?? null,
        quantity: pd.quantity ?? null,
        unit: pd.unit ?? null,
        importEntryNo: pd.importEntryNo ?? null,

        vendor: vm.vendorMasterCode ?? null,
        vendorName: vm.vendorMasterName ?? null,
      };
    });

    if (receiveDate) {
      const dd = normDate(receiveDate);
      enriched = enriched.filter(r => r.receiveDate === dd);
    }
    if (vendor) {
      enriched = enriched.filter(r => like(r.vendor, vendor) || like(r.vendorName, vendor));
    }

    enriched.sort((a, b) => {
      const ad = a.receiveDate || "";
      const bd = b.receiveDate || "";
      if (ad > bd) return -1;
      if (ad < bd) return 1;
      return (a.productBalanceId || 0) - (b.productBalanceId || 0);
    });

    return enriched;
  }
  async getVendors() {
    return VendorMasterRepository.getVendorMaster();
  }
}

module.exports = new VoidProcessService();
