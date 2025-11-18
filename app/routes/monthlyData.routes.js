const controller = require("../controllers/monthlyData.controller");

module.exports = function (app) {
  app.get(
    "/api/v1/monthlydata/getdata",
    controller.getAllMonthlyData
  );
  
  app.post(
    "/api/v1/monthlydata/update",
    controller.updateMonthlyData
  );
};
