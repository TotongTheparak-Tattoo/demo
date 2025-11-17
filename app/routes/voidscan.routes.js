const voidScanController = require("../controllers/voidscan.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
  app.delete(
    "/api/v1/scanvoid/deletedatabypalletno/:palletNo",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    voidScanController.deleteByPalletNo
  );
};
