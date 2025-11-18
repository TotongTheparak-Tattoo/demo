const VendorMasterController = require("../controllers/vendorMaster.controller");

module.exports = function (app) {
  app.get(
    "/api/v1/vendorMaster/get_all_vendorMaster",
    VendorMasterController.getAllVendorMaster
  );
  app.get(
    "/api/v1/vendor/getmaker",
    VendorMasterController.getMaker
  );
  app.post(
    "/api/v1/vendor/create",
    VendorMasterController.insertVendorMaster
  );
};
