const ItemListRepository = require("../repositories/itemList.repository");
const ProductDetailsRepository = require("../repositories/productDetails.repository");
const VendorMasterRepository = require("../repositories/vendorMaster.repository");
const LocationZoneRepository = require("../repositories/locationZone.repository");
const MakerRepository = require("../repositories/maker.repository");

class ItemListService {

   async findItemList(dataSelect) {
    try {
      let getDataSublocation = await ItemListRepository.findAllItemList();

      let dataItemListMap = new Map();
      for (let item of getDataSublocation) {
        let compoundKey = item["spec"] + "|" + item["size"] + "|" + item["w"];
        dataItemListMap.set(compoundKey, item);
      }
      let result = dataSelect.map((select) => {
        let key = select["spec"] + "|" + select["size"] + "|" + select["width"];
        let matched = dataItemListMap.get(key);
        if (matched) {
          return {
            ...select,
            itemListId: matched.itemListId,
            locationZoneId: matched.locationZoneId,
            subLocation: matched.subLocation,
            // itemWeight: matched.weight,
          };
        } else {
          return select;
        }
      });
      return result;
    } catch (error) {
      throw `${error}`;
    }
  }
  makeKey(rec) {
    return [
      rec.spec, rec.dia, rec.length, rec.size,
      rec.l, rec.w, rec.h, rec.subLocation, rec.weight,
      rec.vendorMasterId, rec.locationZoneId, rec.makerId,
    ].join("|");
  }

  async getAllItemList(query = {}) {
    try {
      const { page = 1, limit = 50, spec, size } = query;
      const offset = (page - 1) * limit;
      const { Op } = require("sequelize");
      
      // Build where clause for filters
      const whereClause = {};
      
      if (spec || size) {
        if (spec) {
          whereClause.spec = { [Op.like]: `%${spec}%` };
        }
        
        if (size) {
          whereClause.size = { [Op.like]: `%${size}%` };
        }
      }
      
      // Get itemList with pagination and filters
      const result = await ItemListRepository.model.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        raw: true,
        order: [["createdAt", "DESC"]],
      });
      
      const { count, rows: itemList } = result;
      
      if (!itemList || itemList.length === 0) {
        return { total: 0, rows: [], page: parseInt(page), limit: parseInt(limit) };
      }
      
      // Get related data
      const vendorIds = [...new Set(itemList.map(item => item.vendorMasterId).filter(Boolean))];
      const locationZoneIds = [...new Set(itemList.map(item => item.locationZoneId).filter(Boolean))];
      const makerIds = [...new Set(itemList.map(item => item.makerId).filter(Boolean))];
      
      const [vendors, locationZones, makers] = await Promise.all([
        vendorIds.length ? VendorMasterRepository.findAllByIds(vendorIds, { raw: true }) : [],
        locationZoneIds.length ? LocationZoneRepository.findAllByIds(locationZoneIds, { raw: true }) : [],
        makerIds.length ? MakerRepository.findAllByIds(makerIds, { raw: true }) : [],
      ]);
      
      const vendorMap = new Map(vendors.map(v => [v.vendorMasterId, v]));
      const zoneMap = new Map(locationZones.map(z => [z.locationZoneId, z]));
      const makerMap = new Map(makers.map(m => [m.makerId, m]));
      
      const enrichedItems = itemList.map(item => {
        const locationZone = zoneMap.get(item.locationZoneId);
        return {
          ...item,
          vendor: vendorMap.get(item.vendorMasterId) || null,
          locationZone: locationZone || null,
          maker: makerMap.get(item.makerId) || null,
          // Add zone field directly for easier access
          zone: locationZone?.zone || null,
          zoneType: locationZone?.type || null,
        };
      });
      
      return {
        total: count,
        rows: enrichedItems,
        page: parseInt(page),
        limit: parseInt(limit),
      };
    } catch (error) {
      console.error("[ItemListService] getAllItemList error:", error);
      throw error;
    }
  }

  async buildVendorMap(codes) {
    const vendorMap = new Map();
    const uniq = [...new Set((codes || []).filter(Boolean).map((c) => String(c).trim()))];
    if (!uniq.length) return vendorMap;
    const rows = await VendorMasterRepository.findByCodes(uniq);
    for (const v of rows) {
      vendorMap.set(String(v.vendorMasterCode).trim(), v.vendorMasterId);
    }
    if (vendorMap.size < uniq.length) {
      const missing = uniq.filter((c) => !vendorMap.has(c));
      for (const code of missing) {
        const row = await VendorMasterRepository.findVendorCode(code);
        if (row) vendorMap.set(String(row.vendorMasterCode).trim(), row.vendorMasterId);
      }
    }
    return vendorMap;
  }

  async buildZoneMap(zones) {
    const zoneMap = new Map();
    const uniq = [...new Set((zones || []).filter(Boolean).map((z) => String(z).trim()))];
    if (!uniq.length) return zoneMap;

    const rows = await LocationZoneRepository.findByNamesOrCodes(uniq);
    for (const z of rows) {
      if (z.zone) zoneMap.set(String(z.zone).trim(), z.locationZoneId);
    }
    return zoneMap;
  }

  async buildMakerMap(names) {
    const makerMap = new Map();
    const uniq = [...new Set((names || []).filter(Boolean).map((n) => String(n).trim()))];
    if (!uniq.length) return makerMap;

    const rows = await MakerRepository.findByNames(uniq);
    for (const m of rows) {
      if (m.makerName) makerMap.set(String(m.makerName).trim(), m.makerId);
    }
    return makerMap;
  }

  async ingestItemList({ filename, rows }) {
    try {
      // 1) สร้าง lookup maps ผ่าน repository เท่านั้น
      const [zoneMap, vendorMap, makerMap] = await Promise.all([
        this.buildZoneMap(rows.map((r) => r.zone)),
        this.buildVendorMap(rows.map((r) => r.vendorMasterCode)),
        this.buildMakerMap(rows.map((r) => r.manufacture)),
      ]);

      // 2) map → แถวสำหรับ DB + ตรวจ lookup ครบ
      const missing = [];
      const dbRows = rows.map((r, idx) => {
        const locationZoneId = zoneMap.get(String(r.zone).trim());
        const vendorMasterId = vendorMap.get(String(r.vendorMasterCode).trim());
        const makerId = makerMap.get(String(r.manufacture).trim());

        const mf = [];
        if (!locationZoneId) mf.push("Zone → locationZoneId");
        if (!vendorMasterId) mf.push("Vendor Code → vendorMasterId");
        if (!makerId) mf.push("Manufacture → makerId");
        if (mf.length) missing.push({ row: idx + 2, message: "Lookup not found", fields: mf });

        return {
          spec: r.spec,
          dia: String(r.dia),
          length: String(r.length),
          size: r.size,
          l: Number(r.l),
          w: Number(r.w),
          h: Number(r.h),
          subLocation: Number(r.subLocation),
          weight: Number(r.weight),
          vendorMasterId: vendorMasterId ?? null,
          locationZoneId: locationZoneId ?? null,
          makerId: makerId ?? null,
        };
      });

      if (missing.length) {
        const err = new Error("Lookup ids not found");
        err.code = "LOOKUP_NOT_FOUND";
        err.details = missing;
        throw err;
      }

      // 3) กันซ้ำในไฟล์
      const seen = new Set();
      const dupInFile = [];
      const unique = [];
      dbRows.forEach((r, i) => {
        const k = this.makeKey(r);
        if (seen.has(k)) dupInFile.push({ row: i + 2, message: "Duplicate within file" });
        else { seen.add(k); unique.push(r); }
      });

      // 4) กันซ้ำใน DB (batch) ผ่าน repository
      const dupInDb = [];
      const news = [];
      const BATCH = 300;
      for (let i = 0; i < unique.length; i += BATCH) {
        const part = unique.slice(i, i + BATCH);
        const found = await ItemListRepository.findExistingCompositeBatch(part);
        const foundSet = new Set(found.map((f) => this.makeKey(f)));
        part.forEach((rec, j) => {
          const key = this.makeKey(rec);
          if (foundSet.has(key)) dupInDb.push({ row: i + j + 2, message: "Duplicate in DB" });
          else news.push(rec);
        });
      }

      // 5) insert (ไม่มี transaction)
      let inserted = 0;
      if (news.length) {
        await ItemListRepository.bulkCreate(news);
        inserted = news.length;
      }

      return {
        filename,
        totalReceived: rows.length,
        success: inserted,
        skip: dupInFile.length + dupInDb.length,
        inserted,
        duplicateInFile: dupInFile.length,
        duplicateInDb: dupInDb.length,
        skipped: dupInFile.length + dupInDb.length,
        details: { dupInFile, dupInDb },
      };
    } catch (error) {
      if (error && error.code === "LOOKUP_NOT_FOUND") throw error; // ให้ controller แปลงเป็น 422
      throw `${error}`;
    }
  }

  async getUnmatchedProductDetails() {
    try {
      // 1) ดึงข้อมูล ProductDetails ทั้งหมด
      const allProductDetails = await ProductDetailsRepository.findAll();
      
      // 2) ดึงข้อมูล ItemList ทั้งหมด
      const allItemList = await ItemListRepository.findAllItemList();
      
      // 3) สร้าง Map ของ ItemList ด้วย key: spec|size|w
      const itemListMap = new Map();
      for (let item of allItemList) {
        let compoundKey = item["spec"] + "|" + item["size"] + "|" + item["w"];
        itemListMap.set(compoundKey, item);
      }
      
      // 4) หา ProductDetails ที่ไม่ match กับ ItemList
      const unmatchedProducts = [];
      for (let product of allProductDetails) {
        let key = product["spec"] + "|" + product["size"] + "|" + product["width"];
        if (!itemListMap.has(key)) {
          unmatchedProducts.push({
            productDetailsId: product.productDetailsId,
            boxNo: product.boxNo,
            masterInvoiceNo: product.masterInvoiceNo,
            caseNo: product.caseNo,
            poNo: product.poNo,
            lotNo: product.lotNo,
            heatNo: product.heatNo,
            itemName: product.itemName,
            spec: product.spec,
            size: product.size,
            quantity: product.quantity,
            unit: product.unit,
            width: product.width,
            currency: product.currency,
            unitPrice: product.unitPrice,
            amount: product.amount,
            netWeight: product.netWeight,
            grossWeight: product.grossWeight,
            importEntryNo: product.importEntryNo,
            remark: product.remark,
            vendorMasterId: product.vendorMasterId,
            mfgDate: product.mfgDate
          });
        }
      }
      
      return {
        totalProductDetails: allProductDetails.length,
        matched: allProductDetails.length - unmatchedProducts.length,
        unmatched: unmatchedProducts.length,
        unmatchedProducts: unmatchedProducts
      };
    } catch (error) {
      console.error("[ItemListService] getUnmatchedProductDetails error:", error);
      throw error;
    }
  }
}

module.exports = new ItemListService();
