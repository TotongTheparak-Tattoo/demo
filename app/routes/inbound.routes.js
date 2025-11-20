const InboundController = require("../controllers/inbound.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
  app.get(
    "/api/v1/inbound/receive/get_material_receive_list_by_vendor",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    InboundController.getMaterialReceiveListByVendor
  );
  app.get(
    //statusmust productbalance 1
    "/api/v1/inbound/reprint/get_material_receive_reprint_list_by_vendor",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    InboundController.getMaterialReceiveReprintListByVendor
  );
  app.post(
    "/api/v1/inbound/receive/submit_print_receive",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    InboundController.doInboundReceivePrint
  );
  app.get(
    //statusmust productbalance 1
    "/api/v1/inbound/putaway/get_putaway_list",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    InboundController.getPalletNoteList
  );
  app.post(
    "/api/v1/inbound/putaway/submit_update_putaway",
    JWT.verifyToken,
    JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
    InboundController.submitUpdatePutaway
  );
};
