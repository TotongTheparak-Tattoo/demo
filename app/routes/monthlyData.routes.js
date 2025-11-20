const controller = require("../controllers/monthlyData.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
  app.get(
    "/api/v1/monthlydata/getdata",
    JWT.verifyToken,
    JWT.isWarehouseStaffAndAdmin,
    controller.getAllMonthlyData
  );
  
  app.post(
    "/api/v1/monthlydata/update",
    JWT.verifyToken,
    JWT.isWarehouseStaffAndAdmin,
    controller.updateMonthlyData
  );
};
