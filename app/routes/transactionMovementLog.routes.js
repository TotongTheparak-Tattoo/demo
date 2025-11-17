const controller = require("../controllers/transactionMovementLog.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
  app.get(
    "/api/v1/transactionmovementlog/getdata",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    controller.getAllTransactionMovementLog
  );
};
