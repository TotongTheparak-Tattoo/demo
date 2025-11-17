// repositories/productStatus.repository.js
const db = require("../models");
const { Op } = db.Sequelize;
const BaseRepository = require("./base.repository");

const ProductStatus = db.productStatus;

class ProductStatusRepository extends BaseRepository {
  constructor() {
    super(ProductStatus);
    this.model = ProductStatus;
  }
  async findAll(opts = {}) {
    return this.model.findAll({ raw: true, ...opts });
  }
  async findAllByIds(ids = [], { raw = true } = {}) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    return this.model.findAll({
      where: { productStatusId: { [Op.in]: ids } },
      raw,
    });
  }
}

module.exports = new ProductStatusRepository();
