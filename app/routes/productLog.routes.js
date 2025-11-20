const controller = require("../controllers/productLog.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
    app.get(
        //status not must productlog 4
        "/api/v1/productlog/getdata",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getAllProductLog
    );
};