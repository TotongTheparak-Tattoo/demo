const ItemListController = require("../controllers/itemList.controller");

module.exports = function (app) {
  app.post(
    "/api/v1/itemlist/upload",
    ItemListController.uploadItemList
  );

  app.get(
    "/api/v1/itemlist/getall",
    ItemListController.getAllItemList
  );

  app.get(
    "/api/v1/itemlist/unmatched-products",
    ItemListController.getUnmatchedProductDetails
  );
};
