const { Op } = require("sequelize");
const db = require("../models");
const Maker = db.maker

const BaseRepository = require("./base.repository");

class MakerRepository extends BaseRepository {
  constructor() {
    super(Maker);
  }
  async findAll(opts = {}) {
    return this.model.findAll({ raw: true, ...opts });
  }
  async findByNames(names = [], transaction) {
    if (!names.length) return [];
    return this.model.findAll({
      where: { makerName: { [Op.in]: names } },
      raw: true,
      transaction,
    });
  }
  
  async findAllByIds(ids = [], { transaction } = {}) {
    if (!ids?.length) return [];
    return this.model.findAll({
      where: { makerId: { [Op.in]: ids } },
      raw: true,
      transaction,
    });
  }
}

module.exports = new MakerRepository();
