const db = require("./app/models");
const VendorMaster = db.vendorMaster;
const ProductStatus = db.productStatus;
const LocationZone = db.locationZone;
const Division = db.division;
const Role = db.role;
const Level = db.level;
const Maker = db.maker;

const initDB = async () => {
  try {
    // Force: true will drop the table if it already exists

    if (process.env.NODE_ENV.trim() === "test") {
      console.log("Running in Test Mode");
      await db.sequelize.sync({ force: false });
    } else {
      await db.sequelize.sync({ force: false });
    }

    await initialDataForTest();
    console.log("Synced db.");
  } catch (err) {
    console.log("Failed to sync db: " + err);
  }
};

const initialDataForTest = async () => {
  // Roles
  const count_vendor = await VendorMaster.count();
  if (count_vendor === 0) {
    VendorMaster.create({
      vendorMasterId: 1,
      vendorMasterCode: '2000528',
      vendorMasterName: 'TOYOTA TSUSHO (THAILAND) CO.,LTD.',
      maker: 'Kobe Steel',
    })
    VendorMaster.create({
      vendorMasterId: 2,
      vendorMasterCode: '2000196',
      vendorMasterName: 'UMETOKU THAILAND CO.,LTD.',
      maker: 'Proterial',
    })
    VendorMaster.create({
      vendorMasterId: 3,
      vendorMasterCode: '1990571',
      vendorMasterName: 'KEIAISHA CO.,LTD.',
      maker: 'Nippon Koshuha',
    })
    VendorMaster.create({
      vendorMasterId: 4,
      vendorMasterCode: '2060496',
      vendorMasterName: 'NIPPON STEEL TRADING (THAILAND) CO.,LTD.',
      maker: 'Megasus',
    })

    LocationZone.create({
      locationZoneId: 1,
      zone: 'B',
      type: 'pcs',
    })
    LocationZone.create({
      locationZoneId: 2,
      zone: 'C',
      type: 'coil',
    })

    Division.create({
      divisionId: 1,
      divisionName: 'MIC',
    })
    Division.create({
      divisionId: 2,
      divisionName: 'Toyota Tsusho',
    })
    Division.create({
      divisionId: 3,
      divisionName: 'Umetoku',
    })
    Division.create({
      divisionId: 4,
      divisionName: 'KI',
    })

    Role.create({
      roleId: 1,
      roleName: 'warehouse'
    })
   
    Level.create({
      levelId : 1,
      levelName : 'admin'
    })
    Level.create({
      levelId : 2,
      levelName : 'staff'
    })
    Level.create({
      levelId : 3,
      levelName : 'operator'
    })

    Maker.create({
      makerId: 1,
      makerName: 'Proterial',
    })
    Maker.create({
      makerId: 2,
      makerName: 'Nippon Koshuha',
    })
    Maker.create({
      makerId: 3,
      makerName: 'Fuji Shaft',
    })
    Maker.create({
      makerId: 4,
      makerName: 'Fujikoshi',
    })
    Maker.create({
      makerId: 5,
      makerName: 'Megasus',
    })
    Maker.create({
      makerId: 6,
      makerName: 'Sanyu',
    })
    Maker.create({
      makerId: 7,
      makerName: 'Numazu',
    })
    Maker.create({
      makerId: 8,
      makerName: 'Kobe Steel',
    })

    ProductStatus.create({
      productStatusId: 1,
      productStatusName: 'receive',
    })
    ProductStatus.create({
      productStatusId: 2,
      productStatusName: 'put away',
    })
    ProductStatus.create({
      productStatusId: 3,
      productStatusName: 'picking',
    })
    ProductStatus.create({
      productStatusId: 4,
      productStatusName: 'pre information',
    })
    ProductStatus.create({
      productStatusId: 5,
      productStatusName: 'loading',
    })
    ProductStatus.create({
      productStatusId: 6,
      productStatusName: 'void',
    })
    ProductStatus.create({
      productStatusId: 7,
      productStatusName: 'change location',
    })
    ProductStatus.create({
      productStatusId: 8,
      productStatusName: 'return',
    })
    ProductStatus.create({
      productStatusId: 9,
      productStatusName: 'export',
    })
  }
  
};

module.exports = initDB;
