const BaseRepository = require("./base.repository");
const db = require("../models");
const { Op } = require("../models").Sequelize;
const ProductDetails = db.productDetails;
const ProductBalance = db.productBalance

class ProductDetailsRepository extends BaseRepository {
  constructor() {
    super(ProductDetails);
    this.model = ProductDetails;
  }

  async findAll(opts = {}) {
    return this.model.findAll({ raw: true, ...opts });
  }
  async findAllByIds(ids, { transaction } = {}) {
    return this.model.findAll({
      where: { productDetailsId: { [Op.in]: ids } },
      raw: true,
      transaction,
    });
  }

  async getAllBoxNos() {
    return this.model.findAll({
      attributes: ['boxNo'],
      raw: true,
    }).then(results => results.map(r => r.boxNo));
  }
  async findProductByCompoundKey(masterInvoiceNo, caseNo, lotNo, spec, size, vendorMasterId, transaction) {
    return await this.model.findOne({
      where: {
        masterInvoiceNo: masterInvoiceNo,
        caseNo: caseNo,
        lotNo: lotNo,
        spec: spec,
        size: size,
        vendorMasterId: vendorMasterId,
      },
      raw: true,
      transaction: transaction
    });
  }
  async getProductDetailsByKeys(keys) {
    try {
      const conditions = keys.map(key => ({
        masterInvoiceNo: key.masterInvoiceNo,
        caseNo: key.caseNo,
        spec: key.spec,
        size: key.size
      }));

      const result = await ProductDetails.findAll({
        include: [
          { model: ProductBalance, required: true },
        ],
        where: {
          [Op.or]: conditions
        },
        raw: true,
      });

      return result;
    } catch (error) {
      throw `${error}`;
    }
  }
  async insertProduct(data, vendorMasterId, transaction) {
    let date = new Date();
    date.setHours(date.getHours() + 7);
    if (date.getUTCHours() < 7) {
      date.setDate(date.getDate() - 1);
    }

    // console.log(data, vendorMasterId, "insertProduct");

    return await this.model.create({
      mfgDate: date,
      boxNo: data.boxNo,
      masterInvoiceNo: data.masterInvoiceNo,
      caseNo: data.caseNo,
      poNo: data.poNo,
      lotNo: data.lotNo,
      heatNo: data.heatNo,
      itemName: data.itemName,
      spec: data.spec,
      size: data.size,
      quantity: data.quantity,
      unit: data.unit,
      width: data.width,
      currency: data.currency,
      unitPrice: data.unitPrice,
      amount: data.amount, 
      netWeight: data.netWeight,
      grossWeight: data.grossWeight,
      importEntryNo: data.importEntryNo,
      remark:data.remark,
      vendorMasterId: vendorMasterId
    }, {
        transaction: transaction
    });
  }
  async updateProduct(data, vendorMasterId, transaction) {
    let date = new Date();
    date.setHours(date.getHours() + 7);
    if (date.getUTCHours() < 7) {
      date.setDate(date.getDate() - 1);
    }

    // console.log(data, vendorMasterId, "insertProduct");
    return await this.model.update({
      mfgDate: date,
      poNo: data.poNo,
      heatNo: data.heatNo,
      itemName: data.itemName,
      quantity: data.quantity,
      unit: data.unit,
      width: data.width,
      currency: data.currency,
      unitPrice: data.unitPrice,
      amount: data.amount, 
      netWeight: data.netWeight,
      grossWeight: data.grossWeight,
      importEntryNo: data.importEntryNo,
      remark:data.remark,
      vendorMasterId: vendorMasterId
     }, 
      { where: { masterInvoiceNo:  data.masterInvoiceNo, caseNo: data.caseNo, lotNo: data.lotNo, spec: data.spec, size: data.size}, 
      returning: true, 
      raw: true,
      transaction: transaction
    })
  }
  async findOne(opts = {}) {
    return this.model.findOne({ raw: true, ...opts });
  }
  async findAllByIds1(ids = [], { raw = true } = {}) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    return this.model.findAll({
      where: { productDetailsId: { [Op.in]: ids } },
      raw,
    });
  }
  async findUnitById(id, { transaction } = {}) {
    return this.model.findOne({
      where: { productDetailsId: id },
      attributes: ["productDetailsId", "unit"],
      raw: true,
      transaction,
    });
  }
  async findMinimalByIds(ids = [], { transaction } = {}) {
    if (!ids?.length) return [];
    return this.model.findAll({
      where: { productDetailsId: { [Op.in]: ids } },
      attributes: ["productDetailsId", "masterInvoiceNo", "caseNo", "spec", "size", "lotNo", "poNo", "itemName"],
      raw: true,
      transaction,
    });
  }

  async findDistinctMasterInvoiceNos(where = {}, { transaction } = {}) {
    const rows = await this.model.findAll({
      attributes: ["masterInvoiceNo"],
      where,
      group: ["masterInvoiceNo"],
      raw: true,
      transaction,
    });
    return rows.map(r => r.masterInvoiceNo).filter(Boolean);
  }

  async findDistinctImportEntryNosByMaster(masterInvoiceNo, { transaction } = {}) {
    if (!masterInvoiceNo) return [];
    const rows = await this.model.findAll({
      attributes: ["importEntryNo"],
      where: { masterInvoiceNo },
      group: ["importEntryNo"],
      raw: true,
      transaction,
    });
    return rows.map(r => r.importEntryNo).filter(v => v != null && v !== "");
  }

  async updateImportEntryNoByMaster(masterInvoiceNo, importEntryNo, { transaction } = {}) {
    if (!masterInvoiceNo) return 0;
    const [affected] = await this.model.update(
      { importEntryNo },
      { where: { masterInvoiceNo }, transaction }
    );
    return affected;
  }


  async countWithVendor(where = {}, { transaction } = {}) {
    const include = [
      {
        model: db.vendorMaster,
        as: "VendorMaster",
        attributes: ["vendorMasterName", "vendorMasterCode"],
      }
    ];
    return this.model.count({ where, include, transaction });
  }

  async findAllWithVendor(where = {}, { order = [["mfgDate", "DESC"], ["productDetailsId", "DESC"]], limit, offset, transaction } = {}) {
    const include = [
      {
        model: db.vendorMaster,
        as: "VendorMaster",
        attributes: ["vendorMasterName", "vendorMasterCode"],
      }
    ];
    return this.model.findAll({ where, include, order, limit, offset, transaction, raw: false });
  }


}

module.exports = new ProductDetailsRepository();
