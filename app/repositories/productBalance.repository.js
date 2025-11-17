const BaseRepository = require("./base.repository");
const db = require("../models");
const { Op } = db.Sequelize;

const Location = db.location;
const LocationZone = db.locationZone;
const ProductBalance = db.productBalance;
const ProductDetails = db.productDetails;
const VendorMaster = db.vendorMaster;
const MRRequest = db.mrRequest;
const ProductStatus = db.productStatus;


class ProductBalanceRepository extends BaseRepository {
  constructor() {
    super(ProductBalance);
    this.model = ProductBalance;
  }

  async findAllByIds(ids, { transaction } = {}) {
    return this.model.findAll({
      where: { productBalanceId: { [Op.in]: ids } },
      raw: true,
      transaction,
    });
  }
  async findAll(opts = {}) {
    return this.model.findAll({ raw: true, ...opts });
  }
  async findIdByLastMrRequest({ onlyNull = true } = {}, { transaction } = {}) {

    // เทียบแบบ case-insensitive
    const up = (v) => String(v ?? "").trim().toUpperCase();
    const key5 = (o) => [up(o.masterInvoiceNo), up(o.caseNo), up(o.spec), up(o.size), up(o.lotNo)].join("||");

    // 1) เลือก PB ที่ต้องอัปเดต
    const wherePB = onlyNull ? { mrRequestId: { [Op.is]: null } } : {};
    const pbRows = await ProductBalance.findAll({
      where: wherePB,
      attributes: ["productBalanceId", "productDetailsId"],
      raw: true,
      transaction,
    });
    // 2) ดึง PD ที่เกี่ยวข้อง
    const pdIds = [...new Set(pbRows.map(r => r.productDetailsId).filter(Boolean))];

    const pdRows = await ProductDetails.findAll({
      where: { productDetailsId: { [Op.in]: pdIds } },
      attributes: ["productDetailsId", "masterInvoiceNo", "caseNo", "spec", "size", "lotNo"],
      raw: true,
      transaction,
    });
    const pdById = new Map(pdRows.map(pd => [pd.productDetailsId, pd]));

    // 3) จัดกลุ่ม PB ตามคีย์ 5 ช่องของ PD (ไม่แปลง lotNo เป็น null)
    // groups: Map(key5 -> { pdKeyObj, items: [{ productBalanceId, productDetailsId }] })
    const groups = new Map();

    for (const pb of pbRows) {
      const pd = pdById.get(pb.productDetailsId);
      if (!pd) continue;

      const pdKeyObj = {
        masterInvoiceNo: pd.masterInvoiceNo,
        caseNo: pd.caseNo,
        spec: pd.spec,
        size: pd.size,
        lotNo: pd.lotNo,        // <-- ใช้ตามจริง ไม่แปลง null
      };
      const k = key5(pdKeyObj);

      if (!groups.has(k)) groups.set(k, { pdKeyObj, items: [] });
      groups.get(k).items.push({
        productBalanceId: pb.productBalanceId,
        productDetailsId: pb.productDetailsId,
      });
    }

    // 4) หา MRRequest ที่ตรงกับแต่ละคีย์ (ล่าสุดมาก่อน)
    const orConds = [...groups.values()].map(g => g.pdKeyObj);
    const mrRows = await MRRequest.findAll({
      where: { [Op.or]: orConds },
      attributes: ["mrRequestId", "masterInvoiceNo", "caseNo", "spec", "size", "lotNo"],
      order: [["mrRequestId", "DESC"]],
      raw: true,
      transaction,
    });

    // เก็บตัวล่าสุดต่อ key5
    const latestByKey = new Map(); // key5 -> mrRequestId
    for (const m of mrRows) {
      const k = key5({
        masterInvoiceNo: m.masterInvoiceNo,
        caseNo: m.caseNo,
        spec: m.spec,
        size: m.size,
        lotNo: m.lotNo,   // <-- ไม่แปลง null
      });
      if (!latestByKey.has(k)) latestByKey.set(k, m.mrRequestId);
    }
    // 5) อัปเดต PB เป็นชุด ๆ
    const updatedIds = [];
    for (const [k, group] of groups) {
      const mrId = latestByKey.get(k);
      if (!mrId) continue;

      const pbIds = group.items.map(x => x.productBalanceId);
      if (!pbIds.length) continue;

      await ProductBalance.update(
        { mrRequestId: mrId },
        { where: { productBalanceId: { [Op.in]: pbIds } }, transaction }
      );

      for (const x of group.items) {
        updatedIds.push({
          productBalanceId: x.productBalanceId,
          productDetailsId: x.productDetailsId,
          newMrRequestId: mrId,
        });
      }
    }

    return { affectedRowCount: updatedIds.length, updatedIds };
  }
  async findAllbymrRequestIdisNull(opts = {}, { transaction } = {}) {
    const {
      where: whereOpt = {},
      productStatusIds = [1, 2],
      ...rest
    } = opts;

    const where = {
      ...whereOpt,
      mrRequestId: { [Op.is]: null },
      productStatusId: { [Op.in]: productStatusIds },
    };

    return this.model.findAll({
      ...rest,
      where,
      raw: true,
      transaction,
    });
  }
  async findAllByLocationIdNotNull(filters = {}, opts = {}, { transaction } = {}) {
    const {
      locationId,
      updatedFrom,
      updatedTo,
    } = filters;
    const ENFORCED_STATUS = 2;

    const locationIdCond = { [Op.not]: null };
    if (locationId !== undefined) {
      if (Array.isArray(locationId)) {
        locationIdCond[Op.in] = locationId;
      } else {
        locationIdCond[Op.eq] = locationId;
      }
    }

    const where = {
      locationId: locationIdCond,

      productStatusId: ENFORCED_STATUS,

      ...((updatedFrom || updatedTo) && {
        updatedAt: {
          ...(updatedFrom && { [Op.gte]: updatedFrom }),
          ...(updatedTo && { [Op.lte]: updatedTo }),
        },
      }),
    };

    return this.model.findAll({ where, ...opts, transaction });
  }
  async findAllByMrRequestNotNullWithFilters(filters = {}, opts = {}, { transaction } = {}) {
    const {
      locationId,
      productStatusId,
      updatedFrom,
      updatedTo,
    } = filters;

    const where = {
      mrRequestId: { [Op.not]: null },
      ...(locationId !== undefined && (
        Array.isArray(locationId)
          ? { locationId: { [Op.in]: locationId } }
          : { locationId }
      )),
      ...(productStatusId !== undefined && (
        Array.isArray(productStatusId)
          ? { productStatusId: { [Op.in]: productStatusId } }
          : { productStatusId }
      )),
      ...((updatedFrom || updatedTo) && {
        updatedAt: {
          ...(updatedFrom && { [Op.gte]: updatedFrom }),
          ...(updatedTo && { [Op.lte]: updatedTo }),
        },
      }),
    };

    return this.model.findAll({
      ...opts,
      where,
      raw: true,
      transaction,
    });
  }
  async findOne(opts = {}) {
    return this.model.findOne({ raw: true, ...opts });
  }
  async findOneByIdRaw(productBalanceId, { attributes = ["productBalanceId", "palletNo", "productDetailsId", "productStatusId", "mrRequestId", "locationId"], transaction } = {}) {
    return this.model.findOne({
      where: { productBalanceId },
      attributes,
      raw: true,
      transaction,
    });
  }
  async findAndCountMrNotNull(opts = {}, { transaction } = {}) {
    const { where: whereOpt = {}, raw = true, ...rest } = opts;
    const where = {
      ...whereOpt,
      mrRequestId: { [db.Sequelize.Op.not]: null },
    };
    return this.model.findAndCountAll({
      where,
      raw,
      transaction,
      ...rest,
    });
  }
  async findOneOccupiedAtLocation(locationId, freeStatus = 3, { transaction } = {}) {
    return this.model.findOne({
      where: {
        locationId,
        productStatusId: { [Op.ne]: freeStatus },
      },
      attributes: ["productBalanceId", "palletNo"],
      raw: true,
      transaction,
    });
  }
  async getDataPreInformationByVendorId(vendorId) {
    return await ProductBalance.findAll({
      attributes: [
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.mfgDate')), 'receiveDate'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.VendorMaster.vendorMasterCode')), 'vendor'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.VendorMaster.vendorMasterName')), 'vendorName'],
        [db.Sequelize.col('ProductDetail.boxNo'), 'boxNo'],
        [db.Sequelize.col('ProductDetail.masterInvoiceNo'), 'masterInvoiceNo'],
        [db.Sequelize.col('ProductDetail.caseNo'), 'caseNo'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.poNo')), 'poNo'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.lotNo')), 'lotNo'],
        [db.Sequelize.fn('SUM', db.Sequelize.col('ProductDetail.quantity')), 'quantity'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.unit')), 'unit'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.width')), 'width'],
        [db.Sequelize.fn('SUM', db.Sequelize.col('ProductDetail.grossWeight')), 'grossWeight'],
        [db.Sequelize.col('ProductDetail.spec'), 'spec'],
        [db.Sequelize.col('ProductDetail.size'), 'size'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.importEntryNo')), 'importEntryNo'],
      ],
      include: [{ model: ProductDetails, attributes: [], required: true, include: [{ model: VendorMaster, required: true, attributes: [] }] }],
      where: {
        "$ProductDetail.vendorMasterId$": vendorId,
        productStatusId: 4,
      },
      group: [
        'ProductDetail.boxNo',
        'ProductDetail.masterInvoiceNo',
        'ProductDetail.caseNo',
        'ProductDetail.spec',
        'ProductDetail.size',
      ],
      order: [[db.Sequelize.col('ProductDetail.boxNo'), 'ASC']],
      raw: true,
    });
  }
  async getDataPreInformationByVendorIdForReprint(vendorId) {
    return await ProductBalance.findAll({
      attributes: [
        [db.Sequelize.fn('MAX', db.Sequelize.col('productBalance.mfgDate')), 'receiveDate'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('productBalance.palletNo')), 'palletNo'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.VendorMaster.vendorMasterCode')), 'vendor'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.VendorMaster.vendorMasterName')), 'vendorName'],
        [db.Sequelize.col('ProductDetail.boxNo'), 'boxNo'],
        [db.Sequelize.col('ProductDetail.masterInvoiceNo'), 'masterInvoiceNo'],
        [db.Sequelize.col('ProductDetail.caseNo'), 'caseNo'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.lotNo')), 'lotNo'],
        [db.Sequelize.fn('SUM', db.Sequelize.col('ProductDetail.quantity')), 'quantity'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.unit')), 'unit'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.width')), 'width'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.poNo')), 'poNo'],
        [db.Sequelize.col('ProductDetail.spec'), 'spec'],
        [db.Sequelize.col('ProductDetail.size'), 'size'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.importEntryNo')), 'importEntryNo'],
        [db.Sequelize.fn('MIN', db.Sequelize.col('ProductStatus.productStatusName')), 'status'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('Location.locationCode')), 'location'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('Location.LocationZone.zone')), 'zone'],
      ],
      include: [
        { model: ProductDetails, attributes: [], required: true, include: [{ model: VendorMaster, required: true, attributes: [] }] },
        { model: ProductStatus, required: true, attributes: [] },
        { model: Location, attributes: [], required: false, include: [{ model: LocationZone, attributes: [], required: true }] },

      ],
      where: {
        "$ProductDetail.vendorMasterId$": vendorId,
        productStatusId: 1,
      },
      group: [
        'productBalance.palletNo',
        'ProductDetail.boxNo',
        'ProductDetail.masterInvoiceNo',
        'ProductDetail.caseNo',
        'ProductDetail.spec',
        'ProductDetail.size',
      ],
      raw: true,
    });
  }
  async UpdateProductBalanceTransaction(data, transaction) {
    return await db.sequelize.query(`
      UPDATE [dbo].[ProductBalance]
        SET [palletNo] = ${data.palletNo}
            ,[mfgDate] = '${data.mfgDate.toISOString().slice(0, 19).replace('T', ' ')}'
            ,[updatedAt] = SYSDATETIMEOFFSET()
            ,[productStatusId] = ${data.productStatusId}
            ,[locationId] = ${data.locationId}
            WHERE productDetailsId = ${data.productDetailsId}`, { transaction: transaction })
  }
  async InsertProductBalanceUpload(productDetailsId, transaction) {
    return await ProductBalance.create(
      {
        productDetailsId: productDetailsId,
        productStatusId: 4,
      },
      {
        transaction: transaction,
      }
    );
  }
  async deleteByPalletNo(palletNo, { transaction } = {}) {
    const v = typeof palletNo === "string" ? palletNo.trim() : palletNo;
    if (v === "" || v === undefined || v === null) return { deletedCount: 0 };
    const deletedCount = await this.model.destroy({ where: { palletNo: v }, transaction });
    return { deletedCount };
  }
  async clearMrRequestIdById(productBalanceId, { transaction } = {}) {
    if (!productBalanceId) return { affectedCount: 0 };

    const [affectedCount] = await ProductBalance.update(
      { mrRequestId: null },
      {
        where: { productBalanceId },
        transaction,
      }
    );
    return { affectedCount };
  }
  async updateLocationById(productBalanceId, toLocationId, { transaction } = {}) {
    const [affected] = await this.model.update(
      { locationId: toLocationId },
      { where: { productBalanceId }, transaction }
    );
    return { affectedCount: affected };
  }
  async findToUpdate({ onlyNull = true } = {}, { transaction } = {}) {
    const where = onlyNull ? { mrRequestId: { [Op.is]: null } } : {};
    return this.model.findAll({
      where,
      attributes: ["productBalanceId", "productDetailsId", "locationId", "productStatusId"],
      raw: true,
      transaction,
    });
  }
  async updateMrRequestIdByIds(pbIds = [], mrRequestId, { transaction } = {}) {
    if (!pbIds?.length) return 0;
    const [affected] = await this.model.update(
      { mrRequestId },
      { where: { productBalanceId: { [Op.in]: pbIds } }, transaction }
    );
    return affected;
  }
  async getProductDetailsForPrintPalletNote(productDetailsId) {
    return await ProductBalance.findAll({
      attributes: [
        [db.Sequelize.col('productBalance.palletNo'), 'palletNo'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.VendorMaster.vendorMasterCode')), 'vendorCode'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.VendorMaster.vendorMasterName')), 'vendorName'],
        [db.Sequelize.col('ProductDetail.masterInvoiceNo'), 'masterInvoiceNo'],
        [db.Sequelize.col('ProductDetail.boxNo'), 'boxNo'],
        [db.Sequelize.col('ProductDetail.caseNo'), 'caseNo'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.lotNo')), 'lotNo'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.poNo')), 'poNo'],
        [db.Sequelize.fn('SUM', db.Sequelize.col('ProductDetail.quantity')), 'quantity'],
        [db.Sequelize.col('ProductDetail.spec'), 'spec'],
        [db.Sequelize.col('ProductDetail.size'), 'size'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('Location.locationCode')), 'locationCode'],
      ],
      include: [
        {
          model: ProductDetails,
          attributes: [],
          required: true,
          include: [{ model: VendorMaster, required: true, attributes: [] }]
        },
        { model: Location, attributes: [], required: true }
      ],
      where: { productDetailsId: { [db.Sequelize.Op.in]: productDetailsId } },
      group: [
        'productBalance.palletNo',
        'ProductDetail.boxNo',
        'ProductDetail.masterInvoiceNo',
        'ProductDetail.caseNo',
        'ProductDetail.spec',
        'ProductDetail.size',
      ],
      raw: true,
    });
  }
  async GetAllProductBalanceByVendorId(vendorId) {
    let fetch = await ProductBalance.findAll({
      attributes: [
        [db.Sequelize.fn('MAX', db.Sequelize.col('productBalance.mfgDate')), 'receiveDate'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('productBalance.palletNo')), 'palletNo'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('productBalance.updatedAt')), 'updatedAt'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.VendorMaster.vendorMasterCode')), 'vendor'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.VendorMaster.vendorMasterName')), 'vendorName'],
        [db.Sequelize.col('ProductDetail.masterInvoiceNo'), 'masterInvoiceNo'],
        [db.Sequelize.col('ProductDetail.caseNo'), 'caseNo'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.boxNo')), 'boxNo'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.poNo')), 'poNo'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.lotNo')), 'lotNo'],
        [db.Sequelize.fn('SUM', db.Sequelize.col('ProductDetail.quantity')), 'quantity'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.unit')), 'unit'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.width')), 'width'],
        [db.Sequelize.col('ProductDetail.spec'), 'spec'],
        [db.Sequelize.col('ProductDetail.size'), 'size'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.grossWeight')), 'grossWeight'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('ProductDetail.importEntryNo')), 'importEntryNo'],
        [db.Sequelize.fn('MIN', db.Sequelize.col('ProductStatus.productStatusName')), 'status'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('Location.locationCode')), 'location'],
        [db.Sequelize.fn('MAX', db.Sequelize.col('Location.LocationZone.zone')), 'zone'],
      ],
      include: [
        {
          model: ProductDetails, attributes: [], required: true, include: [
            { model: VendorMaster, attributes: [], required: true }
          ]
        },
        {
          model: Location, attributes: [], required: true, include: [
            { model: LocationZone, attributes: [], required: true }
          ]
        },
        { model: ProductStatus, attributes: [], required: true }
      ],
      where: {
        "$ProductDetail.vendorMasterId$": vendorId,
        '$ProductStatus.productStatusId$': { [db.Sequelize.Op.in]: [1] }
      },
      group: [
        'productBalance.palletNo',
        'ProductDetail.masterInvoiceNo',
        'ProductDetail.caseNo',
        'ProductDetail.spec',
        'ProductDetail.size',
      ],
      raw: true
    })
    const result = fetch.map(item => {
    const updateTime = item.updatedAt ? 
      new Date(item.updatedAt).toTimeString().split(' ')[0] : null;
    
    return {
      ...item,
      receiveTime: updateTime
    }
  })
    return result
  }
  async findProductBalancesByPalletNo(palletNo) {
    return await this.model.findAll({ include: [{ model: Location, required: true }], where: { palletNo: palletNo }, raw: true })
  }
  async UpdatePutAwayStatus(palletNo, locationId) {
    return await ProductBalance.update({ productStatusId: 2 }, { where: { palletNo: palletNo, locationId: locationId }, returning: true, raw: true })
  }
}

module.exports = new ProductBalanceRepository();
