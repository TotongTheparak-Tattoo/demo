const controller = require("../controllers/transactionMovementLog.controller");

module.exports = function (app) {
  app.get(
    "/api/v1/transactionmovementlog/getdata",
    controller.getAllTransactionMovementLog
  );
};
