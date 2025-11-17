const BaseRepository = require("./base.repository");
const db = require("../models");
const TransactionMovementLog = db.transactionMovementLog;

class TransactionMovementLogRepository extends BaseRepository {
  constructor() {
    super(TransactionMovementLog);
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

  async create(data, options = {}) {
    const result = await this.model.create(data, options);
    return result ? (result.get ? result.get({ plain: true }) : result) : null;
  }
}

module.exports = new TransactionMovementLogRepository();


