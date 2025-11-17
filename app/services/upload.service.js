const ProductDetailsRepository = require("../repositories/productDetails.repository");
const ProductBalanceRepository = require("../repositories/productBalance.repository");
const ProductLogRepository = require("../repositories/productLog.repository");
const VendorMasterRepository = require("../repositories/vendorMaster.repository");
const UploadDataCleaner = require("../middlewares/dataCleaner").Upload;

const { sequelize } = require("../models");
class UploadService {
  /*
   A class to represent a upload service for pre informations of general.

   Attributes:
       -

   Methods:
       uploadToProduct(uploadedData): Upload csv file to product details, product balance and product log
 */
  async uploadToProduct(uploadedData) {
    /*
            Upload csv file to product details, product balance and product log
    
            Args:
                uploadedData.data(array of objects): 
                uploadedData.file_name(string): 
    
            Raises:
                ValueError: -
        
            Example:
                >>> upload = UploadService()
                >>> upload.uploadToProduct({
                "data": [
                          {
                            "Vendor code": "2000528",
                            "Vendor name": "TOYOTA TSUSHO (THAILAND) CO.,LTD.",
                            "Master lot Invoice No.": "GR-85913",
                            "PLT NO/ CASE No.": "MSB00042",
                            "P/O No.": "",
                            "Lot No.": "G699 01",
                            "Heat no.": "4C3370",
                            "Item name": "Steel Coil",
                            "Spec": "SAE52100UF",
                            "Size(mm)": "2.45",
                            "Q'ty": 1 ,
                            "Unit": "Coil",
                            "Net Weight(Kgm)": 463,
                            "Gross Weight(Kgm)": 559,
                            "Currency": "YN",
                            "Unit price": 567.90,
                            "Amount": 262937.70,
                            "Master lot ( Import Entry no.)": "A0080680414637",
                            "Remarks": ""
                          }
                        ],
                "file_name": "test.csv"
                })
        */
    let hasError = false;
    let errorType = "";
    let transaction;
    try {
      transaction = await sequelize.transaction();
      let data = uploadedData.data;
      for (let i = 0; i < data.length; i++) {
        try {
          let findVendorCode = await VendorMasterRepository.findVendorCode(
            data[i]["Vendor code"],
            transaction
          );
          let checkEmptyString =
            data[i]["Vendor code"] == "" ||
            data[i]["Vendor name"] == "" ||
            data[i]["Master lot Invoice No."] == "" ||
            data[i]["PLT NO/ CASE No."] == "" ||
            data[i]["P/O No."] == "" ||
            data[i]["Lot No."] == "" ||
            data[i]["Heat no."] == "" ||
            data[i]["Item name"] == "" ||
            data[i]["Spec"] == "" ||
            data[i]["Size(mm)"] == "" ||
            data[i]["Q'ty"] == "" ||
            data[i]["Unit"] == "" ||
            data[i]["Width"] == "" ||
            data[i]["Net Weight(Kgm)"] == "" ||
            data[i]["Gross Weight(Kgm)"] == "" ||
            data[i]["Master lot ( Import Entry no.)"] == "";

          if (checkEmptyString) {
            errorType = "MISSING_DATA";
            throw { name: "Data is null" };
          }
          if (findVendorCode == null) {
            errorType = "INVALID_VENDOR";
            throw { message: "Input vendor code doesn't exist in database" };
          }

          let findProductDetail =
            await ProductDetailsRepository.findProductByCompoundKey(
              data[i]["Master lot Invoice No."],
              data[i]["PLT NO/ CASE No."],
              data[i]["Lot No."],
              data[i]["Spec"],
              data[i]["Size(mm)"],
              findVendorCode.vendorMasterId,
              transaction
            );

          if (findProductDetail == null) {
            let dataForInsert = await UploadDataCleaner.cleanData(data[i])
            await ProductDetailsRepository.insertProduct(dataForInsert, findVendorCode.vendorMasterId, transaction).then(async (e) => {
              let insertedData = JSON.parse(JSON.stringify(e));
              await ProductBalanceRepository.InsertProductBalanceUpload( insertedData.productDetailsId, transaction );
              await ProductLogRepository.InsertProductLogUpload( insertedData.productDetailsId, transaction );
            });
          } else {
            let dataForUpdate = await UploadDataCleaner.cleanData(data[i])
            await ProductDetailsRepository.updateProduct(dataForUpdate, findVendorCode.vendorMasterId, transaction);
            await ProductBalanceRepository.InsertProductBalanceUpload( findProductDetail.productDetailsId, transaction );
            await ProductLogRepository.InsertProductLogUpload( findProductDetail.productDetailsId, transaction );
          }
           } catch (error) {
             console.log("Error at row", i + 1, ":", error);
            if (error.name === 'SequelizeUniqueConstraintError') {
              errorType = "DUPLICATE_DATA";
            } else if (error.name === 'SequelizeValidationError') {
              errorType = "VALIDATION_ERROR";
            } else if (error.name === 'Data is null') {
              errorType = "MISSING_DATA";
            } else if (error.message && error.message.includes("doesn't exist")) {
              errorType = "INVALID_VENDOR";
            }
            
            hasError = true;
        }
      }
    if (hasError) {
      await transaction.rollback();
      let errorMessage = this.getErrorMessage(errorType);
      
      return {
        statusCode: 400,
        message: errorMessage,
      };
    } else {
      await transaction.commit();
      return {
        success: true,
        statusCode: 200,
        message: "File uploaded successfully",
      };
    }
    } catch (error) {
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError);
        }
      }
      return {
        statusCode: 500,
        message: "Internal server error occurred during file processing",
        error: error.message || error.toString()
      };
    }
  }
  getErrorMessage(errorType) {
  switch (errorType) {
    case "DUPLICATE_DATA":
      return "Duplicate data found in the system. Please check the data and try again.";
    case "MISSING_DATA":
      return "Required data is missing. Please check your file CSV.";
    case "INVALID_VENDOR":
      return "Invalid Vendor Code. Please verify the Vendor Code in the system.";
    case "VALIDATION_ERROR":
      return "Invalid format. Please check the data format.";
    default:
      return "File upload failed due to data validation errors";
  }
}
}

module.exports = new UploadService();
