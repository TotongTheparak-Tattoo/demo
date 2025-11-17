const { Op } = require("sequelize");
const db = require("../models");
const LocationZone = db.locationZone

const BaseRepository = require("./base.repository");

class LocationZoneRepository extends BaseRepository {
  constructor() {
    super(LocationZone);
  }
  async findByTypeInsensitive(type, { transaction } = {}) {
    const { Sequelize } = db;
    return this.model.findOne({
      where: Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("type")),
        (type ?? "").toString().trim().toLowerCase()
      ),
      raw: true,
      transaction,
    });
  }
  async findById(id, { transaction } = {}) {
    if (id == null) return null;
    const row = await this.model.findByPk(id, { raw: true, transaction });
    return row || null;
  }
  async findByNamesOrCodes(zones = [], transaction) {
    if (!zones.length) return [];
    return this.model.findAll({
      where: { zone: { [Op.in]: zones } },
      raw: true,
      transaction,
    });
  }
  
  async findAllByIds(ids = [], { transaction } = {}) {
    if (!ids?.length) return [];
    return this.model.findAll({
      where: { locationZoneId: { [Op.in]: ids } },
      raw: true,
      transaction,
    });
  }
}

module.exports = new LocationZoneRepository();
