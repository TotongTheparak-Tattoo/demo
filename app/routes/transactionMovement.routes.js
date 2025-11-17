const controller = require("../controllers/transactionMovement.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
  app.get(
    "/api/v1/transactionmovement/getdata",
    JWT.verifyToken,
    JWT.isWarehouseStaffAndAdmin,
    controller.getAllTransactionMovement
  );
  
  app.get(
    "/api/v1/transactionmovement/getdataonly",
    JWT.verifyToken,
    JWT.isWarehouseStaffAndAdmin,
    controller.getTransactionMovementOnly
  );
  
  app.get(
    "/api/transaction-movement/balance-report",
    JWT.verifyToken,
    JWT.isWarehouseStaffAndAdmin,
    controller.getBalanceReport
  );
  
  app.post(
    "/api/v1/transactionmovement/update",
    JWT.verifyToken,
    JWT.isWarehouseStaffAndAdmin,
    controller.updateTransactionMovement
  );
};
