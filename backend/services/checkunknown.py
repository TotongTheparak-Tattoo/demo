import pandas as pd
from typing import Tuple

def checkunknown(df: pd.DataFrame) -> Tuple[bool, str]:
    for row_idx, row in df.iterrows():
        for col in df.columns:
            cell_value = str(row[col]).strip().lower()
            if "unknown" in cell_value:
                return False, f"❌ Found 'unknown' in row {row_idx + 1}, column '{col}': '{row[col]}'"
    return True, "✅ No 'unknown' values found."
