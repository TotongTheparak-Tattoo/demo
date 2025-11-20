const VoidProcessController = require("../controllers/voidprocess.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
  app.get(
    //statusmust productbalance 1,2
    "/api/v1/scanvoid/getdataallbymrnull",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    VoidProcessController.getAllByMrisNull
  );
  app.get(
    "/api/v1/voidprocess/getdatavendor",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    VoidProcessController.vendorOptions
  );
};
