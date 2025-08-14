import math
import pandas as pd
from typing import List, Tuple
from datetime import datetime, date, timedelta

def checkdate(
    df: pd.DataFrame,
    date_columns: List[str],
    cast_to_date: bool = True,          # True = บีบให้เป็น date (ไม่มีเวลา)
    allow_excel_serial: bool = True     # True = รองรับเลขแบบ Excel serial
) -> Tuple[bool, str]:
    """
    ตรวจรูปแบบวันที่ในคอลัมน์ที่กำหนด และ (โดยดีฟอลต์) แปลงเป็นชนิดวันที่จริง
    คืนค่า: (is_ok, message)
    - ถ้า is_ok=True: df[col] ถูกแปลงเป็น date หรือ datetime แล้ว
    - ถ้า is_ok=False: message จะบอกแถว/คอลัมน์/ค่าที่ผิด
    """

    accepted_formats = [
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ]

    def parse_one(v):
        if pd.isna(v) or (isinstance(v, str) and v.strip() == ""):
            raise ValueError("is empty")

        # ผ่านถ้าเป็นชนิดวัน/เวลาอยู่แล้ว
        if isinstance(v, (pd.Timestamp, datetime, date)):
            return pd.to_datetime(v)

        # Excel serial number (เช่น 45500.5)
        if allow_excel_serial and isinstance(v, (int, float)) and not math.isnan(float(v)):
            base = datetime(1899, 12, 30)  # Excel (Windows) base
            return pd.to_datetime(base + timedelta(days=float(v)))

        s = str(v).strip()

        # ลองตามรูปแบบที่กำหนด
        for fmt in accepted_formats:
            try:
                return pd.to_datetime(datetime.strptime(s, fmt))
            except ValueError:
                pass

        # กันเคสที่ยัง parse ไม่ได้ แต่เป็น dd/mm/yyyy ทั่วไป
        try:
            return pd.to_datetime(s, dayfirst=True, errors="raise")
        except Exception:
            raise ValueError(f"invalid format '{s}'")

    for col in date_columns:
        if col not in df.columns:
            return False, f"Missing date column: '{col}'"

        parsed = []
        # ใช้ enumerate เพื่อให้ row number เป็น 1-based ตามลำดับแถวใน DataFrame
        for row_pos, v in enumerate(df[col].tolist(), start=1):
            try:
                dt = parse_one(v)
                parsed.append(dt)
            except ValueError as e:
                return False, f"[Row {row_pos}] Column '{col}': {e}"

    # แปลงให้เป็น Series แล้วจัด index ให้ตรงกับ df เพื่อไม่ให้ค่าเหลื่อม
    ser = pd.to_datetime(pd.Series(parsed), errors="raise")
    if cast_to_date:
        df[col] = pd.Series(ser.dt.date, index=df.index)
    else:
        df[col] = pd.Series(ser, index=df.index)

    return True, "All date values are valid and normalized"
