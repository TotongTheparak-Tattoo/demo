const PickingController = require("../controllers/picking.controller");

module.exports = function (app) {
    app.post(
        "/api/v1/requestpicking/uploadcsv",
        PickingController.uploadtoMrRequest
    );
};
