const controller = require("../controllers/monthlyDataLog.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
  app.get(
    "/api/v1/monthlydatalog/getdata",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    controller.list
  );
};


