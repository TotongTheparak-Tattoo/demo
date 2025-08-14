# services/priority_group.py

from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

def get_priority_group(input_date: datetime, ref_date: datetime = None):
    if ref_date is None:
        ref_date = datetime.today()

    current_year = ref_date.year
    current_month = ref_date.month

    group1_end = datetime(current_year, current_month, 5)
    group2_start = datetime(current_year, current_month, 6)
    group2_end = datetime(current_year, current_month, 25)
    group3_start = datetime(current_year, current_month, 26)
    group3_end = (group3_start + relativedelta(months=1)).replace(day=25)
    group4_start = group3_end + timedelta(days=1)

    if input_date <= group1_end:
        return 1
    elif group2_start <= input_date <= group2_end:
        return 2
    elif group3_start <= input_date <= group3_end:
        return 3
    elif input_date >= group4_start:
        return 4
    else:
        return 0
