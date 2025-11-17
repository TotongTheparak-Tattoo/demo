/** ตัดช่องว่าง ซ้าย-ขวา และแปลงเป็นสตริง */
function sanitizeString(v) {
  return String(v ?? '').trim();
}

/** ตรวจรูปแบบวันที่ YYYY-MM-DD แบบเข้มงวด */
function isValidDateYYYYMMDD(s) {
  if (typeof s !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** ตรวจพารามิเตอร์ query ของรายการ Void Process */
function validateListQuery(input = {}) {
  const errors = [];

  const receiveDate = sanitizeString(input.receiveDate);
  const vendor = input.vendor != null ? sanitizeString(input.vendor) : '';

  if (!receiveDate) {
    errors.push({ field: 'receiveDate', message: 'required' });
  } else if (!isValidDateYYYYMMDD(receiveDate)) {
    errors.push({ field: 'receiveDate', message: 'must be YYYY-MM-DD' });
  }

  return {
    ok: errors.length === 0,
    errors,
    value: { receiveDate, vendor },
  };
}

module.exports = {
  sanitizeString,
  isValidDateYYYYMMDD,
  validateListQuery,
};
