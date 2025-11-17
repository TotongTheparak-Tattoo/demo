const BaseRepository = require("./base.repository");
const db = require("../models");
const TransactionMovement = db.transactionMovement;

class TransactionMovementRepository extends BaseRepository {
  constructor() {
    super(TransactionMovement);
  }
  async bulkCreate(items, opts = {}) {
    if (!items?.length) return [];
    const rows = await this.model.bulkCreate(items, { ...opts, returning: true });
    return rows.map(r => (r.get ? r.get({ plain: true }) : r));
  }

  async findAndCountAll(options = {}) {
    const result = await this.model.findAndCountAll(options);
    return {
      rows: result.rows.map(row => row.get ? row.get({ plain: true }) : row),
      count: result.count
    };
  }

  async findByPk(id, options = {}) {
    const result = await this.model.findByPk(id, options);
    return result ? (result.get ? result.get({ plain: true }) : result) : null;
  }

  async create(data, options = {}) {
    const result = await this.model.create(data, options);
    return result ? (result.get ? result.get({ plain: true }) : result) : null;
  }
}

module.exports = new TransactionMovementRepository();


