const controller = require("../controllers/mrRequestLog.controller");

module.exports = function (app) {
    app.get(
        "/api/v1/mrrequestlog/getdata",
        controller.getAllMrRequestLog
    );

    app.get(
        "/api/v1/card/summary_stock_card_report",
        controller.getAllVendorReportsV2
    );

    app.get(
        "/api/v1/stock/movement",
        controller.getAllProductLogStatusPutaway
    );

    app.get(
        "/api/v1/billing/calculate",
        controller.calculateBilling
    );
};