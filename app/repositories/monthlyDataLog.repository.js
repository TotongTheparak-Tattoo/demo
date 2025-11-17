const BaseRepository = require("./base.repository");
const db = require("../models");
const MonthlyDataLog = db.monthlyDataLog;

class MonthlyDataLogRepository extends BaseRepository {
  constructor() {
    super(MonthlyDataLog);
  }
  async bulkCreate(items, opts = {}) {
    if (!items?.length) return [];
    const rows = await this.model.bulkCreate(items, { ...opts, returning: true });
    return rows.map(r => (r.get ? r.get({ plain: true }) : r));
  }

  async findAndCount(where = {}, { limit = 50, offset = 0, order = [["monthlyDataLogId", "DESC"]], raw = true, transaction } = {}) {
    const { rows, count } = await this.model.findAndCountAll({ where, limit, offset, order, raw, transaction });
    return { rows, count };
  }

  async create(data, options = {}) {
    const result = await this.model.create(data, options);
    return result ? (result.get ? result.get({ plain: true }) : result) : null;
  }
}

module.exports = new MonthlyDataLogRepository();


