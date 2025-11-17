const ProductDetailsRepository = require("../repositories/productDetails.repository");
const ProductBalanceRepository = require("../repositories/productBalance.repository");
const ProductLogRepository = require("../repositories/productLog.repository");
const LocationRepository = require("../repositories/location.repository")
const { sequelize } = require("../models");
const InboundDataCleaner = require("../middlewares/dataCleaner").Inbound;

class InboundService {
  async getDataPreInformationByVendorId(vendorId) {
    try {
      return await ProductBalanceRepository.getDataPreInformationByVendorId(
        vendorId
      );
    } catch (error) {
      throw `${error}`;
    }
  }
  async getDataPreInformationByVendorIdForReprint(vendorId) {
    try {
      return await ProductBalanceRepository.getDataPreInformationByVendorIdForReprint(
        vendorId
      );
    } catch (error) {
      throw `${error}`;
    }
  }
  async getProductDetailsByKeys(keys, selectUnit) {
    try {
      let productDetailsByKeys = await ProductDetailsRepository.getProductDetailsByKeys(keys, selectUnit);
      return productDetailsByKeys;
    } catch (error) {
      throw `${error}`;
    }
  }

  async doInboundReceiveCoilAuto(productDetailsData, matchedData, availableLocation) {
    let transaction;
    transaction = await sequelize.transaction();
    try {
      let preData = productDetailsData;
      let mfgDate = await InboundDataCleaner.getMfgDate();
      
      //find pallet no
      let getLatestPalletNo = await ProductLogRepository.GetLatestProductLog();
      if (getLatestPalletNo == null) {
        getLatestPalletNo = 1;
      } else {
        getLatestPalletNo = getLatestPalletNo.palletNo + 1;
      }

      const conditionsWeight = (grossWeight, shelf) => {
        if (grossWeight <= 1000) {
          return shelf >= 4 && shelf <= 5; // shelf 4, 5
        } else if (grossWeight > 1000 && grossWeight <= 2000) {
          return shelf >= 1 && shelf <= 3; // shelf 1, 2, 3
        }
        return false;
      };

      const result = [];
      const usedLocationId = new Set();

      const findLocation = (item) => {
        return availableLocation.find((location) => {
          if (usedLocationId.has(location.locationId)) return false;
          const subLocationMatch = location.subLocation === item.subLocation;
          const weightEnough = item.grossWeight <= location.weight;
          const shelfForUse = conditionsWeight(item.grossWeight, location.shelf);
          return subLocationMatch && weightEnough && shelfForUse;
        });
      };
      console.log(matchedData)
      matchedData.forEach((item) => {
        const findLocations = findLocation(item);
        if (findLocations) {
          result.push({
            vendor: item.vendor,
            masterInvoiceNo: item.masterInvoiceNo,
            quantity: item.quantity,
            width: item.width,
            caseNo: item.caseNo,
            lotNo: item.lotNo,
            spec: item.spec,
            size: item.size,
            grossWeight: item.grossWeight,
            itemListId: item.itemListId,
            itemSubLocation: item.subLocation,
            locationId: findLocations.locationId,
            locationCode: findLocations.locationCode,
            locationSubLocation: findLocations.subLocation,
            locationWeight: findLocations.weight,
            locationZoneId: findLocations["LocationZone.locationZoneId"],
            zone: findLocations["LocationZone.zone"],
          });
          usedLocationId.add(findLocations.locationId);
        }
      });
      const locationMap = new Map();
      for (const loc of result) {
        const key = `${loc.caseNo}|${loc.spec}|${loc.size}`;
          if (!locationMap.has(key)) {
            locationMap.set(key, {
              locationId: loc.locationId,
              palletNo: getLatestPalletNo,
            });
            getLatestPalletNo++;
          }
      }

      for (const preInfo of preData) {
        const key = `${preInfo.caseNo}|${preInfo.spec}|${preInfo.size}`;
        const group = locationMap.get(key);
        if (group) {
          await ProductBalanceRepository.UpdateProductBalanceTransaction(
            {
              productDetailsId: preInfo.productDetailsId,
              palletNo: group.palletNo,
              mfgDate: mfgDate,
              productStatusId: 1,
              locationId: group.locationId
            },
            transaction
          );

          await ProductLogRepository.InsertProductLogTransaction(
            {
              productDetailsId: preInfo.productDetailsId,
              palletNo: group.palletNo,
              productStatusId: 1,
              locationId: group.locationId,
            },
            transaction
          );
        }
      }
      
      await transaction.commit();
      return "ok"
    } catch (error) {
      console.log(error);
      if (transaction) {
        await transaction.rollback();
      }
      throw "Can not reserve location";
    }
  }
  async doInboundReceivePcsAuto(productDetailsData, matchedData, availableLocation) {
    let transaction;
    transaction = await sequelize.transaction();
    try {
      let preData = productDetailsData;
      let mfgDate = await InboundDataCleaner.getMfgDate();

      //find pallet no
      let getLatestPalletNo = await ProductLogRepository.GetLatestProductLog();
      if (getLatestPalletNo == null) {
        getLatestPalletNo = 1;
      } else {
        getLatestPalletNo = getLatestPalletNo.palletNo + 1;
      }

      const conditionsWeight = (grossWeight, shelf) => {
        if (grossWeight <= 500) {
          return shelf >= 5 && shelf <= 8; // shelf 5, 6, 7, 8
        } else if (grossWeight > 500 && grossWeight <= 2000) {
          return shelf >= 1 && shelf <= 4; // shelf 1, 2, 3, 4
        } 
        return false;
      };

      const result = [];
      const usedLocationId = new Set();
      const findLocation = (item) => {
        return availableLocation.find((location) => {
          if (usedLocationId.has(location.locationId)) return false;
          const subLocationMatch = location.subLocation === item.subLocation;
          const weightEnough = item.grossWeight <= location.weight;
          const shelfForUse = conditionsWeight(item.grossWeight, location.shelf);

          return subLocationMatch && weightEnough && shelfForUse;
        });
      };

      matchedData.forEach((item) => {
        const findLocations = findLocation(item);
        if (findLocations) {
          result.push({
            itemListId: item.itemListId,
            caseNo: item.caseNo,
            lotNo: item.lotNo,
            spec: item.spec,
            size: item.size,
            grossWeight: item.grossWeight,
            itemSubLocation: item.subLocation,
            locationId: findLocations.locationId,
            locationCode: findLocations.locationCode,
            locationSubLocation: findLocations.subLocation,
            locationWeight: findLocations.weight,
            locationZoneId: findLocations["LocationZone.locationZoneId"],
            zone: findLocations["LocationZone.zone"],
          });
          usedLocationId.add(findLocations.locationId);
        }
      });

      const locationMap = new Map();
      for (const loc of result) {
        const key = `${loc.caseNo}|${loc.spec}|${loc.size}`;
          if (!locationMap.has(key)) {
            locationMap.set(key, {
              locationId: loc.locationId,
              palletNo: getLatestPalletNo,
            });
            getLatestPalletNo++;
          }
      }

      for (const preInfo of preData) {
        const key = `${preInfo.caseNo}|${preInfo.spec}|${preInfo.size}`;
        const group = locationMap.get(key);
        if (group) {
          await ProductBalanceRepository.UpdateProductBalanceTransaction(
            {
              productDetailsId: preInfo.productDetailsId,
              palletNo: group.palletNo,
              mfgDate: mfgDate,
              productStatusId: 1,
              locationId: group.locationId
            },
            transaction
          );

          await ProductLogRepository.InsertProductLogTransaction(
            {
              productDetailsId: preInfo.productDetailsId,
              palletNo: group.palletNo,
              productStatusId: 1,
              locationId: group.locationId
            },
            transaction
          );
        }
      }

      await transaction.commit();
      return "ok"
    } catch (error) {
      console.log(error);
      if (transaction) {
        await transaction.rollback();
      }
      throw "Can not reserve location";
    }
  }
  async doInboundReceiveManualCoil(productDetailsData, matchedData, availableLocation) {
    let transaction;
     transaction = await sequelize.transaction();
    try {
      let preData = productDetailsData;
      let mfgDate = await InboundDataCleaner.getMfgDate();
      if (!Array.isArray(availableLocation)) {
        availableLocation = [availableLocation];
      }

      //find pallet no
      let getLatestPalletNo = await ProductLogRepository.GetLatestProductLog();
      if (getLatestPalletNo == null) {
        getLatestPalletNo = 1;
      } else {
        getLatestPalletNo = getLatestPalletNo.palletNo + 1;
      }
     
      const conditionsWeight = (grossWeight, shelf) => {
        if (grossWeight <= 1000) {
          return shelf >= 4 && shelf <= 5; // shelf 4, 5
        } else if (grossWeight > 1000 && grossWeight <= 2000) {
          return shelf >= 1 && shelf <= 3; // shelf 1, 2, 3
        }
        return false; 
      };
      //validation 
      for (const item of matchedData) {
          const canPlace = availableLocation.some(location => {
          const subLocationMatch = location.subLocation === item.subLocation;
          const weightEnough = item.grossWeight <= location.weight;
          const shelfForUse = conditionsWeight(item.grossWeight, location.shelf);
          return subLocationMatch && weightEnough && shelfForUse;
        });

        if (!canPlace) {
          throw `Cannot place in the selected location. Please choose a new location.`;
        }
      }
      

      const result = [];
      const usedLocationId = new Set();
      //assign data
      const findLocation = (item) => {
        return availableLocation.find((location) => {
          if (usedLocationId.has(location.locationId)) return false;
          const subLocationMatch = location.subLocation === item.subLocation;
          const weightEnough = item.grossWeight <= location.weight;
          const shelfForUse = conditionsWeight(item.grossWeight, location.shelf);
          return subLocationMatch && weightEnough && shelfForUse;
        });
      };

      matchedData.forEach((item) => {
        const findLocations = findLocation(item);
        if (findLocations) {
          result.push({
            itemListId: item.itemListId,
            caseNo: item.caseNo,
            lotNo: item.lotNo,
            spec: item.spec,
            size: item.size,
            grossWeight: item.grossWeight,
            itemSubLocation: item.subLocation,
            locationId: findLocations.locationId,
            locationCode: findLocations.locationCode,
            locationSubLocation: findLocations.subLocation,
            locationWeight: findLocations.weight,
            locationZoneId: findLocations["LocationZone.locationZoneId"],
            zone: findLocations["LocationZone.zone"],
          });
          usedLocationId.add(findLocations.locationId);
        }
      });
      const locationMap = new Map();
      for (const loc of result) {
        const key = `${loc.caseNo}|${loc.spec}|${loc.size}`;
          if (!locationMap.has(key)) {
            locationMap.set(key, {
              locationId: loc.locationId,
              palletNo: getLatestPalletNo,
            });
            getLatestPalletNo++;
          }
      }
      
      for (const preInfo of preData) {
        const key = `${preInfo.caseNo}|${preInfo.spec}|${preInfo.size}`;
        const group = locationMap.get(key);
        if (group) {
          await ProductBalanceRepository.UpdateProductBalanceTransaction(
            {
              productDetailsId: preInfo.productDetailsId,
              palletNo: group.palletNo,
              mfgDate: mfgDate,
              productStatusId: 1,
              locationId: group.locationId
            },
            transaction
          );

          await ProductLogRepository.InsertProductLogTransaction(
            {
              productDetailsId: preInfo.productDetailsId,
              palletNo: group.palletNo,
              productStatusId: 1,
              locationId: group.locationId,
            },
            transaction
          );
        }
      }

      await transaction.commit();
      return "ok"
    } catch (error) {
      await transaction.rollback();
      throw "Can not reserve location";
    }
  }
  async doInboundReceiveManualPcs(productDetailsData, matchedData, availableLocation) {
    let transaction;
    transaction = await sequelize.transaction();
    try {
      let preData = productDetailsData;
      let mfgDate = await InboundDataCleaner.getMfgDate();
      if (!Array.isArray(availableLocation)) {
        availableLocation = [availableLocation];
      }

      //find pallet no
      let getLatestPalletNo = await ProductLogRepository.GetLatestProductLog();
      if (getLatestPalletNo == null) {
        getLatestPalletNo = 1;
      } else {
        getLatestPalletNo = getLatestPalletNo.palletNo + 1;
      }
     
      const conditionsWeight = (grossWeight, shelf) => {
        if (grossWeight <= 500) {
          return shelf >= 5 && shelf <= 8; // shelf 5, 6, 7, 8
        } else if (grossWeight > 500 && grossWeight <= 2000) {
          return shelf >= 1 && shelf <= 4; // shelf 1, 2, 3, 4
        } 
        return false;
      };

      //validation 
      for (const item of matchedData) {
          const canPlace = availableLocation.some(location => {
          const subLocationMatch = location.subLocation === item.subLocation;
          const weightEnough = item.grossWeight <= location.weight;
          const shelfForUse = conditionsWeight(item.grossWeight, location.shelf);
          return subLocationMatch && weightEnough && shelfForUse;
        });

        if (!canPlace) {
          throw `Cannot place in the selected location. Please choose a new location.`;
        }
      }
     

      const result = [];
      const usedLocationId = new Set();
      //assign data
      const findLocation = (item) => {
        return availableLocation.find((location) => {
          if (usedLocationId.has(location.locationId)) return false;
          const subLocationMatch = location.subLocation === item.subLocation;
          const weightEnough = item.grossWeight <= location.weight;
          const shelfForUse = conditionsWeight(item.grossWeight, location.shelf);
          return subLocationMatch && weightEnough && shelfForUse;
        });
      };

      matchedData.forEach((item) => {
        const findLocations = findLocation(item);
        if (findLocations) {
          result.push({
            itemListId: item.itemListId,
            caseNo: item.caseNo,
            lotNo: item.lotNo,
            spec: item.spec,
            size: item.size,
            grossWeight: item.grossWeight,
            itemSubLocation: item.subLocation,
            locationId: findLocations.locationId,
            locationCode: findLocations.locationCode,
            locationSubLocation: findLocations.subLocation,
            locationWeight: findLocations.weight,
            locationZoneId: findLocations["LocationZone.locationZoneId"],
            zone: findLocations["LocationZone.zone"],
          });
          usedLocationId.add(findLocations.locationId);
        }
      });
      const locationMap = new Map();
      for (const loc of result) {
        const key = `${loc.caseNo}|${loc.spec}|${loc.size}`;
          if (!locationMap.has(key)) {
            locationMap.set(key, {
              locationId: loc.locationId,
              palletNo: getLatestPalletNo,
            });
            getLatestPalletNo++;
          }
      }
      
      for (const preInfo of preData) {
        const key = `${preInfo.caseNo}|${preInfo.spec}|${preInfo.size}`;
        const group = locationMap.get(key);
        if (group) {
          await ProductBalanceRepository.UpdateProductBalanceTransaction(
            {
              productDetailsId: preInfo.productDetailsId,
              palletNo: group.palletNo,
              mfgDate: mfgDate,
              productStatusId: 1,
              locationId: group.locationId
            },
            transaction
          );

          await ProductLogRepository.InsertProductLogTransaction(
            {
              productDetailsId: preInfo.productDetailsId,
              palletNo: group.palletNo,
              productStatusId: 1,
              locationId: group.locationId,
            },
            transaction
          );
        }
      }

      await transaction.commit();
      return "ok"
    } catch (error) {
      await transaction.rollback();
      throw "Can not reserve location";
    }
  }
  async getDataPrintPalletNote(productDetailsData) {
    try {
      let getId = await InboundDataCleaner.findIdProductDetails(productDetailsData);
      let productDetailsByKeys = await ProductBalanceRepository.getProductDetailsForPrintPalletNote(getId);
      return productDetailsByKeys
    } catch (error) {
      throw error;
    }
  }
  async GetPutAwayList(vendorId) {
    try {
      let getData = await ProductBalanceRepository.GetAllProductBalanceByVendorId(vendorId);
      console.log(getData)
      
      return getData;
    } catch (error) {
      throw `${error}`;
    }
  }
   async UpdatePutAwayStatus(palletNo, locationCode) {

    try {
      let findLocation = await LocationRepository.FindLocationByCode(locationCode);
      let findProductBalance = await ProductBalanceRepository.findProductBalancesByPalletNo(palletNo);
      //check if pallet no has been putaway
      for (const balance of findProductBalance) {
        if (balance["Location.locationCode"] != locationCode) {
          throw "Scanned location code doesn't match the received location code.";
        }
        if (balance.palletNo == palletNo && balance.productStatusId == 2) {
          throw "Data has been put away.";
        }
      }

      //check if already putaway exist
      let dataExisted = false;
      for (const balance of findProductBalance) {
        if (balance.productStatusId == 1 && balance.palletNo == palletNo) {
          dataExisted = true;
        }
      }
      if (dataExisted == false) {
        throw "Pallet No not found in received data.";
      }
      return await ProductBalanceRepository.UpdatePutAwayStatus(palletNo, findLocation.locationId).then(async (e) => {
        for (let i = 0; i < e[1].length; i++) {
          await ProductLogRepository.InsertProductLogPutAway(e[1][i]);
        }
      });
    } catch (error) {
      console.log(error)
      throw `${error}`;
    }
  }
  
}

module.exports = new InboundService();
