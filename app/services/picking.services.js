const MrRequestRepository = require("../repositories/mrRequest.repository");
const ProductBalanceRepository = require("../repositories/productBalance.repository");
const ProductDetailsRepository = require("../repositories/productDetails.repository");
const MRRequestLogRepository = require("../repositories/mrRequestLog.repository");
const VendorMasterRepository = require("../repositories/vendorMaster.repository");
const { toDateOnlyString } = require("../validators/picking.validators");

const norm = (v) => (v === null || v === undefined ? "" : String(v).trim());
const key5 = (o) => [norm(o.masterInvoiceNo), norm(o.caseNo), norm(o.spec), norm(o.size), norm(o.lotNo)].join("|");

class PickingService {
  async buildformCsvAndfindVendorId(canonicalRows) {
    const mapped = canonicalRows.map((row, index) => {
      const convertedDate = toDateOnlyString(row.RequestDate);
      
      if (!convertedDate) {
        throw new Error(`Invalid or missing RequestDate at row ${index + 1}: ${row.RequestDate}`);
      }

      const out = {
        registerAt: new Date(), //timestamp

        //MrRequest fields
        mrNo: row.Mr_no ?? null,
        requestDate: convertedDate,
        deliveryTo: row.Deliveryto ? String(row.Deliveryto).toUpperCase().trim() : null,
        partialInvoice: row.partialInvoice ?? null,
        masterInvoiceNo: row.MasterInvoiceNo ?? null,
        caseNo: row.CaseNo ?? null,
        poNo: row.PoNo ?? null,
        lotNo: row.Lot_No ?? null,
        description: row.Description ?? null,
        spec: row.Spec ?? null,
        size: row.Sizemm ?? null,

        // Numbers may come as "1,000" → strip commas then convert
        quantity:
          row.Qty != null ? Number(String(row.Qty).replace(/,/g, "")) : null,
        unit: row.Unit ?? null,
        netWeight:
          row.NetWeight != null ? Number(String(row.NetWeight).replace(/,/g, "")) : null,
        grossWeight:
          row.GrossWeight != null ? Number(String(row.GrossWeight).replace(/,/g, "")) : null,
        exportEntryNo: row.ExportEntryNo ?? null,
        remarks: row.Remarks ?? null,
        vendorCode: row.vendorMasterId ?? null,
      };
      return out;
    });

    // 2) Resolve vendor token → vendorMasterId using the repository (row-by-row)
    const unknownCodes = new Set();

    await Promise.all(
      mapped.map(async (r) => {
        const rawCode = r.vendorCode;
        if (rawCode) {
          //Find VendorId By VendorCode
          const id = await VendorMasterRepository.findVendorIdByVendorCode(rawCode);
          if (id != null) {
            r.vendorMasterId = id;
          } else {
            // not found in VendorMaster
            unknownCodes.add(String(rawCode));
          }
        } else {
          // vendor token missing entirely
          unknownCodes.add("(empty)");
        }
        // Clean up temporary fields
        delete r.vendorCode;
      })
    );
    if (unknownCodes.size > 0) {
      throw new Error(`Vendor code not found in VendorMaster: ${[...unknownCodes].join(", ")}`);
    }
    return mapped;
  }
  async insertMrRequestsUnique(items, { transaction } = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      return { inserted: 0, skipped: 0, created: [], keysUsed: [] };
    }

    // uniq ใน batch
    const seen = new Set();
    const batchUnique = [];
    for (const it of items) {
      const k = key5(it); // "masterInvoiceNo|caseNo|spec|size|lotNo"
      if (seen.has(k)) continue;
      seen.add(k);
      batchUnique.push(it);
    }

    // สร้าง combos สำหรับค้นหาในฐานข้อมูล
    const combos = Array.from(seen).map((s) => {
      const [masterInvoiceNo, caseNo, spec, size, lotNo] = s.split("|");
      return {
        masterInvoiceNo: masterInvoiceNo || null,
        caseNo: caseNo || null,
        spec: spec || null,
        size: size || null,
        lotNo: lotNo || null,
      };
    });

    // ✅ ให้ repo เป็นคนประกอบ Op.or
    let existingKeys = new Set();
    if (combos.length) {
      const existing = await MrRequestRepository.findAllByFiveKeys(combos, {
        attributes: ["masterInvoiceNo", "caseNo", "spec", "size", "lotNo"],
        raw: true,
        transaction,
      });
      existingKeys = new Set(existing.map(key5));
    }

    const toInsert = batchUnique.filter((it) => !existingKeys.has(key5(it)));
    const skipped = items.length - toInsert.length;

    let created = [];
    if (toInsert.length) {
      if (typeof MrRequestRepository.bulkCreate === "function") {
        created = await MrRequestRepository.bulkCreate(toInsert, { transaction });
      } else {
        for (const it of toInsert) {
          const row = await MrRequestRepository.create(it, { transaction });
          created.push(row);
        }
      }
    }

    return {
      inserted: created.length,
      skipped,
      created,
      keysUsed: toInsert.map(key5),
    };
  }
  async step1FindPbToUpdate({ onlyNull = true } = {}, { transaction } = {}) {
    // ต้องมีเมธอดนี้ใน ProductBalanceRepository (ตามที่เคยแนบ)
    return ProductBalanceRepository.findToUpdate({ onlyNull }, { transaction });
  }
  async step2BuildGroupsFromPd(pbRows = [], { transaction } = {}) {
    const pdIds = [...new Set(pbRows.map(r => r.productDetailsId).filter(Boolean))];
    if (!pdIds.length) return new Map();

    // ต้องมีเมธอดนี้ใน ProductDetailsRepository (ตามที่เคยแนบ)
    const pdRows = await ProductDetailsRepository.findMinimalByIds(pdIds, { transaction });

    const pdById = new Map();
    for (const pd of pdRows) pdById.set(pd.productDetailsId, pd);

    const groups = new Map();
    const up = (v) => String(v ?? "").trim().toUpperCase();

    for (const pb of pbRows) {
      const pd = pdById.get(pb.productDetailsId);
      if (!pd) continue;

      const pdKeyObj = {
        masterInvoiceNo: pd.masterInvoiceNo,
        caseNo:          pd.caseNo,
        spec:            pd.spec,
        size:            pd.size,
        lotNo:           pd.lotNo,
      };

      // key5 แบบ normalize
      const key = [up(pdKeyObj.masterInvoiceNo), up(pdKeyObj.caseNo), up(pdKeyObj.spec), up(pdKeyObj.size), up(pdKeyObj.lotNo)].join("||");

      if (!groups.has(key)) groups.set(key, { pdKeyObj, items: [] });
      groups.get(key).items.push({
        productBalanceId: pb.productBalanceId,
        productDetailsId: pb.productDetailsId,
      });
    }

    return groups;
  }
  async step3FindLatestMrMapByGroups(groups, { transaction } = {}) {
    if (!groups || !groups.size) return new Map();

    // เตรียม OR เงื่อนไขจากแต่ละกลุ่ม
    const orConds = [];
    for (const { pdKeyObj } of groups.values()) {
      orConds.push(pdKeyObj); // { masterInvoiceNo, caseNo, spec, size, lotNo }
    }

    // ดึง MR ที่ตรงเงื่อนไข (เรียงล่าสุดก่อน)
    const mrRows = await MrRequestRepository.findLatestByOrConds(orConds, { transaction });

    // สร้างแผนที่ key5 -> mrRequestId (normalize ด้วย TRIM+UPPER ให้แมตช์กับ key ของ groups)
    const up = (v) => String(v ?? "").trim().toUpperCase();
    const latestByKey = new Map();
    for (const m of mrRows) {
      const key = [up(m.masterInvoiceNo), up(m.caseNo), up(m.spec), up(m.size), up(m.lotNo)].join("||");
      if (!latestByKey.has(key)) {
        latestByKey.set(key, m.mrRequestId); // แถวแรก = ล่าสุด (DESC)
      }
    }
    return latestByKey;
  }
  async step4UpdatePbByLatest(groups, latestByKey, { transaction } = {}) {
    const updatedIds = [];

    for (const [key, group] of groups) {
      const mrId = latestByKey.get(key);
      if (!mrId) continue;

      const pbIds = group.items.map(x => x.productBalanceId);
      if (!pbIds.length) continue;

      // ต้องมีเมธอดนี้ใน ProductBalanceRepository (ตามที่เคยแนบ)
      await ProductBalanceRepository.updateMrRequestIdByIds(pbIds, mrId, { transaction });

      for (const x of group.items) {
        updatedIds.push({
          productBalanceId: x.productBalanceId,
          productDetailsId: x.productDetailsId,
          newMrRequestId: mrId,
        });
      }
    }

    return updatedIds;
  }
  async buildformMrRequestLog(updatedIds, { transaction } = {}) {
    if (!Array.isArray(updatedIds) || !updatedIds.length) return [];

    const pbIds = [...new Set(updatedIds.map((x) => x.productBalanceId))];
    const pdIds = [...new Set(updatedIds.map((x) => x.productDetailsId))];
    const mrIds = [...new Set(updatedIds.map((x) => x.newMrRequestId))];

    const [mrList, pbList, pdList] = await Promise.all([
      MrRequestRepository.findAllByIds(mrIds, { transaction }),
      ProductBalanceRepository.findAllByIds(pbIds, { transaction }),
      ProductDetailsRepository.findAllByIds(pdIds, { transaction }),
    ]);

    const mrById = new Map(mrList.map((r) => [r.mrRequestId, r]));
    const pbById = new Map(pbList.map((r) => [r.productBalanceId, r]));
    const pdById = new Map(pdList.map((r) => [r.productDetailsId, r]));

    const logs = [];
    for (const { productBalanceId, productDetailsId, newMrRequestId } of updatedIds) {
      const mr = mrById.get(newMrRequestId);
      const pb = pbById.get(productBalanceId);
      const pd = pdById.get(productDetailsId);
      if (!mr || !pb || !pd) continue;

      logs.push({
        createdAt: new Date(),
        mrNo: mr.mrNo,
        mrNoDate: mr.requestDate,
        mrNoIncrement: '-', //mrNoIncrement
        stockOutDate: mr.requestDate, //stockOutDate
        invoiceNo_MasterLot: mr.masterInvoiceNo,
        invoiceNo_PartialInv: mr.partialInvoice,
        nmbPoNo: pd.poNo, //nmbPoNo
        itemName: pd.itemName, //itemName
        itemNo: '-', //itemNo
        lotNo: mr.lotNo,
        caseNo: pd.caseNo,
        spec: pd.spec,
        size: pd.size,
        quantity: mr.quantity,
        unit: mr.unit,
        remark: mr.remarks ?? "-",
        productStatusId: pb.productStatusId,
        locationId: pb.locationId,
        exportEntryNo: mr.exportEntryNo,
        vendorMasterId: mr.vendorMasterId,
      });
    }
    return logs;
  }
  async insertMrRequestLog(logs, { transaction } = {}) {
    if (!Array.isArray(logs) || logs.length === 0) return { inserted: 0 };
    await MRRequestLogRepository.bulkInsertLogs(logs, { transaction });
    return { inserted: logs.length };
  }
  async deleteMrById(mrId, { transaction } = {}) {
    const ids = Array.isArray(mrId) ? mrId : [mrId];
    const deleted = await MrRequestRepository.deleteByIds(ids, { transaction });
    return { deleted };
  }
}

module.exports = new PickingService();
