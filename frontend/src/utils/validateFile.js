import * as XLSX from 'xlsx';

export function validateFileBasic(file, key, options = {}) {
  const { maxSizeMB = 5, requiredHeaders = [], checkLogicFn = null } = options;

  const errors = [];

  if (!file.name.toLowerCase().includes(key.toLowerCase())) {
    errors.push(`❌ ชื่อไฟล์ไม่ตรงกับประเภท "${key}"`);
  }

  const validTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (!validTypes.includes(file.type)) {
    errors.push(`❌ ไฟล์ ${file.name} ไม่ใช่ประเภท CSV หรือ Excel`);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      const headers = json[0].map(h => String(h).trim());
      const rows = json.slice(1);

      // ตรวจ header
      requiredHeaders.forEach((h) => {
        if (!headers.includes(h)) {
          errors.push(`❌ ไม่พบคอลัมน์ "${h}" ในไฟล์ ${file.name}`);
        }
      });

      // ตรวจ logic เพิ่มเติม
      if (checkLogicFn) {
        const logicErrors = checkLogicFn(headers, rows);
        if (logicErrors.length > 0) {
          errors.push(...logicErrors);
        }
      }

      resolve(errors);
    };

    reader.readAsArrayBuffer(file);
  });
}
