// repositories/itemList.repository.js
const db = require("../models");
const ItemList = db.itemList
const { Op } = require("sequelize");

class ItemListRepository {
  constructor(model) {
    this.model = model;
  }
  async findAllItemList() {
    return await ItemList.findAll({
      raw: true,
    });
  }
  async findExistingCompositeBatch(batch = [], transaction) {
    if (!batch.length) return [];
    const orConds = batch.map((r) => ({
      spec: r.spec,
      dia: r.dia,
      length: r.length,
      size: r.size,
      l: r.l,
      w: r.w,
      h: r.h,
      subLocation: r.subLocation,
      weight: r.weight,
      vendorMasterId: r.vendorMasterId,
      locationZoneId: r.locationZoneId,
      makerId: r.makerId,
    }));

    return this.model.findAll({
      where: { [Op.or]: orConds },
      raw: true,
      transaction,
    });
  }

  async bulkCreate(records = [], transaction) {
    if (!records.length) return [];
    return this.model.bulkCreate(records, { transaction });
  }
}

module.exports = new ItemListRepository(ItemList);
