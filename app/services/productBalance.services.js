const MRRequestLogRepository = require("../repositories/mrRequestLog.repository");
const MrRequestRepository = require("../repositories/mrRequest.repository");
const ProductBalanceRepository = require("../repositories/productBalance.repository");
const ProductLogRepository = require("../repositories/productLog.repository");
const VendorMasterRepository = require("../repositories/vendorMaster.repository");
const LocationRepository = require("../repositories/location.repository");
const ProductDetailsRepository = require("../repositories/productDetails.repository");
const LocationZoneRepository = require("../repositories/locationZone.repository");
const { Op } = require("sequelize");

class ProductBalanceService {
  async searchProductBalance() {
    const { count, rows } = await ProductBalanceRepository.findAndCountMrNotNull({
      attributes: [
        "productBalanceId",
        "mrRequestId",
        "productDetailsId",
        "productStatusId",
        "locationId",
        "palletNo",
        "createdAt",
        "updatedAt",
      ],
      order: [
        ["updatedAt", "DESC"],
        ["productBalanceId", "DESC"],
      ],
      raw: true,
    });

    // 2) Prepare id sets
    const pdIds = [...new Set(rows.map(r => r.productDetailsId).filter(Boolean))];
    const locIds = [...new Set(rows.map(r => r.locationId).filter(Boolean))];
    const mrIds = [...new Set(rows.map(r => r.mrRequestId).filter(Boolean))];

    // 3) Batch fetch related tables via repositories
    const [pdList, locList, mrList] = await Promise.all([
      pdIds.length
        ? ProductDetailsRepository.findAllByIds(pdIds, {
          attributes: [
            "productDetailsId",
            "masterInvoiceNo",
            "boxNo",
            "caseNo",
            "itemName",
            "spec",
            "size",
            "unit",
            "quantity",
          ],
        })
        : [],
      locIds.length
        ? LocationRepository.findAllByIds(locIds, {
          attributes: ["locationId", "locationCode"],
        })
        : [],
      mrIds.length ? MrRequestRepository.findAllByIds(mrIds) : [],
    ]);

    const pdById = new Map(pdList.map(x => [x.productDetailsId, x]));
    const locById = new Map(locList.map(x => [x.locationId, x]));
    const mrById = new Map(mrList.map(x => [x.mrRequestId, x]));

    // 4) VendorMaster (optional)
    const vendorIds = [...new Set(mrList.map(m => m?.vendorMasterId).filter(Boolean))];
    let vendorById = new Map();
    if (vendorIds.length) {
      const vRows = await VendorMasterRepository.findAllByIds(vendorIds, {
        attributes: ["vendorMasterId", "vendorMasterCode", "vendorMasterName"],
      });
      vendorById = new Map(vRows.map(v => [v.vendorMasterId, v]));
    }

    // 5) Compose result (null-safe)
    const combined = rows.map(pb => {
      const pd = pb.productDetailsId ? pdById.get(pb.productDetailsId) : null;
      const loc = pb.locationId ? locById.get(pb.locationId) : null;
      const mr = pb.mrRequestId ? mrById.get(pb.mrRequestId) : null;

      const vendorMasterId = mr?.vendorMasterId ?? null;
      const vObj = vendorMasterId ? vendorById.get(vendorMasterId) : null;
      const vendorMasterCode = vObj?.vendorMasterCode ?? null;
      const vendorMasterName = vObj?.vendorMasterName ?? null;
      const vendorLabel =
        vendorMasterCode ??
        vendorMasterName ??
        vObj?.name ??
        vObj?.vendor ??
        vendorMasterId ??
        null;

      const receiveDate = pb.updatedAt ?? pb.createdAt ?? null;

      return {
        receiveDate,
        vendor: vendorLabel,
        vendorMasterId,
        vendorMasterCode,
        vendorMasterName,

        requestDate: mr?.requestDate ?? null,
        partialInvoice: mr?.partialInvoice ?? null,
        masterInvoiceNo: mr?.masterInvoiceNo ?? pd?.masterInvoiceNo ?? null,

        itemName: pd?.itemName ?? null,
        caseNo: pd?.caseNo ?? null,
        palletNo: pb.palletNo ?? null,
        quantity: pd?.quantity ?? null,
        spec: pd?.spec ?? null,
        size: pd?.size ?? null,

        // Return both locationId & code; use code for display
        location: loc?.locationCode ?? null,
        locationId: pb.locationId ?? null,
        locationCode: loc?.locationCode ?? null,

        remark: mr?.remark ?? null,
        deliveryTo: mr?.deliveryTo ?? null,

        // raw keys
        productBalanceId: pb.productBalanceId,
        mrRequestId: pb.mrRequestId ?? null,
        productDetailsId: pb.productDetailsId ?? null,
        productStatusId: pb.productStatusId ?? null,
        unit: pd?.unit ?? null,

        ProductDetails: pd
          ? {
            productDetailsId: pd.productDetailsId,
            masterInvoiceNo: pd.masterInvoiceNo,
            caseNo: pd.caseNo,
            boxNo: pd.boxNo,
            spec: pd.spec,
            size: pd.size,
            unit: pd.unit,
          }
          : null,
        createdAt: pb.createdAt,
        updatedAt: pb.updatedAt,
      };
    });

    return { total: count, rows: combined };
  }

  async getDistinctMasterInvoiceNos(search = "") {
    const where = {};
    const s = String(search || "").trim();
    if (s) {
      // simple LIKE filter
      const { Op } = ProductDetailsRepository.model.sequelize.constructor;
      where.masterInvoiceNo = { [Op.like]: `%${s}%` };
    }
    const list = await ProductDetailsRepository.findDistinctMasterInvoiceNos(where);
    return list;
  }

  async updateImportEntryNoForMaster(masterInvoiceNo, importEntryNo) {
    const m = String(masterInvoiceNo || "").trim();
    if (!m) {
      return { updated: 0, masterInvoiceNo: m, importEntryNo };
    }
    const updated = await ProductDetailsRepository.updateImportEntryNoByMaster(m, importEntryNo);
    return { updated, masterInvoiceNo: m, importEntryNo };
  }

  async getDistinctPartialInvoices(search = "") {
    const where = {};
    const s = String(search || "").trim();
    if (s) {
      const { Op } = MrRequestRepository.model.sequelize.constructor;
      where.partialInvoice = { [Op.like]: `%${s}%` };
    }
    return await MrRequestRepository.findDistinctPartialInvoices(where);
  }

  async updateExportEntryNoForPartialInvoice(partialInvoice, exportEntryNo) {
    const p = String(partialInvoice || "").trim();
    if (!p) {
      return { updated: 0, partialInvoice: p, exportEntryNo };
    }
    const updated = await MrRequestRepository.updateExportEntryNoByPartialInvoice(p, exportEntryNo ?? null);
    return { updated, partialInvoice: p, exportEntryNo };
  }

  async getProductBalanceByPallet(pallet) {
    const palletNo = (pallet ?? "").toString().trim();
    if (!palletNo) return { total: 0, rows: [] };

    // Fetch all rows for this pallet
    const pbRows = await ProductBalanceRepository.findAll({
      where: { palletNo },
      attributes: [
        "productBalanceId",
        "mrRequestId",
        "productDetailsId",
        "productStatusId",
        "locationId",
        "palletNo",
        "createdAt",
        "updatedAt",
      ],
      order: [
        ["updatedAt", "DESC"],
        ["productBalanceId", "DESC"],
      ],
      raw: true,
    });

    const total = pbRows.length;
    if (!total) return { total: 0, rows: [] };

    // Prepare id sets
    const pdIds = [...new Set(pbRows.map(r => r.productDetailsId).filter(Boolean))];
    const locIds = [...new Set(pbRows.map(r => r.locationId).filter(Boolean))];

    // Batch fetch related tables once
    const [pdList, locList] = await Promise.all([
      pdIds.length
        ? ProductDetailsRepository.findAllByIds(pdIds, {
          attributes: [
            "productDetailsId",
            "masterInvoiceNo",
            "caseNo",
            "spec",
            "size",
            "unit",
            "quantity",
            "vendorMasterId",
            "itemName",
          ],
          raw: true,
        })
        : [],
      locIds.length
        ? LocationRepository.findAllByIds(locIds, {
          attributes: ["locationId", "locationCode"],
          raw: true,
        })
        : [],
    ]);

    // Resolve vendor from PD.vendorMasterId
    const vendorIds = [
      ...new Set(pdList.map(p => p?.vendorMasterId).filter(v => v !== null && v !== undefined)),
    ];
    const vendorList = vendorIds.length
      ? await VendorMasterRepository.findAllByIds(vendorIds, {
        attributes: ["vendorMasterId", "vendorMasterCode", "vendorMasterName"],
      })
      : [];

    // maps
    const pdById = new Map(pdList.map(x => [x.productDetailsId, x]));
    const locById = new Map(locList.map(x => [x.locationId, x]));
    const vmById = new Map(vendorList.map(v => [v.vendorMasterId, v]));

    // Compose rows
    const rows = pbRows.map(pb => {
      const pd = pb.productDetailsId ? pdById.get(pb.productDetailsId) : null;
      const loc = pb.locationId ? locById.get(pb.locationId) : null;

      const vendorMasterId = pd?.vendorMasterId ?? null;
      const vm = vendorMasterId ? vmById.get(vendorMasterId) : null;
      const vendorMasterCode = vm?.vendorMasterCode ?? null;
      const vendorMasterName = vm?.vendorMasterName ?? null;

      const receiveDate = pb.updatedAt ?? pb.createdAt ?? null;

      return {
        receiveDate,
        vendorMasterId,
        vendorMasterCode,
        vendorMasterName,

        partialInvoice: null,
        masterInvoiceNo: pd?.masterInvoiceNo ?? null,
        caseNo: pd?.caseNo ?? null,
        palletNo: pb.palletNo ?? null,
        quantity: pd?.quantity ?? null,
        spec: pd?.spec ?? null,
        size: pd?.size ?? null,
        unit: pd?.unit ?? null,

        location: loc?.locationCode ?? pb.locationId ?? null,
        locationId: pb.locationId ?? null,
        locationCode: loc?.locationCode ?? null,

        productBalanceId: pb.productBalanceId,
        mrRequestId: pb.mrRequestId ?? null,
        productDetailsId: pb.productDetailsId ?? null,
        productStatusId: pb.productStatusId ?? null,

        ProductDetails: pd
          ? {
            productDetailsId: pd.productDetailsId,
            masterInvoiceNo: pd.masterInvoiceNo,
            caseNo: pd.caseNo,
            spec: pd.spec,
            size: pd.size,
            unit: pd.unit,
            vendorMasterId: pd.vendorMasterId,
            itemName: pd.itemName,
          }
          : null,
        createdAt: pb.createdAt,
        updatedAt: pb.updatedAt,
      };
    });

    return { total, rows };
  }

  async getReceiveLocation(locationCode, { transaction } = {}) {
    // Fetch the full location row (with locationZoneId)
    const loc = await LocationRepository.getLocationIdByLocationCode(
      locationCode,
      { transaction }
    );

    if (!loc) return null;

    // If there is a locationZoneId → fetch the zone
    let zone = null;
    const zoneId = Number(loc.locationZoneId);
    if (!Number.isNaN(zoneId) && zoneId > 0) {
      zone = await LocationZoneRepository.findById(zoneId, { transaction });
    }

    // Return a “combined” object for frontend convenience
    // - Keep zone under LocationZone to avoid column collisions with Location
    return {
      ...loc,
      LocationZone: zone, // e.g., { locationZoneId, zoneName, zoneCode, ... }
    };
  }

  async deleteByPalletNo(palletNo) {
    const v = typeof palletNo === "string" ? palletNo.trim() : palletNo;
    if (v === "" || v === undefined || v === null) {
      return { deletedCount: 0, loggedCount: 0 };
    }

    // 1) Snapshot for logging (best effort, even without a transaction)
    const toLog = await ProductBalanceRepository.findAll({
      where: { palletNo: v },
      attributes: [
        "productBalanceId",
        "palletNo",
        "productDetailsId",
        "productStatusId",
        "locationId",
        "mrRequestId",
      ],
      raw: true,
    });

    // 2) Delete actual rows
    const { deletedCount } = await ProductBalanceRepository.deleteByPalletNo(v);

    // 3) Try to log best-effort (don’t let logging failure break the main flow)
    let loggedCount = 0;
    if (deletedCount > 0 && toLog.length > 0) {
      for (const r of toLog) {
        try {
          await ProductLogRepository.InsertProductLogTransaction({
            palletNo: r.palletNo,
            productDetailsId: r.productDetailsId,
            productStatusId: 3, // deleted/void status
            locationId: r.locationId,
            mrRequestId: r.mrRequestId,
          });
          loggedCount += 1;
        } catch (e) {
          // No transaction here, so don’t break the main flow — just log it
          console.error("InsertProductLog failed:", e?.message || e);
        }
      }
    }

    return { deletedCount, loggedCount };
  }

  async getAllByMrIdNotNull(query = {}) {
    const pbRows = await ProductBalanceRepository.findAllByMrRequestNotNullWithFilters(
      {
        locationId: query.locationId,
        productStatusId: query.productStatusId,
        updatedFrom: query.updatedFrom,
        updatedTo: query.updatedTo,
      },
      {
        order: [
          ["updatedAt", "DESC"],
          ["productBalanceId", "DESC"],
        ],
        raw: true,
      }
    );

    const total = pbRows.length;
    if (!total) return { total: 0, rows: [] };

    // ---- MR (fetch once) ----
    const mrIds = [...new Set(pbRows.map(r => r.mrRequestId).filter(Boolean))];
    const mrList = mrIds.length ? await MrRequestRepository.findAllByIds(mrIds, { raw: true }) : [];
    const mrById = new Map(mrList.map(m => [m.mrRequestId, m]));

    // ---- Vendor ----
    const vendorIds = [
      ...new Set(mrList.map(m => m?.vendorMasterId).filter(v => v !== null && v !== undefined)),
    ];
    const vendorList = vendorIds.length
      ? await VendorMasterRepository.findAllByIds(vendorIds, {
        attributes: ["vendorMasterId", "vendorMasterName"],
        raw: true,
      })
      : [];
    // ---- Location (ใช้ findLocationById ตามที่ขอ) ----
    const locIds = [...new Set(pbRows.map(r => r.locationId).filter(Boolean))];
    let locById = new Map();
    if (locIds.length) {
      const locList = await Promise.all(
        locIds.map(async (id) => {
          try {
            // สมมติ findLocationById คืน object { locationId, locationCode, rack, bay, shelf, subBay, locationZoneId, subLocation, ... }
            const loc = await LocationRepository.findLocationById(id);
            return loc ? { ...loc } : null;
          } catch (e) {
            // กัน error รายตัวไว้ไม่ให้ล้มทั้งรายการ
            console.error("[getAllByMrIdNotNull] findLocationById error:", id, e?.message);
            return null;
          }
        })
      );
      locById = new Map(
        locList
          .filter(Boolean)
          .map((loc) => [Number(loc.locationId), loc])
      );
    }
    const vById = new Map(vendorList.map(v => [String(v.vendorMasterId), v.vendorMasterName]));

    const rows = pbRows.map(pb => {
      const mr = mrById.get(pb.mrRequestId) || {};
      const vendorMasterId = mr.vendorMasterId ?? null;
      const vendorMasterName =
        vendorMasterId != null ? vById.get(String(vendorMasterId)) ?? null : null;

      const locObj = pb.locationId ? locById.get(Number(pb.locationId)) || null : null;
      return {
        // ProductBalance
        productBalanceId: pb.productBalanceId,
        mrRequestId: pb.mrRequestId ?? null,
        productDetailsId: pb.productDetailsId ?? null,
        productStatusId: pb.productStatusId ?? null,
        palletNo: pb.palletNo ?? null,
        createdAt: pb.createdAt,
        updatedAt: pb.updatedAt,

        //Location
        locationId: pb.locationId ?? null,
        locationCode: locObj?.locationCode ?? null,

        // MR
        masterInvoiceNo: mr.masterInvoiceNo ?? null,
        partialInvoice: mr.partialInvoice ?? null,
        requestDate: mr.requestDate ?? null,
        vendorMasterId,
        vendorMasterName,
        remark: mr.remark ?? null,
        deliveryTo: mr.deliveryTo ?? null,
      };
    });

    return { total, rows };
  }

  async clearMrRequestByProductBalanceId(productBalanceId) {
    // 1) Read PB
    const pb = await ProductBalanceRepository.findOne({
      where: { productBalanceId },
      attributes: [
        "productBalanceId", "palletNo", "productDetailsId",
        "locationId", "productStatusId", "mrRequestId", "createdAt", "updatedAt"
      ],
      raw: true,
    });

    if (!pb) {
      return { ok: false, reason: "NOT_FOUND", affectedCount: 0, mrRequestId: null };
    }

    // Keep original mrId to return back to caller
    const mrId = pb.mrRequestId;

    if (mrId == null) {
      return { ok: true, reason: "ALREADY_NULL", affectedCount: 0, mrRequestId: null };
    }

    // 2) Read MR + PD (if any)
    const [mr, pd] = await Promise.all([
      MrRequestRepository
        .findAllByIds([mrId])
        .then(a => a?.[0] || null),
      pb.productDetailsId
        ? ProductDetailsRepository.findOne({
          where: { productDetailsId: pb.productDetailsId },
          attributes: [
            "productDetailsId", "masterInvoiceNo", "caseNo",
            "itemName", "spec", "size", "unit", "quantity"
          ],
          raw: true,
        })
        : null,
    ]);

    // 3) Clear mrRequestId
    const { affectedCount } = await ProductBalanceRepository.clearMrRequestIdById(productBalanceId);

    if (affectedCount > 0) {
      const now = new Date();

      const stockOutDateCandidate =
        mr?.stockOutDate ??
        mr?.requestDate ??
        pb?.updatedAt ??
        pb?.createdAt ??
        now;

      const mrNoDateCandidate =
        mr?.requestDate ??
        pb?.updatedAt ??
        now;

      const logItem = {
        registered_at: now,
        updated_at: null,

        mrNo: mr?.mrNo ?? null,
        mrNoDate: mrNoDateCandidate,
        stockOutDate: stockOutDateCandidate,

        mrNoIncrement: mr?.mrNoIncrement ?? "-",
        invoiceNo_MasterLot: mr?.masterInvoiceNo ?? pd?.masterInvoiceNo ?? null,
        invoiceNo_PartialInv: mr?.partialInvoice ?? null,
        nmbPoNo: "-",
        exportEntryNo: mr?.exportEntryNo ?? null,
        itemName: pd?.itemName ?? null,
        itemNo: "-",
        lotNo: mr?.lotNo ?? null,
        caseNo: pd?.caseNo ?? null,
        spec: pd?.spec ?? null,
        size: pd?.size ?? null,

        quantity: pd?.quantity ?? null,
        unit: pd?.unit ?? null,
        remark: mr?.remarks ?? "-",

        productStatusId: "3",
        locationId: pb.locationId ?? null,
        vendorMasterId: mr?.vendorMasterId ?? null,
      };

      try {
        await MRRequestLogRepository.bulkInsertLogs([logItem]);
      } catch (e) {
        console.error("bulkInsertLogs failed:", e?.message || e);
      }
    }

    return { ok: true, reason: "UPDATED", affectedCount, mrRequestId: mrId };
  }

  async moveLocationBulk(locationId, items) {
    // ---------- Helpers ----------
    const getDestination = async () => {
      const loc = await LocationRepository.findOne({
        where: { locationId },
        attributes: ["locationId", "locationCode", "locationZoneId"],
        raw: true,
      });
      if (!loc) throw new Error(`Location not found: ${locationId}`);
      return loc;
    };

    const ensureDestinationFree = async (loc) => {
      const existing = await ProductBalanceRepository.findOneOccupiedAtLocation(loc.locationId, 3, {
        attributes: ["productBalanceId", "palletNo"],
      });
      if (existing) {
        throw new Error(`Destination "${loc.locationCode}" is occupied.`);
      }
    };

    const pbCache = new Map();
    const unitCache = new Map();
    const zoneCache = new Map();

    const getPB = async (productBalanceId) => {
      if (pbCache.has(productBalanceId)) return pbCache.get(productBalanceId);
      const pb = await ProductBalanceRepository.findOneByIdRaw(productBalanceId);
      if (!pb) throw new Error(`ProductBalance not found: ${productBalanceId}`);
      pbCache.set(productBalanceId, pb);
      return pb;
    };

    const getUnit = async (productDetailsId) => {
      if (unitCache.has(productDetailsId)) return unitCache.get(productDetailsId);
      const row = await ProductDetailsRepository.findUnitById(productDetailsId);
      const unit = (row?.unit ?? "").toString().trim();
      unitCache.set(productDetailsId, unit);
      return unit;
    };

    const getZoneByUnit = async (unitLower) => {
      if (zoneCache.has(unitLower)) return zoneCache.get(unitLower);
      const zone = await LocationZoneRepository.findByTypeInsensitive(unitLower);
      zoneCache.set(unitLower, zone || null);
      return zone;
    };

    const assertSameZone = (unit, zoneIdFromUnit, targetZoneId, destCode) => {
      if (String(zoneIdFromUnit) !== String(targetZoneId)) {
        throw new Error(
          `Zone mismatch: unit "${unit}" -> zone ${zoneIdFromUnit}, ` +
          `but destination ${destCode} is zone ${targetZoneId}`
        );
      }
    };

    const MOVE_STATUS_FALLBACK = "7";
    const updateAndLog = async (it, destLoc) => {
      const pb = await getPB(it.productBalanceId);

      const { affectedCount } = await ProductBalanceRepository.updateLocationById(
        it.productBalanceId,
        destLoc.locationId
      );
      if (!affectedCount) {
        throw new Error(`Update location failed for PB ${it.productBalanceId}`);
      }

      // Best-effort logging (no transaction → don’t break the main flow)
      try {
        await ProductLogRepository.InsertProductLog({
          palletNo: pb?.palletNo ?? null,
          productDetailsId: it.productDetailsId ?? pb?.productDetailsId ?? null,
          productStatusId: MOVE_STATUS_FALLBACK,
          locationId: destLoc.locationId,
          mrRequestId: it.mrRequestId ?? pb?.mrRequestId ?? null,
        });
      } catch (e) {
        console.error("ProductLog insert failed:", e?.message || e);
      }
    };

    // ---------- 0) Destination ----------
    const dest = await getDestination();

    // ---------- 0.5) Destination must be free ----------
    await ensureDestinationFree(dest);

    // ---------- 1) Validate each item ----------
    for (const it of items) {
      const pb = await getPB(it.productBalanceId);
      const pdId = it.productDetailsId ?? pb.productDetailsId;
      if (!pdId) throw new Error(`Missing productDetailsId for PB ${it.productBalanceId}`);

      const unit = await getUnit(pdId);
      if (!unit) throw new Error(`Unit not found for ProductDetails (${pdId}) of PB ${it.productBalanceId}`);

      const zoneRow = await getZoneByUnit(unit.toLowerCase());
      if (!zoneRow?.locationZoneId) {
        throw new Error(`LocationZone not found for unit: ${unit} (pd=${pdId}, pb=${it.productBalanceId})`);
      }

      assertSameZone(unit, zoneRow.locationZoneId, dest.locationZoneId, dest.locationCode);
    }

    // ---------- 2) Update + Log ----------
    for (const it of items) {
      await updateAndLog(it, dest);
    }

    return {
      movedCount: items.length,
      locationId: dest.locationId,
      locationCode: dest.locationCode ?? null,
    };
  }

  async getAllByLocationIdNotNull(query = {}) {
    // 1) Fetch rows with non-null locationId (accept the same filters as repo)
    const pbRows = await ProductBalanceRepository.findAllByLocationIdNotNull(
      {
        locationId: query.locationId,           // single or array
        productStatusId: query.productStatusId, // single or array
        updatedFrom: query.updatedFrom,         // Date|string
        updatedTo: query.updatedTo,             // Date|string
      },
      {
        order: [
          ["updatedAt", "DESC"],
          ["productBalanceId", "DESC"],
        ],
        raw: true,
      }
    );

    const total = pbRows.length;
    if (!total) return { total: 0, rows: [] };

    // 2) Prepare id sets
    const pdIds = [...new Set(pbRows.map(r => r.productDetailsId).filter(Boolean))];
    const locIds = [...new Set(pbRows.map(r => r.locationId).filter(Boolean))];
    const mrIds = [...new Set(pbRows.map(r => r.mrRequestId).filter(Boolean))];

    // 3) Batch fetch related tables once
    const [pdList, locList, mrList] = await Promise.all([
      pdIds.length
        ? ProductDetailsRepository.findAllByIds(pdIds, {
          attributes: [
            "productDetailsId",
            "masterInvoiceNo",
            "caseNo",
            "itemName",
            "spec",
            "size",
            "unit",
            "quantity",
            "lotNo",
          ],
          raw: true,
        })
        : [],
      locIds.length
        ? LocationRepository.findAllByIds(locIds, {
          attributes: ["locationId", "locationCode", "locationZoneId"],
          raw: true,
        })
        : [],
      mrIds.length
        ? MrRequestRepository.findAllByIds(mrIds, { raw: true })
        : [],
    ]);

    const pdById = new Map(pdList.map(x => [x.productDetailsId, x]));
    const locById = new Map(locList.map(x => [x.locationId, x]));
    const mrById = new Map(mrList.map(x => [x.mrRequestId, x]));

    // 4) Vendor (optional, via MR)
    const vendorIds = [
      ...new Set(mrList.map(m => m?.vendorMasterId).filter(v => v !== null && v !== undefined)),
    ];
    let vendorById = new Map();
    if (vendorIds.length) {
      const vendors = await VendorMasterRepository.findAllByIds(vendorIds, {
        attributes: ["vendorMasterId", "vendorMasterCode", "vendorMasterName"],
        raw: true,
      });
      vendorById = new Map(vendors.map(v => [v.vendorMasterId, v]));
    }

    // 5) Compose rows
    const rows = pbRows.map(pb => {
      const pd = pb.productDetailsId ? pdById.get(pb.productDetailsId) : null;
      const loc = pb.locationId ? locById.get(pb.locationId) : null;
      const mr = pb.mrRequestId ? mrById.get(pb.mrRequestId) : null;

      const vmId = mr?.vendorMasterId ?? null;
      const vm = vmId ? vendorById.get(vmId) : null;

      return {
        // Core PB
        productBalanceId: pb.productBalanceId,
        mrRequestId: pb.mrRequestId ?? null,
        productDetailsId: pb.productDetailsId ?? null,
        productStatusId: pb.productStatusId ?? null,
        locationId: pb.locationId ?? null,
        palletNo: pb.palletNo ?? null,
        createdAt: pb.createdAt,
        updatedAt: pb.updatedAt,

        // Location
        location: loc?.locationCode ?? null,       // for display
        locationCode: loc?.locationCode ?? null,   // explicit
        locationZoneId: loc?.locationZoneId ?? null,

        // ProductDetails
        itemName: pd?.itemName ?? null,
        caseNo: pd?.caseNo ?? null,
        quantity: pd?.quantity ?? null,
        spec: pd?.spec ?? null,
        size: pd?.size ?? null,
        unit: pd?.unit ?? null,
        lotNo: pd?.lotNo ?? null,


        // Invoice (prefer MR; fallback to PD)
        masterInvoiceNo: mr?.masterInvoiceNo ?? pd?.masterInvoiceNo ?? null,
        partialInvoice: mr?.partialInvoice ?? null,

        // MR extras
        requestDate: mr?.requestDate ?? null,
        remark: mr?.remark ?? mr?.remarks ?? null,
        deliveryTo: mr?.deliveryTo ?? null,

        // Vendor (if available)
        vendorMasterId: vmId,
        vendorMasterCode: vm?.vendorMasterCode ?? null,
        vendorMasterName: vm?.vendorMasterName ?? null,

        // Embed minimal PD (consistent with other methods)
        ProductDetails: pd
          ? {
            productDetailsId: pd.productDetailsId,
            masterInvoiceNo: pd.masterInvoiceNo,
            caseNo: pd.caseNo,
            spec: pd.spec,
            size: pd.size,
            unit: pd.unit,
          }
          : null,
      };
    });

    return { total, rows };
  }

  async getMrRequestById(mrRequestId) {
    if (!mrRequestId) return null;
    return await MrRequestRepository.findById(mrRequestId);
  }

  async getProductDetailsByStatus4(query = {}) {
    try {
      const { page = 1, limit = 50, masterInvoiceNo, caseNo } = query;
      const offset = (page - 1) * limit;
      
      // Build where clause for filters
      const whereClause = { productStatusId: 4 };
      
      // Get filtered productDetailsIds first
      if (masterInvoiceNo || caseNo) {
        const pdWhere = {};
        
        if (masterInvoiceNo) {
          pdWhere.masterInvoiceNo = { [Op.like]: `%${masterInvoiceNo}%` };
        }
        
        if (caseNo) {
          pdWhere.caseNo = { [Op.like]: `%${caseNo}%` };
        }
        
        // Get matching productDetailsIds from ProductDetails
        const matchedProducts = await ProductDetailsRepository.model.findAll({
          where: pdWhere,
          attributes: ['productDetailsId'],
          raw: true,
        });
        
        const matchedIds = matchedProducts.map(p => p.productDetailsId);
        
        if (matchedIds.length > 0) {
          whereClause.productDetailsId = { [Op.in]: matchedIds };
        } else {
          // No matches, return empty result
          return { total: 0, rows: [], page: parseInt(page), limit: parseInt(limit) };
        }
      }

      // 1) Get productBalance where status = 4 with pagination
      const result = await ProductBalanceRepository.model.findAndCountAll({
        where: whereClause,
        attributes: ["productBalanceId", "productDetailsId", "palletNo", "updatedAt", "createdAt"],
        order: [["updatedAt", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
        raw: true,
      });
      
      const count = result.count;
      const pbRows = result.rows;

      if (!pbRows || pbRows.length === 0) {
        return { total: 0, rows: [], page: parseInt(page), limit: parseInt(limit) };
      }

      // 2) Extract productDetailsIds
      const productDetailsIds = [...new Set(pbRows.map(r => r.productDetailsId).filter(Boolean))];

      // 3) Fetch ProductDetails for these IDs
      const productDetailsList = productDetailsIds.length
        ? await ProductDetailsRepository.findAllByIds(productDetailsIds, {
          attributes: [
            "productDetailsId",
            "mfgDate",
            "boxNo",
            "masterInvoiceNo",
            "caseNo",
            "poNo",
            "lotNo",
            "heatNo",
            "itemName",
            "spec",
            "size",
            "quantity",
            "unit",
            "width",
            "currency",
            "unitPrice",
            "amount",
            "netWeight",
            "grossWeight",
            "importEntryNo",
            "remark",
            "vendorMasterId",
          ],
        })
        : [];

      // 4) Get vendors
      const vendorIds = [...new Set(productDetailsList.map(p => p?.vendorMasterId).filter(Boolean))];
      const vendorList = vendorIds.length
        ? await VendorMasterRepository.findAllByIds(vendorIds, {
          attributes: ["vendorMasterId", "vendorMasterCode", "vendorMasterName"],
          raw: true,
        })
        : [];

      const vendorById = new Map(vendorList.map(v => [v.vendorMasterId, v]));

      // 5) Create a map of productDetailsId to productBalance records
      const pbByPdId = new Map();
      pbRows.forEach(pb => {
        if (pb.productDetailsId) {
          if (!pbByPdId.has(pb.productDetailsId)) {
            pbByPdId.set(pb.productDetailsId, []);
          }
          pbByPdId.get(pb.productDetailsId).push(pb);
        }
      });

      // 6) Compose result
      const rows = productDetailsList.map(pd => {
        const pbs = pbByPdId.get(pd.productDetailsId) || [];
        const vendor = pd.vendorMasterId ? vendorById.get(pd.vendorMasterId) : null;

        return {
          productDetailsId: pd.productDetailsId,
          mfgDate: pd.mfgDate,
          boxNo: pd.boxNo,
          masterInvoiceNo: pd.masterInvoiceNo,
          caseNo: pd.caseNo,
          poNo: pd.poNo,
          lotNo: pd.lotNo,
          heatNo: pd.heatNo,
          itemName: pd.itemName,
          spec: pd.spec,
          size: pd.size,
          quantity: pd.quantity,
          unit: pd.unit,
          width: pd.width,
          currency: pd.currency,
          unitPrice: pd.unitPrice,
          amount: pd.amount,
          netWeight: pd.netWeight,
          grossWeight: pd.grossWeight,
          importEntryNo: pd.importEntryNo,
          remark: pd.remark,
          vendorMasterId: pd.vendorMasterId,
          vendorMasterCode: vendor?.vendorMasterCode ?? null,
          vendorMasterName: vendor?.vendorMasterName ?? null,
          productBalances: pbs.map(pb => ({
            productBalanceId: pb.productBalanceId,
            createdAt: pb.createdAt,
            updatedAt: pb.updatedAt,
          })),
        };
      });

      return {
        total: count,
        rows,
        page: parseInt(page),
        limit: parseInt(limit),
      };
    } catch (error) {
      console.error("[ProductBalanceService.getProductDetailsByStatus4] error:", error);
      throw error;
    }
  }

  async deleteByProductDetailsId(productDetailsId, { transaction } = {}) {
    try {
      const ProductLogRepository = require("../repositories/productLog.repository");
      
      // Start transaction if not provided
      const needsTransaction = !transaction;
      const t = transaction || await require("../models").sequelize.transaction();

      let deletedCounts = {
        productBalance: 0,
        productDetails: 0,
        productLog: 0,
      };

      try {
        // 1) Delete from ProductLog
        const logDeleted = await ProductLogRepository.deleteProductLogByProductDetailsId(
          productDetailsId,
          t
        );
        deletedCounts.productLog = Array.isArray(logDeleted) ? logDeleted[0] : (logDeleted || 0);

        // 2) Delete from ProductBalance
        const pbDestroyResult = await require("../models").productBalance.destroy({
          where: { productDetailsId },
          transaction: t,
        });
        deletedCounts.productBalance = Array.isArray(pbDestroyResult) ? pbDestroyResult[0] : (pbDestroyResult || 0);

        // 3) Delete from ProductDetails
        const pdDeleted = await ProductDetailsRepository.model.destroy({
          where: { productDetailsId },
          transaction: t,
        });
        deletedCounts.productDetails = Array.isArray(pdDeleted) ? pdDeleted[0] : (pdDeleted || 0);

        // Commit transaction
        if (needsTransaction) {
          await t.commit();
        }

        return {
          success: true,
          message: "Deleted successfully",
          deletedCounts,
        };
      } catch (error) {
        if (needsTransaction) {
          await t.rollback();
        }
        throw error;
      }
    } catch (error) {
      console.error("[ProductBalanceService.deleteByProductDetailsId] error:", error);
      throw error;
    }
  }
}

module.exports = new ProductBalanceService();
