const { Op } = require("sequelize");
const db = require("../models");
const VendorMaster = db.vendorMaster;

const BaseRepository = require("./base.repository");

class VendorMasterRepository extends BaseRepository {
  constructor() {
    super(VendorMaster);
  }
  async findVendorIdByVendorCode(vendorCode, { transaction } = {}) {
    if (!vendorCode) return null;
    const row = await VendorMaster.findOne({
      where: { vendorMasterCode: vendorCode },
      attributes: ["vendorMasterId"],
      raw: true,
      transaction,
    });
    return row?.vendorMasterId ?? null;
  }
  async getVendorMaster() {
    return await this.model.findAll({
      attributes: ['vendorMasterId', 'vendorMasterCode', 'vendorMasterName'], raw: true
    });
  }
  async findVendorCode(vendorCode, transaction) {
    return await this.model.findOne({
      where: { vendorMasterCode: vendorCode }, raw: true, transaction: transaction
    });
  }
  async findOne(opts = {}) {
    return this.model.findOne({ raw: true, ...opts });
  }
  async findAll(opts = {}) {
    const { where = {}, raw = true, ...rest } = opts || {};
    return this.model.findAll({ where, raw, ...rest });
  }
  async findAllByIds(ids, { transaction } = {}) {
    if (!ids?.length) return [];
    return this.model.findAll({
      where: { vendorMasterId: { [Op.in]: ids } },
      raw: true,
      transaction,
    });
  }
  async insertVendorMaster(data, { transaction } = {}) {
    const { vendorMasterCode, vendorMasterName } = data;
    const created = await this.model.create(
      { vendorMasterCode, vendorMasterName },
      { transaction }
    );
    return created?.get ? created.get({ plain: true }) : created;
  }
  async findByCodes(codes = [], transaction) {
    if (!codes.length) return [];
    return this.model.findAll({
      where: { vendorMasterCode: { [Op.in]: codes } },
      raw: true,
      transaction,
    });
  }
}

module.exports = new VendorMasterRepository();
