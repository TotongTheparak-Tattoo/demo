class MonthlyValidators {
  requiredHeaders() {
    // Only these 17 essential columns are required
    return [
      "invoiceNo",
      "itemNo",
      "importerNameEN",
      "description",
      "quantity",
      "unit",
      "netWeight",
      "netWeightUnit",
      "arrivalDate",
      "currency",
      "amount",
      "cifTHB",
      "dutyRate",
      "dutyAmt",
      "tariff",
      "ctrlDeclarationNo",
      "consignmentCountry",
    ];
  }

  preferredDisplayName(internalKey) {
    const display = new Map([
      ["invoiceNo", "Invoice No."],
      ["itemNo", "Item No."],
      ["importerNameEN", "Importer NameEN"],
      ["description", "Desc."],
      ["quantity", "Qty."],
      ["unit", "Unit"],
      ["netWeight", "Netweight"],
      ["netWeightUnit", "Netweight Unit"],
      ["arrivalDate", "ArrivalDate"],
      ["currency", "Curr."],
      ["amount", "CIF FOR."],
      ["cifTHB", "CIF THB."],
      ["dutyRate", "Duty Rate"],
      ["dutyAmt", "Duty Amt."],
      ["tariff", "Tariff"],
      ["ctrlDeclarationNo", "Ctrl Declaration No."],
      ["consignmentCountry", "Consignment Country"],
    ]);
    return display.get(internalKey) || internalKey;
  }

  requiredValueFields() {
    // Minimal hard requirements for a valid monthly row
    return ["invoiceNo", "itemNo"]; // extend if business requires more
  }

  // Map incoming display headers (with spaces/periods) to internal keys
  normalizeHeaderName(h) {
    if (h == null) return "";
    const s = String(h).trim().replace(/\.+$/g, "").replace(/\s+/g, " ").toLowerCase();
    const key = s
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const map = new Map([
      ["invoice no", "invoiceNo"],
      ["item no", "itemNo"],
      ["importer nameen", "importerNameEN"],
      ["importer name en", "importerNameEN"],
      ["desc", "description"],
      ["description", "description"],
      ["qty", "quantity"],
      ["quantity", "quantity"],
      ["unit", "unit"],
      ["netweight", "netWeight"],
      ["net weight", "netWeight"],
      ["netweight unit", "netWeightUnit"],
      ["net weight unit", "netWeightUnit"],
      ["arrival date", "arrivalDate"],
      ["arrivaldate", "arrivalDate"],
      ["curr", "currency"],
      ["currency", "currency"],
      ["amount", "amount"],
      ["cif for", "amount"],
      ["cif thb", "cifTHB"],
      ["duty rate", "dutyRate"],
      ["duty amt", "dutyAmt"],
      ["tariff", "tariff"],
      ["ctrl declaration no", "ctrlDeclarationNo"],
      ["consignment country", "consignmentCountry"],
    ]);

    const result = map.get(key) || h; // fallback to original header if unmapped
    return result;
  }

  // Convert date format (mm/dd/yyyy) to ISO date string
  convertDateToISO(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    const trimmed = dateStr.trim();
    if (!trimmed) return null;
    
    // Match date format: mm/dd/yyyy (Christian Era)
    const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!dateMatch) return null;
    
    const [, month, day, year] = dateMatch;
    
    // Validate date
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (isNaN(date.getTime())) return null;
    
    // Return ISO date string (YYYY-MM-DD)
    return date.toISOString().split('T')[0];
  }

  remapRowsToInternalKeys(headers = [], rows = []) {
    const internalHeaders = headers.map(h => this.normalizeHeaderName(h));
    return rows.map((row) => {
      const out = {};
      internalHeaders.forEach((ih, idx) => {
        const originalHeader = headers[idx];
        out[ih] = row[ih] !== undefined ? row[ih] : row[originalHeader];
      });
      return out;
    });
  }

  validateCsv({ headers = [], rows = [] } = {}) {
    const internalHeaders = headers.map(h => this.normalizeHeaderName(h));
    const required = this.requiredHeaders();
    const headerSet = new Set(internalHeaders);
    const missing = required.filter(h => !headerSet.has(h));
    if (missing.length) {
      const missingDisplay = missing.map(m => this.preferredDisplayName(m));
      return { ok: false, required, missing, missingDisplay };
    }

    const numericFields = new Set([
      "itemNo",
      "quantity",
      "netWeight",
      "netWeight2",
      "grossWeight",
      "amount",
      "cifTHB",
      "dutyRate",
      "dutyAmt",
    ]);

    // Build map internalKey -> original CSV header
    const headerMap = {};
    internalHeaders.forEach((ih, idx) => {
      if (ih && headerMap[ih] == null) headerMap[ih] = headers[idx];
    });

    // First, remap input rows to internal keys using header mapping
    const keyedRows = this.remapRowsToInternalKeys(headers, rows);

    const normalized = keyedRows.map(r => {
      const out = { ...r };
      for (const k of Object.keys(out)) {
        if (numericFields.has(k) && out[k] != null && out[k] !== "") {
          const str = String(out[k]).replace(/,/g, "");
          const num = Number(str);
          out[k] = Number.isFinite(num) ? num : null;
        }
        // Convert date format for arrivalDate field
        if (k === 'arrivalDate' && out[k] != null && out[k] !== "") {
          const isoDate = this.convertDateToISO(String(out[k]));
          out[k] = isoDate;
        }
      }
      return out;
    });

    // Check required value fields per row
    const valueRequired = this.requiredValueFields();
    const valueErrors = [];
    normalized.forEach((r, idx) => {
      for (const f of valueRequired) {
        const v = r[f];
        if (v === undefined || v === null || String(v).trim() === "") {
          valueErrors.push({ index: idx, field: f, displayField: headerMap[f] || f, message: "required value" });
        }
      }
    });

    return { ok: true, rows: normalized, valueErrors, headerMap };
  }
}

module.exports = new MonthlyValidators();


