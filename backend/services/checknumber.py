from pydantic import BaseModel, ValidationError, field_validator
from typing import Any
import pandas as pd

class NumberStrictModel(BaseModel):
    value: float  # ✅ เก็บเป็น float เสมอ

    @field_validator("value", mode="before")
    @classmethod
    def clean_and_validate(cls, v):
        if pd.isna(v):  # ถ้าเป็น NaN จาก pandas
            raise ValueError("Missing number")
        if isinstance(v, str):
            v = v.replace(",", "").replace("%", "").strip()  # ✅ ลบ , และ %
        try:
            num = float(v)
        except (ValueError, TypeError):
            raise ValueError("Value is not a valid number")
        if num < 0:
            raise ValueError("Number must be greater than or equal to 0")
        return num

def checknumber(df: pd.DataFrame, numeric_columns: list[str]) -> tuple[bool, str]:
    for col in numeric_columns:
        if col not in df.columns:
            continue
        for i, val in df[col].items():
            try:
                validated = NumberStrictModel(value=val)
                df.at[i, col] = validated.value  # ✅ แปลงค่าใน DataFrame เป็น float
            except ValidationError as e:
                return False, f"[Row {i + 1}] Column '{col}': {e.errors()[0]['msg']} (value = {val})"
    return True, "Numeric format is valid"
