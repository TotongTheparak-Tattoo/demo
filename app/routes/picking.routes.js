const PickingController = require("../controllers/picking.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
    app.post(
        "/api/v1/requestpicking/uploadcsv",
        JWT.verifyToken,
        JWT.isWarehouseStaffAndAdmin,
        PickingController.uploadtoMrRequest
    );
};
