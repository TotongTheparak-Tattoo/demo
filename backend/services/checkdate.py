import math
import re
import pandas as pd
from typing import List, Tuple
from datetime import datetime, date, timedelta

def checkdate(
    df: pd.DataFrame,
    date_columns: List[str],
    cast_to_date: bool = False,         # ← ถ้า column DB เป็น DATETIME ให้ False, ถ้าเป็น DATE ให้ True
    allow_excel_serial: bool = True
) -> Tuple[bool, str]:
    """
    ตรวจและแปลงคอลัมน์วันที่ให้เป็นชนิดจริง (date/datetime)
    คืนค่า (is_ok, message) และเขียนค่าที่แปลงแล้วกลับเข้า df[col]
    """

    accepted_formats = [
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        # เพิ่มตรงนี้ถ้าคุณใช้ %Y/%m/%d บ่อย
        "%Y/%m/%d %H:%M",
        "%Y/%m/%d",
    ]

    def parse_one(v):
        if pd.isna(v) or (isinstance(v, str) and v.strip() == ""):
            raise ValueError("is empty")

        # ผ่านถ้าเป็นชนิดวัน/เวลาอยู่แล้ว
        if isinstance(v, (pd.Timestamp, datetime, date)):
            return pd.to_datetime(v)

        # Excel serial number (เช่น 45500.5)
        if allow_excel_serial and isinstance(v, (int, float)):
            try:
                fv = float(v)
                if math.isnan(fv):
                    raise ValueError("is NaN")
                base = datetime(1899, 12, 30)  # Excel base (Windows)
                return pd.to_datetime(base + timedelta(days=fv))
            except Exception:
                pass

        s = str(v).strip()

        # ถ้าเป็นรูปแบบ year-first ชัดเจน (เช่น 2025/10/15), ปิด dayfirst เพื่อกัน warning
        if re.match(r"^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}(\s+\d{1,2}:\d{2})?$", s):
            try:
                return pd.to_datetime(s, dayfirst=False, errors="raise")
            except Exception:
                pass

        # ลองตามรูปแบบที่กำหนด
        for fmt in accepted_formats:
            try:
                return pd.to_datetime(datetime.strptime(s, fmt))
            except ValueError:
                continue

        # สุดท้ายลอง dayfirst=True (รองรับ dd/mm/yyyy)
        try:
            return pd.to_datetime(s, dayfirst=True, errors="raise")
        except Exception:
            raise ValueError(f"invalid format '{s}'")

    for col in date_columns:
        if col not in df.columns:
            return False, f"Missing date column: '{col}'"

        parsed = []
        # ใช้ enumerate เริ่ม 2 เพื่ออ้างแถวแบบ Excel (เผื่อ header 1 แถว)
        for row_pos, v in enumerate(df[col].tolist(), start=2):
            try:
                dt = parse_one(v)
                parsed.append(dt)
            except ValueError as e:
                return False, f"[Row {row_pos}] Column '{col}': {e}"

        # >>> ต้องอยู่ 'ใน' ลูปเสมอ <<<
        ser = pd.to_datetime(pd.Series(parsed), errors="raise")
        if cast_to_date:
            df[col] = pd.Series(ser.dt.date, index=df.index)   # เป็น datetime.date
        else:
            df[col] = pd.Series(ser, index=df.index)           # เป็น pandas.Timestamp

    return True, "All date values are valid and normalized"
