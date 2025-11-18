const VoidProcessController = require("../controllers/voidprocess.controller");

module.exports = function (app) {
  app.get(
    //statusmust productbalance 1,2
    "/api/v1/scanvoid/getdataallbymrnull",
    VoidProcessController.getAllByMrisNull
  );
  app.get(
    "/api/v1/voidprocess/getdatavendor",
    VoidProcessController.vendorOptions
  );
};
