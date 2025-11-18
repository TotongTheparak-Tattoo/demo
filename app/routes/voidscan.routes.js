const voidScanController = require("../controllers/voidscan.controller");

module.exports = function (app) {
  app.delete(
    "/api/v1/scanvoid/deletedatabypalletno/:palletNo",
    voidScanController.deleteByPalletNo
  );
};
