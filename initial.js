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
    console.log("Synced db.");
  } catch (err) {
    console.error("Failed to sync db:", err);
    console.error("Error stack:", err.stack);
  }
};

module.exports = initDB;
