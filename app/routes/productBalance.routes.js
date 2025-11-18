// routes/productBalance.routes.js
const controller = require("../controllers/productBalance.controller");

module.exports = function (app) {
    app.get(
        //mrId in productBalance must pair
        "/api/v1/scanpicking/getdata",
        controller.getAllByPB
    );

    app.delete(
        "/api/v1/picking/deletadatabypalletno/:palletNo",
        controller.deleteByPalletNo
    );
    //mrId in productBalance must pair
    app.get(
        "/api/v1/voidmr/getdataallbymrnotnull",
        controller.getAllByMrIdNotNull
    );

    app.patch(
        "/api/v1/voidmr/updatedatabyid/:id",
        controller.clearMrRequest
    );
    app.get(
        "/api/v1/movelocation/getdatabypallet/:palletNo",
        controller.getByPallet
    );
    app.get(
        "/api/v1/movelocation/getdatabylocationcode/:code",
        controller.getReceiveLocation
    );
    app.post(
        "/api/v1/movelocation/updatelocation/bulk",
        controller.moveLocationBulk
    );
    app.get(
        "/api/inventory/getalllocationbyproductbalance",
        controller.getAllLocationByProductBance
    );

    app.get(
        "/api/v1/productdetails/master-invoices",
        controller.getMasterInvoiceNos
    );

    app.get(
        "/api/v1/mrrequest/partial-invoices",
        controller.getPartialInvoices
    );

    app.patch(
        "/api/v1/productdetails/import-entry",
        controller.updateImportEntryNoByMaster
    );

    app.patch(
        "/api/v1/mrrequest/export-entry",
        controller.updateExportEntryNoByPartialInvoice
    );

    app.get(
        "/api/v1/productbalance/getbystatus4",
        controller.getProductDetailsByStatus4
    );

    app.delete(
        "/api/v1/productbalance/deletebyproductdetailsid/:productDetailsId",
        controller.deleteByProductDetailsId
    );
};