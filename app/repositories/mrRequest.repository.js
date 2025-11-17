const BaseRepository = require("./base.repository");
const db = require("../models");
const { Op } = db.Sequelize;
const MRRequest = db.mrRequest;

class MrRequestRepository extends BaseRepository {
  constructor() {
    super(MRRequest);
  }

  async findAllByIds(ids, { transaction } = {}) {
    return this.model.findAll({
      where: { mrRequestId: { [Op.in]: ids } },
      raw: true,
      transaction,
    });
  }
  async findAll(opts = {}) {
    return this.model.findAll({ raw: true, ...opts });
  }
  async findAllByFiveKeys(combos, opts = {}, { transaction } = {}) {
    if (!Array.isArray(combos) || combos.length === 0) return [];

    const CHUNK = 800;
    const results = [];
    for (let i = 0; i < combos.length; i += CHUNK) {
      const slice = combos.slice(i, i + CHUNK);
      const rows = await this.model.findAll({
        where: { [Op.or]: slice },
        transaction,
        raw: true,
        ...opts,
      });
      results.push(...rows);
    }
    return results;
  }
  async bulkCreate(items, opts = {}) {
    if (!items?.length) return [];
    const rows = await this.model.bulkCreate(items, { ...opts, returning: true });
    return rows.map(r => (r.get ? r.get({ plain: true }) : r));
  }
  async create(data, { transaction } = {}) {
    return this.model.create(data, { transaction });
  }
  async findLatestByOrConds(orConds = [], { transaction } = {}) {
    if (!orConds?.length) return [];
    return this.model.findAll({
      where: { [Op.or]: orConds },
      attributes: ["mrRequestId", "masterInvoiceNo", "caseNo", "spec", "size", "lotNo", "requestDate", "quantity", "unit", "remarks", "partialInvoice", "vendorMasterId", "lotNo"],
      order: [["mrRequestId", "DESC"]],
      raw: true,
      transaction,
    });
  }
  async deleteByIds(ids = [], { transaction } = {}) {
    if (!ids?.length) return 0;
    return this.model.destroy({
      where: { mrRequestId: { [Op.in]: ids } },
      transaction,
    });
  }
  async deleteById(id, { transaction } = {}) {
    if (id == null) return 0;
    return this.model.destroy({
      where: { mrRequestId: id },
      transaction,
    });
  }

  async findById(id, { transaction } = {}) {
    if (id == null) return null;
    return this.model.findOne({
      where: { mrRequestId: id },
      raw: true,
      transaction,
    });
  }

  async findDistinctPartialInvoices(where = {}, { transaction } = {}) {
    const rows = await this.model.findAll({
      attributes: ["partialInvoice"],
      where,
      group: ["partialInvoice"],
      raw: true,
      transaction,
    });
    return rows.map(r => r.partialInvoice).filter(Boolean);
  }

  async updateExportEntryNoByPartialInvoice(partialInvoice, exportEntryNo, { transaction } = {}) {
    if (!partialInvoice) return 0;
    const [affected] = await this.model.update(
      { exportEntryNo },
      { where: { partialInvoice }, transaction }
    );
    return affected;
  }

}

module.exports = new MrRequestRepository();
