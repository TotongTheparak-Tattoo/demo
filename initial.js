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
    console.log("Starting database sync...");
    console.log("DB_HOST:", process.env.DB_HOST);
    console.log("DB_DATABASE:", process.env.DB_DATABASE);
    console.log("DB_USERNAME:", process.env.DB_USERNAME);

    const nodeEnv = (process.env.NODE_ENV || "").trim();
    if (nodeEnv === "test") {
      console.log("Running in Test Mode");
      await db.sequelize.sync({ force: false });
    } else {
      await db.sequelize.sync({ force: false });
    }

    console.log("Database sync completed. Starting initial data...");
    await initialDataForTest();
    console.log("Synced db.");
  } catch (err) {
    console.error("Failed to sync db:", err);
    console.error("Error stack:", err.stack);
  }
};

const initialDataForTest = async () => {
  // Roles
  const count_vendor = await VendorMaster.count();
  if (count_vendor === 0) {
    await VendorMaster.create({
      vendorMasterId: 1,
      vendorMasterCode: '2000528',
      vendorMasterName: 'TOYOTA TSUSHO (THAILAND) CO.,LTD.',
      maker: 'Kobe Steel',
    })
    await VendorMaster.create({
      vendorMasterId: 2,
      vendorMasterCode: '2000196',
      vendorMasterName: 'UMETOKU THAILAND CO.,LTD.',
      maker: 'Proterial',
    })
    await VendorMaster.create({
      vendorMasterId: 3,
      vendorMasterCode: '1990571',
      vendorMasterName: 'KEIAISHA CO.,LTD.',
      maker: 'Nippon Koshuha',
    })
    await VendorMaster.create({
      vendorMasterId: 4,
      vendorMasterCode: '2060496',
      vendorMasterName: 'NIPPON STEEL TRADING (THAILAND) CO.,LTD.',
      maker: 'Megasus',
    })

    await LocationZone.create({
      locationZoneId: 1,
      zone: 'B',
      type: 'pcs',
    })
    await LocationZone.create({
      locationZoneId: 2,
      zone: 'C',
      type: 'coil',
    })

    await Division.create({
      divisionId: 1,
      divisionName: 'MIC',
    })
    await Division.create({
      divisionId: 2,
      divisionName: 'Toyota Tsusho',
    })
    await Division.create({
      divisionId: 3,
      divisionName: 'Umetoku',
    })
    await Division.create({
      divisionId: 4,
      divisionName: 'KI',
    })

    await Role.create({
      roleId: 1,
      roleName: 'warehouse'
    })
   
    await Level.create({
      levelId : 1,
      levelName : 'admin'
    })
    await Level.create({
      levelId : 2,
      levelName : 'staff'
    })
    await Level.create({
      levelId : 3,
      levelName : 'operator'
    })

    await Maker.create({
      makerId: 1,
      makerName: 'Proterial',
    })
    await Maker.create({
      makerId: 2,
      makerName: 'Nippon Koshuha',
    })
    await Maker.create({
      makerId: 3,
      makerName: 'Fuji Shaft',
    })
    await Maker.create({
      makerId: 4,
      makerName: 'Fujikoshi',
    })
    await Maker.create({
      makerId: 5,
      makerName: 'Megasus',
    })
    await Maker.create({
      makerId: 6,
      makerName: 'Sanyu',
    })
    await Maker.create({
      makerId: 7,
      makerName: 'Numazu',
    })
    await Maker.create({
      makerId: 8,
      makerName: 'Kobe Steel',
    })

    await ProductStatus.create({
      productStatusId: 1,
      productStatusName: 'receive',
    })
    await ProductStatus.create({
      productStatusId: 2,
      productStatusName: 'put away',
    })
    await ProductStatus.create({
      productStatusId: 3,
      productStatusName: 'picking',
    })
    await ProductStatus.create({
      productStatusId: 4,
      productStatusName: 'pre information',
    })
    await ProductStatus.create({
      productStatusId: 5,
      productStatusName: 'loading',
    })
    await ProductStatus.create({
      productStatusId: 6,
      productStatusName: 'void',
    })
    await ProductStatus.create({
      productStatusId: 7,
      productStatusName: 'change location',
    })
    await ProductStatus.create({
      productStatusId: 8,
      productStatusName: 'return',
    })
    await ProductStatus.create({
      productStatusId: 9,
      productStatusName: 'export',
    })
  }
  
};

module.exports = initDB;
