const controller = require("../controllers/transactionMovement.controller");

module.exports = function (app) {
  app.get(
    "/api/v1/transactionmovement/getdata",
    controller.getAllTransactionMovement
  );
  
  app.get(
    "/api/v1/transactionmovement/getdataonly",
    controller.getTransactionMovementOnly
  );
  
  app.get(
    "/api/transaction-movement/balance-report",
    controller.getBalanceReport
  );
  
  app.post(
    "/api/v1/transactionmovement/update",
    controller.updateTransactionMovement
  );
};
