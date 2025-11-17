const VendorMasterRepository = require("../repositories/vendorMaster.repository");
const MakerRepository = require("../repositories/maker.repository");

class VendorMasterService {
    /*
   A class to represent a VendorMaster service.

   Attributes:
       -

   Methods:
       getVendorMaster(): get all vendor master from database
 */
  async getVendorMaster() {
    /*
        get all vendor master from database

        Args:
            -

        Raises:
            ValueError: -
    
        Example:
            >>> vendorMaster = VendorMasterService()
            >>> vendorMaster.getVendorMaster()
    */
    return await VendorMasterRepository.getVendorMaster();
  }
  async getMaker() {
    /*
        get all vendor master from database

        Args:
            -

        Raises:
            ValueError: -
    
        Example:
            >>> vendorMaster = VendorMasterService()
            >>> vendorMaster.getVendorMaster()
    */
    return await MakerRepository.findAll();
  }
  async insertVendorMaster(data) {
    const exists = await VendorMasterRepository.findVendorCode(data.vendorMasterCode);
    if (exists) {
      const err = new Error("Duplicate vendorMasterCode");
      err.code = "DUPLICATE_VENDOR_CODE";
      throw err;
    }
    return VendorMasterRepository.insertVendorMaster(data);
  }

}

module.exports = new VendorMasterService();
