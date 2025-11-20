const controller = require("../controllers/mrRequestLog.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
    app.get(
        "/api/v1/mrrequestlog/getdata",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getAllMrRequestLog
    );

    app.get(
        "/api/v1/card/summary_stock_card_report",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getAllVendorReportsV2
    );

    app.get(
        "/api/v1/stock/movement",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getAllProductLogStatusPutaway
    );

    app.get(
        "/api/v1/billing/calculate",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.calculateBilling
    );
};