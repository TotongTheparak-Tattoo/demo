class TransactionMovementValidators {
  requiredHeaders() {
    return [
      "invoiceNo",
      "itemNo",
      "exporterNameEN",
      "description",
      "quantity",
      "unit",
      "netWeight",
      "netWeightUnit",
      "grossWeight",
      "grossWeightUnit",
      "declarationNo",
      "declarationLineNumber",
      "ctrlDeclarationNo",
    ];
  }

  preferredDisplayName(internalKey) {
    const display = new Map([
      ["invoiceNo", "Invoice No."],
      ["itemNo", "Item No."],
      ["exporterNameEN", "Exporter NameEN"],
      ["description", "Desc."],
      ["quantity", "Qty."],
      ["unit", "Unit"],
      ["netWeight", "Net Weight"],
      ["netWeightUnit", "Netweight Unit"],
      ["grossWeight", "Gross Weight"],
      ["grossWeightUnit", "Grossweight Unit"],
      ["declarationNo", "Declaration No"],
      ["declarationLineNumber", "DeclarationLine Number"],
      ["ctrlDeclarationNo", "Ctrl Declaration No."],
    ]);
    return display.get(internalKey) || internalKey;
  }

  requiredValueFields() {
    return ["invoiceNo", "itemNo", "exporterNameEN", "description", "quantity", "unit", "netWeight", "netWeightUnit", "grossWeight", "grossWeightUnit", "declarationNo", "declarationLineNumber"]; // ctrlDeclarationNo optional
  }

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
      ["exporter nameen", "exporterNameEN"],
      ["exporter name en", "exporterNameEN"],
      ["desc", "description"],
      ["description", "description"],
      ["qty", "quantity"], // extra column, not required
      ["quantity", "quantity"],
      ["unit", "unit"], // extra column, not required
      ["net weight", "netWeight"], // extra column, not required
      ["netweight", "netWeight"],
      ["netweight unit", "netWeightUnit"], // extra column, not required
      ["net weight unit", "netWeightUnit"],
      ["gross weight", "grossWeight"], // extra column, not required
      ["grossweight", "grossWeight"],
      ["grossweight unit", "grossWeightUnit"], // extra column, not required
      ["declaration no", "declarationNo"],
      ["declarationline number", "declarationLineNumber"],
      ["ctrl declaration no", "ctrlDeclarationNo"],
    ]);

    return map.get(key) || h;
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

    const numericFields = new Set(["itemNo", "declarationLineNumber", "quantity", "netWeight", "grossWeight"]);

    // Build map internalKey -> original CSV header
    const headerMap = {};
    internalHeaders.forEach((ih, idx) => {
      if (ih && headerMap[ih] == null) headerMap[ih] = headers[idx];
    });

    const keyedRows = this.remapRowsToInternalKeys(headers, rows);
    const normalized = keyedRows.map(r => {
      const out = { ...r };
      for (const k of Object.keys(out)) {
        if (numericFields.has(k) && out[k] != null && out[k] !== "") {
          const str = String(out[k]).replace(/,/g, "");
          const num = Number(str);
          out[k] = Number.isFinite(num) ? num : null;
        }
      }
      // Keep only required/internal fields if needed by downstream
      return {
        invoiceNo: out.invoiceNo ?? null,
        itemNo: out.itemNo ?? null,
        exporterNameEN: out.exporterNameEN ?? null,
        description: out.description ?? null,
        quantity: out.quantity ?? null,
        unit: out.unit ?? null,
        netWeight: out.netWeight ?? null,
        netWeightUnit: out.netWeightUnit ?? null,
        grossWeight: out.grossWeight ?? null,
        grossWeightUnit: out.grossWeightUnit ?? null,
        declarationNo: out.declarationNo ?? null,
        declarationLineNumber: out.declarationLineNumber ?? null,
        ctrlDeclarationNo: out.ctrlDeclarationNo ?? null,
      };
    });
    // Check required value fields per row
    const valueRequired = this.requiredValueFields();
    const valueErrors = [];
    normalized.forEach((r, idx) => {
      for (const f of valueRequired) {
        const v = r[f];
        if (v === undefined || v === null || String(v).trim?.() === "") {
          valueErrors.push({ index: idx, field: f, displayField: headerMap[f] || f, message: "required value" });
        }
      }
    });

    return { ok: true, rows: normalized, valueErrors, headerMap };
  }
}

module.exports = new TransactionMovementValidators();


