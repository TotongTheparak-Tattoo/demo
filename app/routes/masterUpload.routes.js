const MasterUploadController = require("../controllers/masterUpload.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
  app.post(
    "/api/master/upload-monthly",
    JWT.verifyToken,
    JWT.isWarehouseStaffAndAdmin,
    MasterUploadController.uploadMonthly
  );

  app.post(
    "/api/master/upload-transaction-movement",
    JWT.verifyToken,
    JWT.isWarehouseStaffAndAdmin,
    MasterUploadController.uploadTransactionMovement
  );
};


