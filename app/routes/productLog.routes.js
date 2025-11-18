const controller = require("../controllers/productLog.controller");

module.exports = function (app) {
    app.get(
        //status not must productlog 4
        "/api/v1/productlog/getdata",
        controller.getAllProductLog
    );
};