import pandas as pd

def checkempty(df: pd.DataFrame) -> tuple[bool, str]:
    for idx, row in df.iterrows():
        for col, val in row.items():
            if pd.isna(val) or str(val).strip() == "":
                return False, f"Empty value found in column '{col}' at row {idx + 1}"
    return True, "No empty values found"
