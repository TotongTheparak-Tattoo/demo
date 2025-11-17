// routes/productBalance.routes.js
const controller = require("../controllers/productBalance.controller");
const JWT = require("../middlewares/jwt");

module.exports = function (app) {
    app.get(
        //mrId in productBalance must pair
        "/api/v1/scanpicking/getdata",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getAllByPB
    );

    app.delete(
        "/api/v1/picking/deletadatabypalletno/:palletNo",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.deleteByPalletNo
    );
    //mrId in productBalance must pair
    app.get(
        "/api/v1/voidmr/getdataallbymrnotnull",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getAllByMrIdNotNull
    );

    app.patch(
        "/api/v1/voidmr/updatedatabyid/:id",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.clearMrRequest
    );
    app.get(
        "/api/v1/movelocation/getdatabypallet/:palletNo",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getByPallet
    );
    app.get(
        "/api/v1/movelocation/getdatabylocationcode/:code",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getReceiveLocation
    );
    app.post(
        "/api/v1/movelocation/updatelocation/bulk",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.moveLocationBulk
    );
    app.get(
        "/api/inventory/getalllocationbyproductbalance",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getAllLocationByProductBance
    );

    app.get(
        "/api/v1/productdetails/master-invoices",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getMasterInvoiceNos
    );

    app.get(
        "/api/v1/mrrequest/partial-invoices",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getPartialInvoices
    );

    app.patch(
        "/api/v1/productdetails/import-entry",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.updateImportEntryNoByMaster
    );

    app.patch(
        "/api/v1/mrrequest/export-entry",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.updateExportEntryNoByPartialInvoice
    );

    app.get(
        "/api/v1/productbalance/getbystatus4",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.getProductDetailsByStatus4
    );

    app.delete(
        "/api/v1/productbalance/deletebyproductdetailsid/:productDetailsId",
        JWT.verifyToken,
        JWT.isWarehouseOperatorAndProductionOperatorAndStaffAndAdmin,
        controller.deleteByProductDetailsId
    );
};