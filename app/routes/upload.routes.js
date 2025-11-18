const uploadController = require("../controllers/upload.controller");

module.exports = function (app) {
  app.post(
    "/api/v1/upload/upload_product",
    uploadController.uploadToProduct
  );
};
