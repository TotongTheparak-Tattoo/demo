const uploadController = require("../controllers/upload.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
  app.post(
    "/api/v1/upload/upload_product",
    JWT.verifyToken,
    JWT.isWarehouseStaffAndAdmin,
    uploadController.uploadToProduct
  );
};
