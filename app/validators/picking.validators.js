const CANONICAL_ORDER = [
  "mr_request_id",
  "Mr_no",
  "RequestDate",
  "Deliveryto",
  "partialInvoice",
  "MasterInvoiceNo",
  "CaseNo",
  "PoNo",
  "Lot_No",
  "Description",
  "Spec",
  "Sizemm",
  "Qty",
  "Unit",
  "NetWeight",
  "GrossWeight",
  "ExportEntryNo",
  "Remarks",
  "vendorMasterId",
  
];

const REQUIRED_MR_UPLOAD = [
  "RequestDate",
  "Deliveryto",
  "partialInvoice",
  "MasterInvoiceNo",
  "CaseNo",
  "Spec",
  "Sizemm",
  "Qty",
  "Unit",
  "vendorMasterId",
];

function normKey(s) {
  return String(s || "")
    .replace(/\u00A0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\./g, "")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")");
}

const ALIASES = {
  "vendor code": "vendorMasterId",
  "vendor name": "VendorName",
  "request date": "RequestDate",
  "delivery to": "Deliveryto",
  "invoice no(partial lot)": "partialInvoice",
  "invoice no (partial lot)": "partialInvoice",
  "invoice no(master lot)": "MasterInvoiceNo",
  "invoice no (master lot)": "MasterInvoiceNo",
  "case no": "CaseNo",
  "p/o no": "PoNo",
  "po no": "PoNo",
  "lot no": "Lot_No",
  "description": "Description",
  "spec": "Spec",
  "size(mm)": "Sizemm",
  "size (mm)": "Sizemm",
  "q'ty": "Qty",
  "qty": "Qty",
  "sku": "Unit",
  "unit": "Unit",
  "Unit": "Unit",
  "net weight": "NetWeight",
  "gross weight": "GrossWeight",
  "export entry (partial lot)": "ExportEntryNo",
  "export entry(partial lot)": "ExportEntryNo",
  "export entry": "ExportEntryNo",
  "exportentryno": "ExportEntryNo",
  "export_entry_no": "ExportEntryNo",
  "remarks": "Remarks",
  "mr no": "Mr_no",
  "mr_no": "Mr_no",
  "mr request id": "mr_request_id",
  "mr_request_id": "mr_request_id",
  "vendor id": "vendorMasterId",
  "vendorid": "vendorMasterId",
};

function buildHeaderMap(headers) {
  const indexToCanonical = [];
  const unknown = [];

  headers.forEach((rawHeader, idx) => {
    const key = normKey(rawHeader);
    const mapped = ALIASES[key];

    if (mapped) {
      indexToCanonical[idx] = mapped; 
    } else if (mapped === null) {
      indexToCanonical[idx] = null;
    } else {
      indexToCanonical[idx] = undefined;
      unknown.push(String(rawHeader));
    }
  });

  return { indexToCanonical, unknown };
}

function orderCanonicalHeaders(indexToCanonical) {
  const present = new Set(indexToCanonical.filter(Boolean));
  return CANONICAL_ORDER.filter((h) => present.has(h));
}

function normalizeCsvPayload(payload) {
  const { headers = [], rows = [] } = payload || {};

  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    throw new Error("Invalid payload: headers/rows must be array.");
  }

  const { indexToCanonical, unknown } = buildHeaderMap(headers);
  const canonicalHeaders = orderCanonicalHeaders(indexToCanonical);

  const mappedRows = rows.map((row) => {
    const out = {};

    headers.forEach((originalHeader, idx) => {
      const canonical = indexToCanonical[idx];
      if (!canonical) return;
      out[canonical] = row[originalHeader];
    });

    return out;
  });

  return {
    headers: canonicalHeaders,
    rows: mappedRows,
    meta: {
      sourceHeaders: headers,
      unmappedHeaders: unknown,
      mappedHeaders: canonicalHeaders,
    },
  };
}

function yyyymmddFromDate(dateObj) {
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function toYYYYMMDD(val) {
  if (val == null) return null;

  if (typeof val === "number" || (/^\d+$/.test(String(val).trim()) && Number(val) > 30000)) {
    const n = Number(val);
    if (!Number.isNaN(n)) {
      const base = Date.UTC(1899, 11, 30);
      const ms = base + n * 86400000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return yyyymmddFromDate(d);
    }
  }

  const s = String(val).trim();

  let m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (m) return `${m[1]}${m[2]}${m[3]}`;

  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}${m[2]}${m[1]}`;

  if (/^\d{8}$/.test(s)) return s;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return yyyymmddFromDate(d);

  return null;
}

function buildMrNo({ RequestDate, MasterInvoiceNo, CaseNo }) {
  const datePart = toYYYYMMDD(RequestDate);
  const invPart = (MasterInvoiceNo ?? "").toString().trim().replace(/\s+/g, "").toUpperCase();
  const casePart = (CaseNo ?? "").toString().trim().toUpperCase();

  if (!datePart || !invPart || !casePart) return null;
  return `MR-${datePart}-${invPart}-${casePart}`;
}

function applyMrNoToRows(rows, opts = {}) {
  const overwrite = !!(opts && opts.overwrite);
  const outputRows = [];
  const errors = [];

  rows.forEach((row, idx) => {
    if (row?.Mr_no && !overwrite) {
      outputRows.push(row);
      return;
    }

    const mr = buildMrNo({
      RequestDate: row.RequestDate,
      MasterInvoiceNo: row.MasterInvoiceNo,
      CaseNo: row.CaseNo,
    });

    if (!mr) {
      errors.push({
        index: idx,
        reason: "Cannot build Mr_no (missing/invalid RequestDate/MasterInvoiceNo/CaseNo)",
      });
      outputRows.push(row);
      return;
    }

    outputRows.push({ ...row, Mr_no: mr });
  });

  return { rows: outputRows, errors };
}

// to 'YYYY-MM-DD' for DATEONLY
function toDateOnlyString(v, tz = 'Z') {
  if (v == null || String(v).trim() === '') return null;

  // Excel serial (>= 30000 แบบที่คุณใช้)
  if (typeof v === 'number' || (/^\d+$/.test(String(v).trim()) && Number(v) > 30000)) {
    const n = Number(v);
    if (!Number.isNaN(n)) {
      const base = Date.UTC(1899, 11, 30);
      const ms = base + n * 86400000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : yyyymmdd_hyphen(d); // 'YYYY-MM-DD'
    }
  }

  const s = String(v).trim();

  // DD/MM/YYYY
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // YYYY-MM-DD or ISO / YYYY/MM/DD
  const d = new Date(s);
  if (!isNaN(d.getTime())) return yyyymmdd_hyphen(d);

  return null;
}

function yyyymmdd_hyphen(dateObj) {
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// to Date object for DATETIME
function toDateTime(v) {
  if (v == null || String(v).trim() === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

  // number → timestamp ms
  if (typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(v).trim();

  // DD/MM/YYYY → treat as local midnight UTC (or adjust ifต้องการโซนเวลา)
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s); // ISO-like, YYYY-MM-DD, etc.
  return isNaN(d.getTime()) ? null : d;
}

// ====== เพิ่ม: ค้นหา/ตรวจคอลัมน์ที่ขาด จากส่วน header mapping ======
function findMissingColumnsFromHeaders(headers, required = REQUIRED_MR_UPLOAD) {
  const { indexToCanonical } = buildHeaderMap(headers || []);
  const present = new Set(indexToCanonical.filter(Boolean)); // canonical keys ที่แมปได้จริง
  const missing = required.filter((k) => !present.has(k));
  return { missing, present: Array.from(present) };
}

// ====== เพิ่ม: ตรวจคอลัมน์ที่ขาดจาก rows หลัง normalize (เผื่อ safety) ======
function findMissingColumnsFromRows(rows, required = REQUIRED_MR_UPLOAD) {
  const keys = new Set();
  for (const row of rows || []) {
    Object.keys(row || {}).forEach((k) => keys.add(String(k)));
  }
  const missing = required.filter((k) => !keys.has(k));
  return { missing, present: Array.from(keys) };
}

// ====== เพิ่ม: validate ครบจบในที่เดียว (normalize -> ตรวจคอลัมน์ -> เติม Mr_no) ======
function validateCsvForMrUpload(payload, { overwriteMrNo = false } = {}) {
  // 1) normalize payload (ใช้ของเดิมของคุณ)
  const normalized = normalizeCsvPayload(payload);

  // 2) ตรวจว่าคอลัมน์จำเป็น “มีอยู่ในไฟล์” จาก header mapping
  const fromHeaders = findMissingColumnsFromHeaders(
    normalized.meta?.sourceHeaders,
    REQUIRED_MR_UPLOAD
  );

  // 3) ตรวจซ้ำจากแถวที่ถูก normalize แล้ว (กันพลาด)
  const fromRows = findMissingColumnsFromRows(normalized.rows, REQUIRED_MR_UPLOAD);

  // รวม unique missing
  const missing = Array.from(new Set([...fromHeaders.missing, ...fromRows.missing]));

  // 4) เติม/สร้าง Mr_no ตาม policy
  const { rows: withMr, errors: mrNoErrors } = applyMrNoToRows(normalized.rows, {
    overwrite: overwriteMrNo,
  });

  // สร้างผลลัพธ์สรุป
  return {
    ok: missing.length === 0,
    missing,                // รายการคอลัมน์ที่ขาด
    normalized,             // ผลจาก normalizeCsvPayload (headers/rows/meta)
    rowsWithMr: withMr,     // แถวหลังเติม Mr_no ตาม policy
    mrNoErrors,             // แถวที่สร้าง Mr_no ไม่ได้ (ถ้ามี)
    required: REQUIRED_MR_UPLOAD.slice(), // ให้ front/back ใช้แสดง
  };
}

module.exports = {
  normalizeCsvPayload,
  CANONICAL_ORDER,
  buildMrNo,
  applyMrNoToRows,
  toYYYYMMDD,
  toDateTime,
  toDateOnlyString,
  REQUIRED_MR_UPLOAD,
  findMissingColumnsFromHeaders,
  findMissingColumnsFromRows,
  validateCsvForMrUpload,
};
