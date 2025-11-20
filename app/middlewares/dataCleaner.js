const { ValidationErrorItemOrigin } = require("sequelize");

class UploadDataCleaner {
  constructor() {
    this.runNumberMap = new Map(); // เก็บ run number สำหรับแต่ละ Master lot Invoice No.
    this.currentMasterInvoice = null;
    this.currentRunNumber = 0;
    this.initialized = false;
  }

  async initializeRunNumbers() {
    if (this.initialized) return;
    
    try {
      // เช็ค run number สูงสุดจาก database สำหรับแต่ละ masterInvoiceNo
      const ProductDetailsRepository = require("../repositories/productDetails.repository");
      const existingBoxNos = await ProductDetailsRepository.getAllBoxNos();
      
      for (const boxNo of existingBoxNos) {
        if (boxNo && boxNo.includes('_')) {
          const [masterInvoiceNo, runNumberStr] = boxNo.split('_');
          const runNumber = parseInt(runNumberStr, 10);
          
          if (!isNaN(runNumber)) {
            const currentMax = this.runNumberMap.get(masterInvoiceNo) || 0;
            this.runNumberMap.set(masterInvoiceNo, Math.max(currentMax, runNumber));
          }
        }
      }
      
      this.initialized = true;
    } catch (error) {
      console.error("[UploadDataCleaner] Error initializing run numbers:", error);
      this.initialized = true; // ยังไงก็ต้อง set เป็น true เพื่อไม่ให้ loop
    }
  }

  async cleanData(data) {
    await this.initializeRunNumbers();
    
    function cleanFormat(number) {
      if (number === undefined || number === null || number === "") return 0;
      const cleaned = number.toString().replace(/,/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }

    const normalize = (value) =>
      value === undefined || value === null ? "" : String(value).trim();

    const masterInvoiceNo = data["Master lot Invoice No."];
    const caseNo = data["PLT NO/ CASE No."];
    const specValue = normalize(data["Spec"]);
    const sizeValue = normalize(data["Size(mm)"]);
    
    // สร้าง key สำหรับเช็ค Master lot Invoice No. + PLT NO/ CASE No.
    const key = [
      normalize(masterInvoiceNo),
      normalize(caseNo),
      specValue,
      sizeValue,
    ].join("_");
    
    // เช็คว่ามี run number สำหรับ key นี้หรือไม่
    if (!this.runNumberMap.has(key)) {
      // ถ้าไม่มี ให้เช็คจาก database ว่าเคยมี run number สำหรับ masterInvoiceNo นี้หรือไม่
      const existingMaxRunNumber = this.runNumberMap.get(masterInvoiceNo) || 0;
      this.currentRunNumber = existingMaxRunNumber + 1;
      this.runNumberMap.set(key, this.currentRunNumber);
      this.runNumberMap.set(masterInvoiceNo, this.currentRunNumber);
    } else {
      // ถ้ามีแล้ว ให้ใช้ run number เดิม
      this.currentRunNumber = this.runNumberMap.get(key);
    }
    
    // สร้าง boxNo แบบใหม่
    const runNumberStr = String(this.currentRunNumber).padStart(3, '0');
    const boxNo = `${masterInvoiceNo}_${runNumberStr}`;

    return {
      boxNo: boxNo,
      masterInvoiceNo: masterInvoiceNo,
      caseNo: caseNo,
      poNo: data["P/O No."] === undefined || null ? "" : data["P/O No."],
      lotNo: data["Lot No."],
      heatNo: data["Heat no."] === undefined || null ? "" : data["Heat no."],
      itemName: data["Item name"],
      spec: data["Spec"],
      size: data["Size(mm)"],
      quantity: cleanFormat(data["Q'ty"]),
      unit: data["Unit"],
      width: data["Width"],
      currency: data["Currency"] == "" ? "-" : data["Currency"],
      unitPrice: cleanFormat(data["Unit price"]),
      amount: cleanFormat(data["Amount"]),
      netWeight: data["Net Weight(Kgm)"],
      grossWeight: data["Gross Weight(Kgm)"],
      // m3: data["M3"] === undefined || null ? "" : data["M3"],
      importEntryNo: data["Master lot ( Import Entry no.)"],
      remark: data["Remarks"] === undefined || null ? "" : data["Remarks"],
    };
  }
}
class InboundDataCleaner {
  constructor() {
    this.runNumberMap = new Map(); // เก็บ run number สำหรับแต่ละ Master lot Invoice No.
    this.currentMasterInvoice = null;
    this.currentRunNumber = 0;
    this.initialized = false;
  }

  async initializeRunNumbers() {
    if (this.initialized) return;
    
    try {
      // เช็ค run number สูงสุดจาก database สำหรับแต่ละ masterInvoiceNo
      const ProductDetailsRepository = require("../repositories/productDetails.repository");
      const existingBoxNos = await ProductDetailsRepository.getAllBoxNos();
      
      for (const boxNo of existingBoxNos) {
        if (boxNo && boxNo.includes('_')) {
          const [masterInvoiceNo, runNumberStr] = boxNo.split('_');
          const runNumber = parseInt(runNumberStr, 10);
          
          if (!isNaN(runNumber)) {
            const currentMax = this.runNumberMap.get(masterInvoiceNo) || 0;
            this.runNumberMap.set(masterInvoiceNo, Math.max(currentMax, runNumber));
          }
        }
      }
      
      this.initialized = true;
    } catch (error) {
      console.error("[InboundDataCleaner] Error initializing run numbers:", error);
      this.initialized = true; // ยังไงก็ต้อง set เป็น true เพื่อไม่ให้ loop
    }
  }

  async cleanData(data) {
    await this.initializeRunNumbers();
    
    const masterInvoiceNo = data["Master lot Invoice No."];
    const caseNo = data["PLT NO/ CASE No."];

    const cleanFormat = (number) => {
      if (number === undefined || number === null || number === "") return 0;
      const cleaned = number.toString().replace(/,/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };
    
    // สร้าง key สำหรับเช็ค Master lot Invoice No. + PLT NO/ CASE No.
    const normalize = (value) =>
      value === undefined || value === null ? "" : String(value).trim();

    const specValue = normalize(data["Spec"]);
    const sizeValue = normalize(data["Size(mm)"]);

    const key = [
      normalize(masterInvoiceNo),
      normalize(caseNo),
      specValue,
      sizeValue,
    ].join("_");
    
    // เช็คว่ามี run number สำหรับ key นี้หรือไม่
    if (!this.runNumberMap.has(key)) {
      // ถ้าไม่มี ให้เช็คจาก database ว่าเคยมี run number สำหรับ masterInvoiceNo นี้หรือไม่
      const existingMaxRunNumber = this.runNumberMap.get(masterInvoiceNo) || 0;
      this.currentRunNumber = existingMaxRunNumber + 1;
      this.runNumberMap.set(key, this.currentRunNumber);
      this.runNumberMap.set(masterInvoiceNo, this.currentRunNumber);
    } else {
      // ถ้ามีแล้ว ให้ใช้ run number เดิม
      this.currentRunNumber = this.runNumberMap.get(key);
    }
    
    // สร้าง boxNo แบบใหม่
    const runNumberStr = String(this.currentRunNumber).padStart(3, '0');
    const boxNo = `${masterInvoiceNo}_${runNumberStr}`;

    return {
      boxNo: boxNo,
      masterInvoiceNo: masterInvoiceNo,
      caseNo: caseNo,
      poNo: data["P/O No."] === undefined || null ? "" : data["P/O No."],
      lotNo: data["Lot No."],
      heatNo: data["Heat no."] === undefined || null ? "" : data["Heat no."],
      itemName: data["Item name"],
      spec: data["Spec"],
      size: data["Size(mm)"],
      quantity: cleanFormat(data["Q'ty"]),
      unit: data["Unit"],
      currency: data["Currency"] == "" ? "-" : data["Currency"],
      unitPrice: cleanFormat(data["Unit price"]),
      amount: cleanFormat(data["Amount"]),
      netWeight: data["Net Weight(Kgm)"],
      grossWeight: data["Gross Weight(Kgm)"],
      // m3: data["M3"] === undefined || null ? "" : data["M3"],
      importEntryNo: data["Master lot ( Import Entry no.)"],
      remark: data["Remarks"] === undefined || null ? "" : data["Remarks"],
    };
  }
  async getProductDetailKeys(data) {
    let keysPD = []
    for (let i = 0; i < data.length; i++) {
      keysPD.push({ masterInvoiceNo: data[i].masterInvoiceNo, caseNo: data[i].caseNo, spec: data[i].spec, size: data[i].size })
    }
    return keysPD
  }
  async getMfgDate() {
    let date = new Date();
    date.setHours(date.getHours() + 7);
    if (date.getUTCHours() < 7) {
      date.setDate(date.getDate() - 1);

    }
    return date
  }
  async findIdProductDetails(productDetailsData) {
    const getProductDetailsId = productDetailsData.map(item => item.productDetailsId);
    return getProductDetailsId
  }
}

module.exports = {
  Upload: new UploadDataCleaner(),
  Inbound: new InboundDataCleaner(),
};
