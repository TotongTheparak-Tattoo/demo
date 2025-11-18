const controller = require("../controllers/monthlyDataLog.controller");

module.exports = function (app) {
  app.get(
    "/api/v1/monthlydatalog/getdata",
    controller.list
  );
};


