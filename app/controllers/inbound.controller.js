const InboundDataCleaner = require("../middlewares/dataCleaner").Inbound;
const InboundService = require("../services/inbound.service");
const LocationService = require("../services/location.service");
const ItemListService = require("../services/itemList.service");
const InboundValidator = require("../validators/inbound.validator");
const Queue = require("../middlewares/queue");
class InboundController {
  async getMaterialReceiveListByVendor(req, res) {
    try {
      const { vendorId } = req.query; 
      let getData = await InboundService.getDataPreInformationByVendorId( vendorId );
      if (!getData || getData.length === 0) {
        return res.status(200).json({result: [] });
      }

      return res.status(200).json({ result: getData });
    } catch (error) {
      return res.status(500).json({ result: error });
    }
  }
  async getMaterialReceiveReprintListByVendor(req, res) {
    try {
      const { vendorId } = req.query;
      let getData = await InboundService.getDataPreInformationByVendorIdForReprint( vendorId );
      if (!getData || getData.length === 0) {
        return res.status(404).json({
          result: {
            message: "No data found this Vendor ",
          },
        });
      }

      return res.status(200).json({ result: getData });
    } catch (error) {
      return res.status(500).json({ result: error });
    }
  }
  async doInboundReceivePrint(req, res) {
    try {
      const {
        vendorId,
        dataSelect,
        selectUnit,
        selectLocation,
        assignLocationMethod,
      } = req.body;
      let result;

      const keysProductDetails = await InboundDataCleaner.getProductDetailKeys(dataSelect); //get key
      const getProductDetailsData = await InboundService.getProductDetailsByKeys(keysProductDetails); //find data in productDetails
      await InboundValidator.checkDataPreinformation(getProductDetailsData); //check valid productDetail
      const matchedData = await ItemListService.findItemList(dataSelect); // match data between input data and TB itemlist -> if matched get itemlistId locationZoneId, subLocation, weight
      await InboundValidator.CheckMatchedItemListData(matchedData);
      await InboundValidator.checkIsReceived(getProductDetailsData, dataSelect);
      switch (assignLocationMethod) {
        case "auto":
          const getAvailableLocation = await LocationService.getAvailableLocations(selectUnit); //find location is empty by selectUnit (input from user)
          await InboundValidator.checkIfEmptyLocationIsEnough(getAvailableLocation);
          switch (selectUnit) {
            case "coil":
                result = await Queue.doProcess("receiveAutoQueueCoil", { getProductDetailsData, matchedData, getAvailableLocation });
              break;
            case "pcs":
                result = await Queue.doProcess("receiveAutoQueuePcs", { getProductDetailsData, matchedData, getAvailableLocation });
              break;
          }
          break;
        case "manual":
          await InboundValidator.checkLocationSelect(selectLocation);
          const getLocationById = await LocationService.getLocationById(selectLocation); //find location is empty by selectUnit (input from user)
          switch (selectUnit) {
            case "coil":
                result = await Queue.doProcess("receiveManualQueueCoil", { getProductDetailsData, matchedData, getLocationById });
              break;
            case "pcs":
              result = await Queue.doProcess("receiveManualQueuePcs", { getProductDetailsData, matchedData, getLocationById });
              break;
          }
          break;

        default:
          break;
      }
           
      let dataPrintPalletNote = null;
      
      if (result && result.result === "ok") {
        dataPrintPalletNote = result.printData;
      }

    if (result.success == true) {
      return res.status(200).json({ 
        result: dataPrintPalletNote,
        message: 'Process completed successfully'
      });
    } else {
      throw result.message
    }
    } catch (error) {
      console.log(error)
      return res.status(500).json({ result: error });
    }
  }
  async getPalletNoteList(req, res) {
    try { 
    const { vendorId } = req.query; 
    let getPutawayListByVendorId =  await InboundService.GetPutAwayList(vendorId);
    if (!getPutawayListByVendorId || getPutawayListByVendorId.length === 0) {
        return res.status(200).json({result: []});
    }
   
    return res.status(200).json({ result: getPutawayListByVendorId });

    } catch (error) {
      console.log(error)
      return res.status(500).json({ result: error });
    }
  }
  async submitUpdatePutaway(req, res) {
    try { 
    const { palletNo, locationCode } = req.body; 
     await InboundService.UpdatePutAwayStatus(palletNo, locationCode);

    return res.status(200).json();

    } catch (error) {
      console.log(error)
      return res.status(500).json({ result: error });
    }
  }
}

module.exports = new InboundController();
