const MasterUploadController = require("../controllers/masterUpload.controller");

module.exports = function (app) {
  app.post(
    "/api/master/upload-monthly",
    MasterUploadController.uploadMonthly
  );

  app.post(
    "/api/master/upload-transaction-movement",
    MasterUploadController.uploadTransactionMovement
  );
};


