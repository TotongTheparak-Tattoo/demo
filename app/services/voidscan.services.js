const MrRequestRepository = require("../repositories/mrRequest.repository");
const ProductBalanceRepository = require("../repositories/productBalance.repository");
const ProductLogRepository = require("../repositories/productLog.repository");

class VoidScanService {
  async deleteByPalletNo(palletNo) {    
    // normalize input                      
    const v = typeof palletNo === "string" ? palletNo.trim() : palletNo;
    if (v === "" || v === undefined || v === null) {
      return { deletedCount: 0, loggedCount: 0 };
    }
    // snapshot rows before delete filter by pallet
    const toLog = await ProductBalanceRepository.findAll({     
      where: { palletNo: v },                               
      attributes: [                                            
        "productBalanceId","palletNo","productDetailsId",
        "productStatusId","locationId","mrRequestId",
      ],
      raw: true,                                             
    });
    // perform delete
    const { deletedCount } = await ProductBalanceRepository.deleteByPalletNo(v); 
    // counter for successful logs
    let loggedCount = 0;                                       
    if (deletedCount > 0 && toLog.length > 0) {               
      for (const r of toLog) {                                 
        try {                         
          // write one log record
          await ProductLogRepository.InsertProductLog({        
            palletNo: r.palletNo,                     
            productDetailsId: r.productDetailsId,              
            productStatusId: 6,                          
            locationId: r.locationId,                       
            mrRequestId: r.mrRequestId,                      
          });
          loggedCount += 1;                                  
        } catch (e) {                                         
          console.error("InsertProductLog failed:", e?.message || e); 
        }
      }
    }
    // return summary
    return { deletedCount, loggedCount };                      
  }
}

module.exports = new VoidScanService();
