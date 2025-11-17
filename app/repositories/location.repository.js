const db = require("../models");
const Location = db.location;
const LocationZone = db.locationZone;
const ProductBalance = db.productBalance
const ProductStatus = db.productStatus
const BaseRepository = require("./base.repository");

class LocationRepository extends BaseRepository {
  constructor() {
    super(Location); // Pass the model to the base class
  }
  async getLocationForManualLocation(division_id) {
    return await db.location.findAll({
      attributes: ['locationId', 'locationCode'],
      include: [{
        model: ProductBalance,
        required: false,
      }],
      where: {
        divisionId: division_id,
        '$ProductBalances.locationId$': null,
      },
      order: [
        ['rack', 'ASC'],
        ['bay', 'ASC'],
        ['shelf', 'ASC'],
        ['subBay', 'ASC']
      ],
      raw: true
    });
  }
  async GetAllLocation() {
    return await Location.findAll({
      include: [{ model: LocationZone, required: true }],
      order: [
        ['rack', 'ASC'],
        ['bay', 'ASC'],
        ['shelf', 'ASC'],
        ['subBay', 'ASC']
      ],
      raw: true
    })
  }
  async GetAllLocationFromUnit(selectUnit) {
    let rackCondition = null;
    switch (selectUnit) {
    case 'coil':
      rackCondition = { [db.Sequelize.Op.like]: 'C%' };
      break;
    case 'pcs':
      rackCondition = { [db.Sequelize.Op.like]: 'B%' };
      break;
    default:
      rackCondition = null;
    } 
    const whereCondition = {};

    if (rackCondition) {
      whereCondition.rack = rackCondition;
    }
    return await Location.findAll({
      include: [{ model: LocationZone, required: true }],
      where: whereCondition,
      order: [
      ['rack', 'ASC'],
      ['bay', 'ASC'],
      ['shelf', 'ASC'],
      ['subBay', 'ASC']
      ],
      raw: true
    })
  }
  async GetReceiveLocation(selectUnit) {
    let rackCondition = null;
    switch (selectUnit) {
    case 'coil':
      rackCondition = { [db.Sequelize.Op.like]: 'C%' };
      break;
    case 'pcs':
      rackCondition = { [db.Sequelize.Op.like]: 'B%' };
      break;
    default:
      rackCondition = null;
    } 
    const whereCondition = {
    '$ProductBalances.productStatusId$': { [db.Sequelize.Op.notIn]: [3] }
    };

    if (rackCondition) {
      whereCondition.rack = rackCondition;
    }
    return await Location.findAll({
      include: [
        { model: ProductBalance, required: true }
      ],
      where: whereCondition,
      order: [
        ['rack', 'ASC'],
        ['bay', 'ASC'],
        ['shelf', 'ASC'],
        ['subBay', 'ASC']
      ],
    })
  }
  //   async GetAllLocationByDivisionId(divisionId) {
  //     return await Location.findAll({
  //       where: { divisionId: divisionId, rack: { [db.Sequelize.Op.like]: '%R%' } },
  //       order: [
  //         ['rackType', 'ASC'],
  //         ['rack', 'ASC'],
  //         ['shelf', 'ASC'],
  //         ['bay', 'ASC']
  //       ],
  //       raw: true
  //     })
  //   }
  //   async FindLocationByCode(locationCode) {
  //     return await Location.findOne({
  //       where: { locationCode: locationCode, rack: { [db.Sequelize.Op.like]: '%R%' }, },
  //       raw: true
  //     })
  //   }
  //   async FindLocationById(locationId) {
  //     return await Location.findOne({
  //       where: { locationId: locationId, rack: { [db.Sequelize.Op.like]: '%R%' }, },
  //       raw: true
  //     })
  //   }
  //  async GetPutawayLocation() {
  //     return await Location.findAll({
  //       include: [
  //         { model: ProductBalance, required: true, include: [{ model: ProductStatus, required: true }] }
  //       ],
  //       where: {
  //         rack: { [db.Sequelize.Op.like]: '%R%' },
  //         '$ProductBalances.ProductStatus.productStatusName$': 'put away'
  //       },
  //       order: [
  //         ['rack', 'ASC'],
  //         ['bay', 'ASC'],
  //         ['shelf', 'ASC']
  //       ],
  //       raw: true
  //     })
  //   }
  async findAll(opts = {}) {
    return this.model.findAll({ raw: true, ...opts });
  }
  async findOne(opts = {}) {
    return this.model.findOne({ raw: true, ...opts });
  }
  async getLocationIdByLocationCode(locationCode, { transaction } = {}) {
    const code = (locationCode ?? "").toString().trim();
    if (!code) return null;

    const codeUpper = code.toUpperCase();
    try {
      const { Sequelize } = db;
      const row = await this.model.findOne({
        where: Sequelize.where(
          Sequelize.fn("UPPER", Sequelize.col("locationCode")),
          codeUpper
        ),
        raw: true,
        transaction,
      });
      return row || null;
    } catch (err) {
      console.error("[LocationRepository.getLocationIdByLocationCode] error:", err);
      throw err;
    }
  }
  async findAllByIds(ids, { attributes = ["locationId", "locationCode"], raw = true, transaction } = {}) {
    if (!ids?.length) return [];
    return this.model.findAll({
      where: { locationId: { [db.Sequelize.Op.in]: ids } },
      attributes,
      raw,
      transaction,
    });
  }
  async findByZoneAndCode(locationZoneId, locationCode, { transaction } = {}) {
    const { Sequelize } = db;
    const codeUpper = (locationCode ?? "").toString().trim().toUpperCase();
    return this.model.findOne({
      where: {
        locationZoneId,
        [db.Sequelize.Op.and]: [
          Sequelize.where(
            Sequelize.fn("UPPER", Sequelize.col("locationCode")),
            codeUpper
          ),
        ],
      },
      raw: true,
      transaction,
    });
  }
  async InsertBulkLocation(data) {
    return await Location.bulkCreate(data);

    // try {
    //   const datda =  await ItemList.bulkCreate(data, {
    //     validate: true,
    //     fields: ['itemListId', 'spec', 'dia', 'length', 'size', 'l', 'w', 'h','weight', 'subLocation', 'vendorMasterId', 'locationZoneId', 'makerId'], // ระบุ fields ที่ต้องการ insert
    //   });
    //   return datda
    // } catch (error) {
    //   if (error.name === 'SequelizeDatabaseError') {
    //     console.error('Database Error:', error.parent.message);
    //     // จัดการ error เฉพาะ
    //   } else if (error.name === 'SequelizeValidationError') {
    //     console.error('Validation Error:', error.errors);
    //   } else {
    //     console.error('Unknown Error:', error);
    //   }
    // }
  }
  async findLocationById(locationId) {
    return await Location.findOne({
      where: {locationId : locationId},
      raw: true
    })
  }
  async FindLocationByCode(locationCode) {
    return await Location.findOne({
      where: { locationCode: locationCode },
      raw: true
    })
  }
}

module.exports = new LocationRepository();
