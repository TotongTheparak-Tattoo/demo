const dbConfig = require("../config/db.config.js");
const process = require("process");
const dotenv = require("dotenv");

const envFile = `.env.${process.env.NODE_ENV}`.trim();
dotenv.config({ path: envFile });

//connect db
const Sequelize = require("sequelize");
const sequelize = new Sequelize(
  process.env.DB_DATABASE,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: dbConfig.dialect,
    dialectOptions: dbConfig.dialectOptions,
    timezone: "+07:00"
  }
);

//initial db config
const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

//create table
// db.apiPath = require("./apiPath.model.js")(sequelize, Sequelize);
// db.as400TransactionLog = require("./as400TransactionLog.model.js")(
//   sequelize,
//   Sequelize
// );

db.level = require("./level.model.js")(sequelize, Sequelize);
db.role = require("./role.model.js")(sequelize, Sequelize);
db.vendorMaster = require("./vendorMaster.model.js")(sequelize, Sequelize);
db.locationZone = require("./locationZone.model.js")(sequelize, Sequelize);
db.productStatus = require('./productStatus.model.js')(sequelize, Sequelize)
db.location = require("./location.model.js")(sequelize, Sequelize);
db.itemList = require("./itemList.model.js")(sequelize, Sequelize)
db.productDetails = require("./productDetails.model.js")(sequelize, Sequelize)
db.mrRequest = require("./mrRequest.model.js")(sequelize, Sequelize);
db.mrRequestLog = require("./mrRequestLog.model.js")(sequelize, Sequelize);
db.maker = require("./maker.model.js")(sequelize, Sequelize)
db.productBalance = require("./productBalance.model.js")(sequelize, Sequelize)
db.productLog = require("./productLog.model.js")(sequelize, Sequelize)
db.division = require("./division.model.js")(sequelize, Sequelize)
db.monthlyData = require("./monthlyData.model.js")(sequelize, Sequelize)
db.monthlyDataLog = require("./monthlyDataLog.model.js")(sequelize, Sequelize)
db.transactionMovement = require("./transactionMovement.model.js")(sequelize, Sequelize)
db.transactionMovementLog = require("./transactionMovementLog.model.js")(sequelize, Sequelize)


//relationship (belongsToModel, hasManyModel, fk)


dbConfig.CreateAssociationOneToMany(db.location, db.locationZone, "locationZoneId");
dbConfig.CreateAssociationOneToMany(db.productDetails, db.vendorMaster, "vendorMasterId")


dbConfig.CreateAssociationOneToMany(db.productBalance, db.productDetails, "productDetailsId")
dbConfig.CreateAssociationOneToMany(db.productBalance, db.productStatus, "productStatusId")
dbConfig.CreateAssociationOneToMany(db.productBalance, db.location, "locationId")
dbConfig.CreateAssociationOneToMany(db.productBalance, db.mrRequest, "mrRequestId")


dbConfig.CreateAssociationOneToMany(db.productLog, db.productDetails, "productDetailsId")
dbConfig.CreateAssociationOneToMany(db.productLog, db.productStatus, "productStatusId")
dbConfig.CreateAssociationOneToMany(db.productLog, db.location, "locationId")




dbConfig.CreateAssociationOneToMany(db.itemList, db.vendorMaster, "vendorMasterId")
dbConfig.CreateAssociationOneToMany(db.itemList, db.locationZone, "locationZoneId")
dbConfig.CreateAssociationOneToMany(db.itemList, db.maker, "makerId")


dbConfig.CreateAssociationOneToMany(db.mrRequest, db.vendorMaster, "vendorMasterId")

dbConfig.CreateAssociationOneToMany(db.mrRequestLog, db.productStatus, "productStatusId")
dbConfig.CreateAssociationOneToMany(db.mrRequestLog, db.location, "locationId")
dbConfig.CreateAssociationOneToMany(db.mrRequestLog, db.vendorMaster, "vendorMasterId")



module.exports = db;
