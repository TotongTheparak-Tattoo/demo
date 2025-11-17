class InboundValidator {
  async checkDataPreinformation(preInfo) {
      //1 check if preInfo is empty
      if (preInfo.length == 0)
          throw "No data found in pre information."
  }
  async CheckMatchedItemListData(matchedData) {
      if (!matchedData || matchedData.length === 0) {
        throw ("No data found in itemList.");
      }

      for (let i = 0; i < matchedData.length; i++) {
        const item = matchedData[i];

        if (
          item.itemListId == null ||
          item.locationZoneId == null ||
          item.subLocation == null 
          // item.weight == null
        ) {
          throw (`No matching itemList found for the selected data.`);
        }
      }
  }

  async checkDivisionExistInPreInfo(boxDetails, preInfo) {
    let uniqueBoxDetailsDiv = [];
    for (const boxDetail of boxDetails) {
      if (!uniqueBoxDetailsDiv.includes(boxDetail.division)) {
        uniqueBoxDetailsDiv.push(boxDetail.division);
      }
    }
    let uniquePreInfo = [];
    for (const preData of preInfo) {
      if (!uniquePreInfo.includes(preData["Division.divisionNameAS400Full"])) {
        uniquePreInfo.push(preData["Division.divisionNameAS400Full"]);
      }
    }
    for (let i = 0; i < uniqueBoxDetailsDiv.length; i++) {
      let checkDivExist = false;
      for (let j = 0; j < uniquePreInfo.length; j++) {
        if (uniqueBoxDetailsDiv[i] == uniquePreInfo[j]) {
          checkDivExist = true;
        }
      }
      if (checkDivExist == false)
        throw "Scanned data division doesn't exist in pre information list";
    }
  }
  async checkIfEmptyLocationIsEnough(locations) {
    if (locations.length == 0)
      throw "Location unavailable.";
  }
  async checkLocationSelect(locations) {
    if (locations.length == 0)
      throw "Please select location.";
  }
  async checkIsReceived(productDetails, dataSelect) {
        for (let i = 0; i < productDetails.length; i++) {
            let exist = false
            if ((productDetails[i]['ProductBalances.productStatusId'] === 1 || productDetails[i]['ProductBalances.productStatusId'] === 2 || productDetails[i]['ProductBalances.productStatusId'] === 3) && productDetails[i]['ProductBalances.palletNo'] != null){
                throw "Data has already been received";
            }

            for (let j = 0; j < dataSelect.length; j++) {
                if (
                productDetails[i].masterInvoiceNo == dataSelect[j].masterInvoiceNo &&
                productDetails[i].caseNo == dataSelect[j].caseNo &&
                productDetails[i].spec == dataSelect[j].spec &&
                productDetails[i].size == dataSelect[j].size
                ){
                    exist = true
                }
            }
            if (exist == false) {
                throw "Scanned data doesn't exist in pre information list."
            }
           
        }
    }

  async checkJobQueue(job) {
    // Set up event listeners to handle job success and failure
    let result = job.on("succeeded", (result) => {
      result = { result: "ok", detail: result };
    });

    let resultFailed = job.on("failed", (error) => {
      result = { result: "ng", detail: error };
    });
    // console.log("HELLO")
    console.log(result);
    console.log(resultFailed);
    return result;
  }
  async checkIfLocationIdIsUsed(data) {
    if (data.length != 0) {
      throw "The location id has been assigned. Please select a new one.";
    }
  }
}

module.exports = new InboundValidator();
