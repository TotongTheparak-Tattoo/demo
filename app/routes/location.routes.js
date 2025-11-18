const locationController = require("../controllers/location.controller");

module.exports = function (app) {
  app.get(
    //statusmust productbalance 2
    "/api/inventory/getdata",
    locationController.getAllLocation
  );
  app.get(
    "/api/v1/location/manual_assign_location",
    locationController.getLocationForManualLocation
  );
  app.get(
    "/api/v1/location/get_available_location",
    locationController.getAvailableLocation
  );
  app.post(
    "/api/v1/location/insertBulkLocation",
    locationController.insertBulkLocation
  );

};
