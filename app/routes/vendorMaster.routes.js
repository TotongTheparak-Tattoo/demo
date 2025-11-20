const VendorMasterController = require("../controllers/vendorMaster.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
  app.get(
    "/api/v1/vendorMaster/get_all_vendorMaster",
    VendorMasterController.getAllVendorMaster
  );
  app.get(
    "/api/v1/vendor/getmaker",
    JWT.verifyToken,
    JWT.isAdmin,
    VendorMasterController.getMaker
  );
  app.post(
    "/api/v1/vendor/create",
    JWT.verifyToken,
    JWT.isAdmin,
    VendorMasterController.insertVendorMaster
  );
};
