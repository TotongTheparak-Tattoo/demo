def checkfiletype(filename: str) -> bool:
    return filename.endswith(".csv") or filename.endswith(".xlsx")
