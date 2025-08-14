bomWos = ["updateAt","wosNo","brgNoValue","partNoValue","partComponentGroup","qty","parentPartNo",]
machineGroup = ["machineNo","machineType","machineGroup"]
balanceOrderMidSmall = ["targetPlanMonth","orderNo","dueDate","balanceOrder","partGroup","wosNo"]
fac1 = ["brgNoValue","groupBrgNoValue"]
fac3 = ["brgNoValue","groupBrgNoValue"]
sleeveAndThrustbrg = ["brgNoValue","groupBrgNoValue"]
kpiProduction = ["autoMachineDailyTarget","manualDailyTarget"]
kpiSetup = ["machineGroup","setupAverage","maxSetUpPerDay"]
machineLayout = ["lineNo","machineNo","locationNo"]
machineNotAvailable = ["machineNo"]
productionPlan = ["machineNo","brgNoValue"]

actualassy = ["machineNo","brgNoValue","startDate","endDate","actualOutput"]
toolLimitAndCapa = ["brgNoValue","groupBrgNoValue","machineGroup","machineType","machineNo","groupBrgAndMcGroup","limitByType","limitByGroup","joinToolingPartNo","capaDay","utilizeMc","cycleTime","capaF3"]
workingDate = ["workingDate","workingHr"]
wipAssy = ["updateAt","brgNoValue","wosNo","processValue","qty","wipType"]
# productionPlanActual = ["brgNoValue","machineNo","workingDate","actualOutput"]
# รวมทั้งหมดไว้ใน dictionary
HEADER_RULES = {
    "bomWos": bomWos,
    "machineGroup": machineGroup,
    "balanceOrderMidSmall": balanceOrderMidSmall,
    "fac1": fac1,
    "fac3": fac3,
    "sleeveAndThrustbrg": sleeveAndThrustbrg,
    "kpiProduction": kpiProduction,
    "kpiSetup": kpiSetup,
    "machineLayout": machineLayout,
    "machineNotAvailable": machineNotAvailable,
    "productionPlan": productionPlan,
    # "productionPlanActual": productionPlanActual,
    "actualassy": actualassy,
    "toolLimitAndCapa": toolLimitAndCapa,
    "workingDate": workingDate,
    "wipAssy": wipAssy,
}

def checkheader(df, topic: str):
    # ลบช่องว่างหัวตาราง
    df_columns = [col.strip() for col in df.columns]

    topic_key = topic

    if topic_key not in HEADER_RULES:
        return False, f"No header rules defined for topic: {topic}"

    required_columns = HEADER_RULES[topic_key]

    for col in required_columns:
        if col not in df_columns:
            return False, f"Missing required column: '{col}'"

    return True, "Header is valid"
