const ItemListController = require("../controllers/itemList.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
  app.post(
    "/api/v1/itemlist/upload",
    JWT.verifyToken,
    JWT.isAdmin,
    ItemListController.uploadItemList
  );

  app.get(
    "/api/v1/itemlist/getall",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    ItemListController.getAllItemList
  );

  app.get(
    "/api/v1/itemlist/unmatched-products",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    ItemListController.getUnmatchedProductDetails
  );
};
