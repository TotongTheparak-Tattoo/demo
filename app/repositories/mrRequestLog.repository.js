const db = require("../models");
const MRRequestLog = db.mrRequestLog;
const PickingValidator = require("../validators/picking.validators");
const BaseRepository = require("./base.repository");

class MRRequestLogRepository extends BaseRepository {
  constructor() {
    super(MRRequestLog);
    this.model = MRRequestLog;
  }
  async findAll(opts = {}) {
    return this.model.findAll({ raw: true, ...opts });
  }
  async findAndCountAll(opts = {}) {
    return this.model.findAndCountAll({ raw: true, ...opts });
  }
  async bulkInsertLogs(items, options = {}) {
    const rows = items.map((data) => ({
      registered_at: PickingValidator.toDateTime(data.registered_at) ?? new Date(),
      updated_at: PickingValidator.toDateTime(data.updated_at) ?? null,

      mrNo: data.mrNo ?? null,

      mrNoDate: PickingValidator.toDateOnlyString(data.mrNoDate),
      stockOutDate: PickingValidator.toDateOnlyString(data.stockOutDate),

      mrNoIncrement: data.mrNoIncrement ?? null,
      invoiceNo_MasterLot: data.invoiceNo_MasterLot ?? null,
      invoiceNo_PartialInv: data.invoiceNo_PartialInv ?? null,
      nmbPoNo: data.nmbPoNo ?? null,
      itemName: data.itemName ?? null,
      itemNo: data.itemNo ?? null,
      lotNo: data.lotNo ?? null,
      caseNo: data.caseNo ?? null,
      spec: data.spec ?? null,
      size: data.size ?? null,
      quantity: data.quantity ?? null,
      exportEntryNo: data.exportEntryNo ?? null,
      unit: data.unit ?? null,
      remark: data.remark ?? null,
      productStatusId: data.productStatusId ?? null,
      locationId: data.locationId ?? null,
      vendorMasterId: data.vendorMasterId ?? null,
    }));

    return this.model.bulkCreate(rows, { ...options });
  }
}

module.exports = new MRRequestLogRepository();
