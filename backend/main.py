from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends,Body
from sqlalchemy.orm import Session
from io import BytesIO
import pandas as pd
from datetime import datetime, timezone , date
from db import engine, Base, get_db
from models import BomWos,MachineType,MachineLayout,Capacity,LimitAssy,JoinLimitAssy,ProductionPlanActual
from models import MachineNotAvailable,ProductionPlan,BalanceOrderMidSmall,PartAssy,KpiSetup,KpiProduction
from models import WorkingDate,Divition,Role,User,Machine,DataPlan,ApproveDataPlan,WipAssy
from pprint import pprint
from sqlalchemy import func,extract
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import IntegrityError
from fastapi.responses import JSONResponse
import calendar
import re

from services.checkfiletype import checkfiletype
from services.checkfilename import checkfilename
from services.checkheader import checkheader
from services.checknumber import checknumber
from services.checkdate import checkdate
from services.checkunknown import checkunknown
from services.checkempty import checkempty

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # "http://192.168.100.124:3001","http://localhost:3000"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/data_management/bomWos/upload/")
async def bom_wos(file: UploadFile = File(...), db: Session = Depends(get_db)):
    #variable count
    inserted = 0
    skipped = 0
    inserted_rows = []
    skipped_rows = []

    #read raw file
    contents = await file.read()
    
    # #check file name
    if not checkfilename(file.filename, "bomWos"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'bomWos'")
    
    #check file type
    if not checkfiletype(file.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if file.filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(contents))
    else:
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

    #delete coloum not header
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(df, "bomWos")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    #check number
    is_valid, message = checknumber(df, ['qty'])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check date
    is_valid, message = checkdate(df, ["updateAt"])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check unknown
    is_valid, message = checkunknown(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # insert to DB
    for row in df.to_dict(orient="records"):
        wos_no = row.get("wosNo")
        brg_no = row.get("brgNoValue")
        part_no = row.get("partNoValue")
        part_group = row.get("partComponentGroup")
        qty = row.get("qty")
        parent_no = row.get("parentPartNo")

        #find wosNo and brgNoValue and partNoValue and parentPartNo same
        existing = db.query(BomWos).filter(
            BomWos.wosNo == wos_no,
            BomWos.brgNoValue == brg_no,
            BomWos.partNoValue == part_no,
            BomWos.parentPartNo == parent_no,
            BomWos.partComponentGroup == part_group,
            BomWos.qty == qty
        ).first()

        #if see duplicate data skip
        if existing:
            skipped += 1
            skipped_rows.append(row)
            continue

        #insert data
        new_item = BomWos(
            wosNo=wos_no,
            brgNoValue=brg_no,
            partNoValue=part_no,
            partComponentGroup=part_group,
            qty=int(qty),
            parentPartNo=parent_no
        )
        db.add(new_item)
        inserted += 1
        inserted_rows.append(row)

    db.commit()

    # print insert/skip
    # print("✅ Inserted Rows:")
    # pprint(inserted_rows)

    # print("\n⏭️ Skipped Rows (duplicate lineNo + locationNo):")
    # pprint(skipped_rows)

    return {
        "status": "success",
        "inserted": inserted,
        "skipped": skipped
    }

@app.post("/data_management/machineLayout/upload/")
async def machineLayout(file: UploadFile = File(...), db: Session = Depends(get_db)):
    #variable count
    inserted = 0
    skipped = 0
    inserted_rows = []
    skipped_rows = []
    
    #read raw file
    contents = await file.read()
    
    # #check file name
    if not checkfilename(file.filename, "machineLayout"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'machineLayout'")
    
    #check file type
    if not checkfiletype(file.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if file.filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(contents))
    else:
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

    #delete coloum not header
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

    #check header
    is_valid, message = checkheader(df, "machineLayout")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check unknown
    is_valid, message = checkunknown(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # insert to DB
    for row in df.to_dict(orient="records"):
        line_no = row.get("lineNo")
        machine_no = row.get("machineNo")
        location_no = row.get("locationNo")

        #find lineNo and locationNo same to skip
        existing = db.query(MachineLayout).filter(
            MachineLayout.lineNo == line_no,
            MachineLayout.locationNo == location_no,
            MachineLayout.machineNo == machine_no
        ).first()

        if existing:
            skipped += 1
            skipped_rows.append(row)
            continue

        #insert new record
        new_layout = MachineLayout(
            lineNo=line_no,
            machineNo=machine_no,
            locationNo=location_no
        )
        db.add(new_layout)
        inserted += 1
        inserted_rows.append(row)

    db.commit()

    # print insert/skip
    # print("✅ Inserted Rows:")
    # pprint(inserted_rows)

    # print("\n⏭️ Skipped Rows (duplicate lineNo + locationNo):")
    # pprint(skipped_rows)

    return {
        "status": "success",
        "inserted": inserted,
        "skipped": skipped
    }

@app.post("/data_management/machineGroup/upload/")
async def machineGroup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    #variable count
    inserted = 0
    failed_rows = []
    inserted_rows = []

    #read raw file
    contents = await file.read()
    
    # #check file name
    if not checkfilename(file.filename, "machineGroup"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'bomWos'")
    
    #check file type
    if not checkfiletype(file.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if file.filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(contents))
    else:
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

    #delete coloum not header
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(df, "machineGroup")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check unknown
    is_valid, message = checkunknown(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    #INSERT
    #loop check and insert
    for row_index, row in enumerate(df.to_dict(orient="records")):
        #select row with coloum
        machine_group = row.get("machineGroup")
        machine_type = row.get("machineType")
        machine_no = row.get("machineNo")
        #check information complete
        if not all([machine_group, machine_type, machine_no]):
            failed_rows.append({"row": row_index + 2, "reason": "Missing required data"})
            continue

        #find machineTypeId
        machine_type_obj = db.query(MachineType).filter(MachineType.machineType == machine_type).first()
        #if not see insert machinetype
        if not machine_type_obj:
            machine_type_obj = MachineType(machineType=machine_type)
            db.add(machine_type_obj)
            db.commit()
            db.refresh(machine_type_obj)

        #find machineLayoutId
        machine_layout_obj = db.query(MachineLayout).filter(MachineLayout.machineNo == machine_no).first()
        if not machine_layout_obj:
            failed_rows.append({"row": row_index + 2, "reason": f"MachineNo '{machine_no}' not found in MachineLayout"})
            continue

        #Insert Machine
        machine = Machine(
            machineGroup=machine_group,
            machineTypeId=machine_type_obj.id,
            machineLayoutId=machine_layout_obj.id
        )

        db.add(machine)
        inserted += 1
        inserted_rows.append(row)

    db.commit()

    # print failed row
    # print("✅ Inserted Rows:")
    # pprint(failed_rows)

    return {
        "status": "success",
        "inserted": inserted,
        "failed_rows": failed_rows
    }

@app.post("/data_management/fac1/upload/")
async def fac1(file: UploadFile = File(...), db: Session = Depends(get_db)):
    #variable count
    inserted = 0
    failed_rows = []
    inserted_rows = []

    #read raw file
    contents = await file.read()
    
    # #check file name
    if not checkfilename(file.filename, "fac1"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'fac1'")
    
    #check file type
    if not checkfiletype(file.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if file.filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(contents))
    else:
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

    #delete coloum not header
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(df, "fac1")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check unknown
    is_valid, message = checkunknown(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    #INSERT
    #loop check and insert
    for row_index, row in enumerate(df.to_dict(orient="records")):
        #select row with coloum
        brgNoValue = row.get("brgNoValue")
        groupBrgNoValue = row.get("groupBrgNoValue")
        #check information complete
        if not all([brgNoValue, groupBrgNoValue]):
            failed_rows.append({"row": row_index + 2, "reason": "Missing required data"})
            continue

        #find bomwosId
        bom_wos_obj = db.query(BomWos).filter(BomWos.brgNoValue == brgNoValue).first()
        if not bom_wos_obj:
            failed_rows.append({"row": row_index + 2, "reason": f"brgNoValue '{brgNoValue}' not found in BomWos"})
            continue

        #Insert PartAssy
        part_assy = PartAssy(
            bomWosId=bom_wos_obj.id,
            partFac1="1"
        )
        db.add(part_assy)
        inserted += 1
        inserted_rows.append(row)

    db.commit()

    #print fail
    # print("Show fail record")
    # print(failed_rows)

    return {
        "status": "success",
        "inserted": inserted,
        "failed_rows": failed_rows
    }

@app.post("/data_management/fac3/upload/")
async def fac3(file: UploadFile = File(...), db: Session = Depends(get_db)):
    #variable count
    inserted = 0
    failed_rows = []
    inserted_rows = []

    #read raw file
    contents = await file.read()
    
    # #check file name
    if not checkfilename(file.filename, "fac3"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'fac3'")
    
    #check file type
    if not checkfiletype(file.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if file.filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(contents))
    else:
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

    #delete coloum not header
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(df, "fac3")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check unknown
    is_valid, message = checkunknown(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    #INSERT
    #loop check and insert
    for row_index, row in enumerate(df.to_dict(orient="records")):
        #select row with coloum
        brgNoValue = row.get("brgNoValue")
        groupBrgNoValue = row.get("groupBrgNoValue")
        #check information complete
        if not all([brgNoValue, groupBrgNoValue]):
            failed_rows.append({"row": row_index + 2, "reason": "Missing required data"})
            continue

        #find bomwosId
        bom_wos_obj = db.query(BomWos).filter(BomWos.brgNoValue == brgNoValue).first()
        if not bom_wos_obj:
            failed_rows.append({"row": row_index + 2, "reason": f"brgNoValue '{brgNoValue}' not found in BomWos"})
            continue

        #Insert PartAssy
        part_assy = PartAssy(
            bomWosId=bom_wos_obj.id,
            partFac3="1"
        )
        db.add(part_assy)
        inserted += 1
        inserted_rows.append(row)

    db.commit()

    #print fail
    # print("show fail")
    # print(failed_rows)

    return {
        "status": "success",
        "inserted": inserted,
        "failed_rows": failed_rows
    }

@app.post("/data_management/sleeveAndThrustBrg/upload/")
async def sleeveAndThrustBrg(file: UploadFile = File(...), db: Session = Depends(get_db)):
    #variable count
    inserted = 0
    failed_rows = []
    inserted_rows = []

    #read raw file
    contents = await file.read()
    
    # #check file name
    if not checkfilename(file.filename, "sleeveAndThrustBrg"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'sleeveAndThrustBrg'")
    
    #check file type
    if not checkfiletype(file.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if file.filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(contents))
    else:
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

    #delete coloum not header
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(df, "sleeveAndThrustbrg")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check unknown
    is_valid, message = checkunknown(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    #INSERT
    #loop check and insert
    for row_index, row in enumerate(df.to_dict(orient="records")):
        #select row with coloum
        brgNoValue = row.get("brgNoValue")
        groupBrgNoValue = row.get("groupBrgNoValue")
        #check information complete
        if not all([brgNoValue, groupBrgNoValue]):
            failed_rows.append({"row": row_index + 2, "reason": "Missing required data"})
            continue

        #find bomwosId
        bom_wos_obj = db.query(BomWos).filter(BomWos.brgNoValue == brgNoValue).first()
        if not bom_wos_obj:
            failed_rows.append({"row": row_index + 2, "reason": f"brgNoValue '{brgNoValue}' not found in BomWos"})
            continue

        #Insert PartAssy
        part_assy = PartAssy(
            bomWosId=bom_wos_obj.id,
            sleeveAndThrustBrg="1"
        )
        db.add(part_assy)
        inserted += 1
        inserted_rows.append(row)

    db.commit()

    #print fail
    # print("show fail")
    # print(failed_rows)

    return {
        "status": "success",
        "inserted": inserted,
        "failed_rows": failed_rows
    }

@app.post("/data_management/toolLimitAndCapa/upload/")
async def toolLimitAndCapa(file: UploadFile = File(...), db: Session = Depends(get_db)):
    #variable count
    inserted = 0
    failed_rows = []
    failed_rows_brg = []
    failed_rows_machine = []
    failed_rows_brg = []

    #read raw file
    contents = await file.read()
    
    # #check file name
    if not checkfilename(file.filename, "toolLimitAndCapa"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'toolLimitAndCapa'")
    
    #check file type
    if not checkfiletype(file.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if file.filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(contents))
    else:
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

    #delete coloum not header
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(df, "toolLimitAndCapa")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    #check number
    is_valid, message = checknumber(df, ['capaDay', 'cycleTime','utilizeMc'])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check empty
    is_valid, message = checkempty(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check unknown
    is_valid, message = checkunknown(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    #INSERT
    #loop check and insert
    for row_index, row in enumerate(df.to_dict(orient="records")):
        #select row with coloum
        brgNoValue = row.get("brgNoValue")
        groupBrgNoValue = row.get("groupBrgNoValue")
        machineGroup = row.get("machineGroup")
        machineType = row.get("machineType")
        machineNo = row.get("machineNo")
        groupBrgAndMcGroup = row.get("groupBrgAndMcGroup")
        limitByType = row.get("limitByType")
        limitByGroup = row.get("limitByGroup")
        joinToolingPartNo = row.get("joinToolingPartNo")
        capaDay = row.get("capaDay")
        utilizeMc = row.get("utilizeMc")
        cycleTime = row.get("cycleTime")
        capaF3 = row.get("capaF3")

        #check information complete
        # if not all([brgNoValue, groupBrgNoValue]):
        #     failed_rows.append({"row": row_index + 2, "reason": "Missing required data"})
        #     continue

        #find bomwosId
        bom_wos_obj = db.query(BomWos).filter(BomWos.brgNoValue == brgNoValue).first()
        #if not see alert error
        if not bom_wos_obj:
            failed_rows.append({"row": row_index + 2, "reason": f"brgNoValue '{brgNoValue}' not found in BomWos"})
            failed_rows_brg.append(brgNoValue)
            continue
        #find id machine layout
        machine_layout = db.query(MachineLayout).filter(MachineLayout.machineNo == machineNo).first()
        #if not see alert error
        if not machine_layout:
            failed_rows.append({"row": row_index + 2, "reason": f"machineNo '{machineNo}' not found in MachineLayout"})
            continue
        #find id machine type
        machine_type = db.query(MachineType).filter(MachineType.machineType == machineType).first()
        #if not see alert error
        if not machine_type:
            failed_rows.append({"row": row_index + 2, "reason": f"machineType '{machineType}' not found in MachineType"})
            continue

        #find Machine.id from machineGroup + machineType.id + machineLayout.id
        machine_obj = db.query(Machine).filter(
            Machine.machineGroup == machineGroup,
            Machine.machineTypeId == machine_type.id,
            Machine.machineLayoutId == machine_layout.id
        ).first()
        #if not see alert error
        if not machine_obj:
            failed_rows.append({"row": row_index + 2, "reason": "Machine not found from combination of group, type, layout"})
            failed_rows_machine.append(machine_obj.id)
            continue

        #find LimitAssy
        limit_assy_obj = db.query(LimitAssy).filter(LimitAssy.limitByType == limitByType,LimitAssy.limitByGroup == limitByGroup,LimitAssy.joinToolingPartNo == joinToolingPartNo).first()
        #if not see insert LimitAssy
        if not limit_assy_obj:
            limit_assy_obj = LimitAssy(limitByType=limitByType,limitByGroup=limitByGroup,joinToolingPartNo=joinToolingPartNo)
            db.add(limit_assy_obj)
            db.commit()
            db.refresh(limit_assy_obj)


        #insert capacity
        capacity = Capacity(
            bomWosId=bom_wos_obj.id,
            machineId=machine_obj.id,
            groupBrgAndMcGroup=groupBrgAndMcGroup,
            capaDay=capaDay,
            utilizeMc=utilizeMc,
            cycleTime=cycleTime,
            capaF3=capaF3
        )
        db.add(capacity)
        db.commit()
        db.refresh(capacity)
        inserted += 1

        #find JoinLimitAssy
        join_limit_assy = db.query(JoinLimitAssy).filter(JoinLimitAssy.capacityId == capacity.id,JoinLimitAssy.limitAssyId == limit_assy_obj.id).first()
        #if not see insert JoinLimitAssy with Capacity.id and LimitAssy.id
        if not join_limit_assy:
            join_limit_assy = JoinLimitAssy(capacityId=capacity.id,limitAssyId=limit_assy_obj.id)
            db.add(join_limit_assy)
            db.commit()
    print("\nFaild Rows:BomWos.id")
    pprint(failed_rows_brg)
    print("\nFaild Rows:Machine.id")
    pprint(failed_rows_machine)
    return {
        "status": "success",
        # "inserted": inserted,
        # "failed_rows": failed_rows
    }

@app.post("/data_management/workingDate/upload/")
async def working_date(file: UploadFile = File(...), db: Session = Depends(get_db)):
    #check file working_date
    #read raw file
    working_date_contents = await file.read()

    # #check file name
    if not checkfilename(file.filename, "workingDate"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'workingDate'")
    
    #check file type
    if not checkfiletype(file.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if file.filename.endswith(".csv"):
        working_date_df = pd.read_csv(BytesIO(working_date_contents))
    else:
        working_date_df = pd.read_excel(BytesIO(working_date_contents), engine="openpyxl")
    #delete coloum not header
    working_date_df = working_date_df.loc[:, ~working_date_df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(working_date_df, "workingDate")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    #check number
    is_valid, message = checknumber(working_date_df, ["workingHr"])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    # check date
    is_valid, message = checkdate(working_date_df, ["workingDate"])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check empty
    is_valid, message = checkempty(working_date_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check unknown
    is_valid, message = checkunknown(working_date_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    #variable WorkingDate
    inserted_rows_WorkingDate = []
    inserted_WorkingDate = 0

    #select last rev
    last_rev = db.query(WorkingDate.rev).order_by(WorkingDate.rev.desc()).first()
    rev = last_rev[0] + 1 if last_rev else 1

    #insert WorkingDate
    for row in working_date_df.to_dict(orient="records"):
        workingDate = row.get("workingDate")
        workingHr = row.get("workingHr")
        
        #insert new record
        new_layout = WorkingDate(
            rev=rev,
            workingDate=workingDate,
            workingHr=workingHr
        )
        db.add(new_layout)
        inserted_WorkingDate += 1
        inserted_rows_WorkingDate.append(row)

    db.commit()
    return {"status": "success"}


@app.get("/data_management/bomWos/", response_model=list[dict])
def get_all_bomWos(db: Session = Depends(get_db)):
    #select BomWos
    records = db.query(BomWos).all()
    return [
        {
            "id": row.id,
            "wosNo": row.wosNo,
            "brgNoValue": row.brgNoValue,
            "partNoValue": row.partNoValue,
            "partComponentGroup": row.partComponentGroup,
            "qty": row.qty,
            "parentPartNo": row.parentPartNo,
            "updatedAt": row.updatedAt,
        }
        for row in records
    ]

@app.get("/data_management/machineGroup/", response_model=list[dict])
def get_all_machine_groups(db: Session = Depends(get_db)):
    #select Machine
    machines = db.query(Machine).all()
    #variable
    results = []

    for m in machines:
        #select MachineType
        type_row = db.query(MachineType).filter(MachineType.id == m.machineTypeId).first() if m.machineTypeId else None
        machine_type_name = type_row.machineType.strip() if type_row and type_row.machineType else None

        #select MachineLayout
        # layout_row = db.query(MachineLayout).filter(MachineLayout.id == m.machineLayoutId).first() if m.machineLayoutId else None
        # layout_name = (
        #     f"Line {layout_row.lineNo}, No {layout_row.machineNo.strip()}"
        #     if layout_row and layout_row.machineNo else None
        # )
        #select Machine with MachineType and MachineLayout
        results.append({
            "id": m.id,
            "machineGroup": m.machineGroup.strip() if m.machineGroup else None,
            "machineType": machine_type_name,
            # "machineLayout": layout_name,
            "updatedAt": m.updatedAt,
        })

    return results

@app.get("/data_management/machineLayout/", response_model=list[dict])
def get_all_machine_layout(db: Session = Depends(get_db)):
    #select Machine
    machineslayout = db.query(MachineLayout).all()
    return [
        {
            "id": row.id,
            "lineNo": row.lineNo,
            "machineNo": row.machineNo,
            "locationNo": row.locationNo,
        }
        for row in machineslayout
    ]

@app.get("/data_management/toolLimitAndCapa/", response_model=list[dict])
def get_all_tool_limit_and_capa(db: Session = Depends(get_db)):
    capacities = (
        db.query(Capacity)
        .options(
            joinedload(Capacity.bomWos),
            joinedload(Capacity.machine).joinedload(Machine.machineLayout),
            joinedload(Capacity.machine).joinedload(Machine.machineType),
            joinedload(Capacity.join_limit_assies).joinedload(JoinLimitAssy.limitAssy)
        )
        .all()
    )
    print("----------------------------------")
    results = []
    for cap in capacities:
        bom = cap.bomWos
        machine = cap.machine
        layout = machine.machineLayout if machine else None
        mtype = machine.machineType if machine else None
        join_limit = cap.join_limit_assies[0] if cap.join_limit_assies else None
        limit = join_limit.limitAssy if join_limit else None

        results.append({
            "id": cap.id,
            "brgNoValue": bom.brgNoValue,
            "machineGroup": machine.machineGroup,
            "machineType": mtype.machineType,
            "machineNo": layout.machineNo,
            "limitByType": limit.limitByType,
            "limitByGroup": limit.limitByGroup,
            "joinToolingPartNo": limit.joinToolingPartNo,
            "capaDay": cap.capaDay,
            "utilizeMc": cap.utilizeMc,
            "cycleTime": cap.cycleTime,
            "capaF3": cap.capaF3,
        })

    return results

@app.get("/data_management/fac1/", response_model=list[dict])
def get_all_fac_1(db: Session = Depends(get_db)):
    #select fac1 in PartAssy
    fac1 = db.query(PartAssy).filter(PartAssy.partFac1 == "1").all()
    #variable
    results = []

    for assy in fac1:
        #select BomWos with bomwosId
        bom = db.query(BomWos).filter(BomWos.id == assy.bomWosId).first()

        results.append({
            "brgNoValue": bom.brgNoValue if bom else None,
            "parentPartNo": bom.parentPartNo if bom else None,
            "partFac1": assy.partFac1,
            # "updatedAt": assy.updatedAt,
        })

    return results

@app.get("/data_management/fac3/", response_model=list[dict])
def get_all_fac_3(db: Session = Depends(get_db)):
    # select fac3 in PartAssy
    fac3 = db.query(PartAssy).filter(PartAssy.partFac3 == "1").all()
    results = []

    for assy in fac3:
        # select BomWos with bomWosId
        bom = db.query(BomWos).filter(BomWos.id == assy.bomWosId).first()

        results.append({
            "brgNoValue": bom.brgNoValue if bom else None,
            "parentPartNo": bom.parentPartNo if bom else None,
            "partFac3": assy.partFac3,
            # "updatedAt": assy.updatedAt,
        })

    return results

@app.get("/data_management/sleeveAndThrustBrg/", response_model=list[dict])
def get_all_sleeve_and_thrust_brg(db: Session = Depends(get_db)):
    # select sleeveAndThrustBrg in PartAssy
    sleeveAndThrustBrg = db.query(PartAssy).filter(PartAssy.sleeveAndThrustBrg == "1").all()
    results = []

    for assy in sleeveAndThrustBrg:
        # select BomWos with bomWosId
        bom = db.query(BomWos).filter(BomWos.id == assy.bomWosId).first()

        results.append({
            "brgNoValue": bom.brgNoValue if bom else None,
            "parentPartNo": bom.parentPartNo if bom else None,
            "partFac3": assy.partFac3,
            # "updatedAt": assy.updatedAt,
        })

    return results

@app.post("/data_management/monthy/upload/")
async def upload_monthy_files(
    mid_small: UploadFile = File(..., alias="balanceOrderMidSmall"),
    machine_not_available: UploadFile = File(..., alias="machineNotAvailable"),
    production_plan: UploadFile = File(..., alias="productionPlan"),
    kpi_setup: UploadFile = File(..., alias="kpiSetup"),
    kpi_production: UploadFile = File(..., alias="kpiProduction"),
    working_date: UploadFile = File(..., alias="workingDate"),
    wip_assy: UploadFile = File(..., alias="wipAssy"),
    db: Session = Depends(get_db),
):
    #check file mid_small
    #read raw file
    mid_small_contents = await mid_small.read()

    # #check file name
    if not checkfilename(mid_small.filename, "balanceOrderMidSmall"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'balanceOrderMidSmall'")
    
    #check file type
    if not checkfiletype(mid_small.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if mid_small.filename.endswith(".csv"):
        mid_small_df = pd.read_csv(BytesIO(mid_small_contents))
    else:
        mid_small_df = pd.read_excel(BytesIO(mid_small_contents), engine="openpyxl")
    #delete coloum not header
    mid_small_df = mid_small_df.loc[:, ~mid_small_df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(mid_small_df, "balanceOrderMidSmall")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(mid_small_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    #check number
    is_valid, message = checknumber(mid_small_df, ['balanceOrder'])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check date
    is_valid, message = checkdate(mid_small_df, ["dueDate"])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check unknown
    is_valid, message = checkunknown(mid_small_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
#-------------------------------------------------------------------------------------------------------------
    #check file machine_not_available
    #read raw file
    machine_not_available_contents = await machine_not_available.read()

    # #check file name
    if not checkfilename(machine_not_available.filename, "machineNotAvailable"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'machineNotAvailable'")
    
    #check file type
    if not checkfiletype(machine_not_available.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if machine_not_available.filename.endswith(".csv"):
        machine_not_available_df = pd.read_csv(BytesIO(machine_not_available_contents))
    else:
        machine_not_available_df = pd.read_excel(BytesIO(machine_not_available_contents), engine="openpyxl")
    #delete coloum not header
    machine_not_available_df = machine_not_available_df.loc[:, ~machine_not_available_df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(machine_not_available_df, "machineNotAvailable")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(machine_not_available_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check unknown
    is_valid, message = checkunknown(machine_not_available_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
#-------------------------------------------------------------------------------------------------------------
    #check file production_plan
    #read raw file
    production_plan_contents = await production_plan.read()

    # #check file name
    if not checkfilename(production_plan.filename, "productionPlan"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'productionPlan'")
    
    #check file type
    if not checkfiletype(production_plan.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if production_plan.filename.endswith(".csv"):
        production_plan_df = pd.read_csv(BytesIO(production_plan_contents))
    else:
        production_plan_df = pd.read_excel(BytesIO(production_plan_contents), engine="openpyxl")
    #delete coloum not header
    production_plan_df = production_plan_df.loc[:, ~production_plan_df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(production_plan_df, "productionPlan")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(production_plan_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check unknown
    is_valid, message = checkunknown(production_plan_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
#-------------------------------------------------------------------------------------------------------------
    #check file kpi_setup
    #read raw file
    kpi_setup_contents = await kpi_setup.read()

    # #check file name
    if not checkfilename(kpi_setup.filename, "kpiSetup"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'kpiSetup'")
    
    #check file type
    if not checkfiletype(kpi_setup.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if kpi_setup.filename.endswith(".csv"):
        kpi_setup_df = pd.read_csv(BytesIO(kpi_setup_contents))
    else:
        kpi_setup_df = pd.read_excel(BytesIO(kpi_setup_contents), engine="openpyxl")
    #delete coloum not header
    kpi_setup_df = kpi_setup_df.loc[:, ~kpi_setup_df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(kpi_setup_df, "kpiSetup")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    #check number
    is_valid, message = checknumber(kpi_setup_df, ['setupAverage', 'maxSetUpPerDay'])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check empty
    is_valid, message = checkempty(kpi_setup_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check unknown
    is_valid, message = checkunknown(kpi_setup_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
#-------------------------------------------------------------------------------------------------------------
    #check file kpi_production
    #read raw file
    kpi_production_contents = await kpi_production.read()

    # #check file name
    if not checkfilename(kpi_production.filename, "kpiProduction"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'kpiProduction'")
    
    #check file type
    if not checkfiletype(kpi_production.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if kpi_production.filename.endswith(".csv"):
        kpi_production_df = pd.read_csv(BytesIO(kpi_production_contents))
    else:
        kpi_production_df = pd.read_excel(BytesIO(kpi_production_contents), engine="openpyxl")
    #delete coloum not header
    kpi_production_df = kpi_production_df.loc[:, ~kpi_production_df.columns.str.contains("^Unnamed")]
    
    # #check header
    is_valid, message = checkheader(kpi_production_df, "kpiProduction")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    #check number
    is_valid, message = checknumber(kpi_production_df, ['autoMachineDailyTarget', 'manualDailyTarget'])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(kpi_production_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    # check unknown
    is_valid, message = checkunknown(kpi_production_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
#-------------------------------------------------------------------------------------------------------------
    #check file working_date
    #read raw file
    working_date_contents = await working_date.read()

    # #check file name
    if not checkfilename(working_date.filename, "workingDate"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'workingDate'")
    
    #check file type
    if not checkfiletype(working_date.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if working_date.filename.endswith(".csv"):
        working_date_df = pd.read_csv(BytesIO(working_date_contents))
    else:
        working_date_df = pd.read_excel(BytesIO(working_date_contents), engine="openpyxl")
    #delete coloum not header
    working_date_df = working_date_df.loc[:, ~working_date_df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(working_date_df, "workingDate")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    #check number
    is_valid, message = checknumber(working_date_df, ["workingHr"])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    # check date
    is_valid, message = checkdate(working_date_df, ["workingDate"])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check empty
    is_valid, message = checkempty(working_date_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check unknown
    is_valid, message = checkunknown(working_date_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
#-------------------------------------------------------------------------------------------------------------
    #check file wip_assy
    #read raw file
    wip_assy_contents = await wip_assy.read()

    # #check file name
    if not checkfilename(wip_assy.filename, "wipAssy"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'wipAssy'")
    
    #check file type
    if not checkfiletype(wip_assy.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if wip_assy.filename.endswith(".csv"):
        wip_assy_df = pd.read_csv(BytesIO(wip_assy_contents))
    else:
        wip_assy_df = pd.read_excel(BytesIO(wip_assy_contents), engine="openpyxl")
    #delete coloum not header
    wip_assy_df = wip_assy_df.loc[:, ~wip_assy_df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(wip_assy_df, "wipAssy")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(wip_assy_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    #check number
    is_valid, message = checknumber(wip_assy_df, ['qty'])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check unknown
    is_valid, message = checkunknown(wip_assy_df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
#-------------------------------------------------------------------------------------------------------------
    #variable BalanceOrderMidSmall
    inserted_rows_BalanceOrderMidSmall = []
    inserted_BalanceOrderMidSmall = 0
    failed_rows_BalanceOrderMidSmall = []
    #select last rev
    last_rev = db.query(BalanceOrderMidSmall.rev).order_by(BalanceOrderMidSmall.rev.desc()).first()
    rev = last_rev[0] + 1 if last_rev else 1

    #insert BalanceOrderMidSmall
    for row in mid_small_df.to_dict(orient="records"):
        targetPlanMonth = row.get("targetPlanMonth")
        orderNo = row.get("orderNo")
        dueDate = row.get("dueDate")
        balanceOrder = row.get("balanceOrder")
        partGroup = row.get("partGroup")
        wosNo = row.get("wosNo")

        #find bomwos
        bom_wos_obj = db.query(BomWos).filter(BomWos.wosNo == wosNo).first()
        if not bom_wos_obj:
            failed_rows_BalanceOrderMidSmall.append({"row": row + 2, "reason": f"wosNo '{wosNo}' not found in BomWos"})
            continue
        
        #insert new record
        new_layout = BalanceOrderMidSmall(
            rev=rev,
            targetPlanMonth=targetPlanMonth,
            orderNo=orderNo,
            dueDate=dueDate,
            balanceOrder=balanceOrder,
            partGroup=partGroup,
            bomWosId=bom_wos_obj.id,
        )
        db.add(new_layout)
        inserted_BalanceOrderMidSmall += 1
        inserted_rows_BalanceOrderMidSmall.append(row)

    db.commit()
#-------------------------------------------------------------------------------------------------------------
    #variable MachineNotAvailable
    inserted_rows_MachineNotAvailable = []
    inserted_MachineNotAvailable = 0
    #select last rev
    last_rev = db.query(MachineNotAvailable.rev).order_by(MachineNotAvailable.rev.desc()).first()
    rev = last_rev[0] + 1 if last_rev else 1

    #insert MachineNotAvailable
    for row in machine_not_available_df.to_dict(orient="records"):
        machineNo = row.get("machineNo")

        #find machineLayout.id
        machine_layout_obj = db.query(MachineLayout).filter(MachineLayout.machineNo == machineNo).first()
        if not machine_layout_obj:
            print(f"❌ MachineType not found for machineNo: {machineNo}")
            continue

        #find machine.id
        machine_obj = db.query(Machine).filter(Machine.machineLayoutId == machine_layout_obj.id).first()
        if not machine_obj:
            print(f"❌ Machine not found for machineTypeId: {machine_obj.id}")
            continue       

        #insert new record
        new_layout = MachineNotAvailable(
            rev=rev,
            machineId=machine_obj.id,
        )
        db.add(new_layout)
        inserted_MachineNotAvailable += 1
        inserted_rows_MachineNotAvailable.append(row)

    db.commit()
#-------------------------------------------------------------------------------------------------------------
    #variable ProductionPlan
    inserted_rows_ProductionPlan = []
    inserted_ProductionPlan = 0

    #select last rev
    last_rev = db.query(ProductionPlan.rev).order_by(ProductionPlan.rev.desc()).first()
    rev = last_rev[0] + 1 if last_rev else 1

    #insert ProductionPlan
    for row in production_plan_df.to_dict(orient="records"):
        machineNo = row.get("machineNo")
        brgNoValue = row.get("brgNoValue")

        #find bomwos
        bom_wos_obj = db.query(BomWos).filter(BomWos.brgNoValue == brgNoValue).first()
        if not bom_wos_obj:
            inserted_rows_ProductionPlan.append({"row": row, "reason": f"wosNo '{brgNoValue}' not found in BomWos"})
            continue

        #find machineLayout.id
        machine_layout_obj = db.query(MachineLayout).filter(MachineLayout.machineNo == machineNo).first()
        if not machine_layout_obj:
            print(f"❌ MachineType not found for machineNo: {machineNo}")
            continue

        #find machine.id
        machine_obj = db.query(Machine).filter(Machine.machineLayoutId == machine_layout_obj.id).first()
        if not machine_obj:
            print(f"❌ Machine not found for machineTypeId: {machine_obj.id}")
            continue       

        #insert new record
        new_layout = ProductionPlan(
            rev=rev,
            machineId=machine_obj.id,
            bomWosId=bom_wos_obj.id
        )
        db.add(new_layout)
        inserted_ProductionPlan += 1
        inserted_rows_ProductionPlan.append(row)

    db.commit()
#-------------------------------------------------------------------------------------------------------------
    #variable KpiSetup
    inserted_rows_KpiSetupe = []
    inserted_KpiSetup = 0
    #select last rev
    last_rev = db.query(KpiSetup.rev).order_by(KpiSetup.rev.desc()).first()
    rev = last_rev[0] + 1 if last_rev else 1

    #insert KpiSetup
    for row in kpi_setup_df.to_dict(orient="records"):
        machineGroup = row.get("machineGroup")
        setupAverage = row.get("setupAverage")
        maxSetUpPerDay = row.get("maxSetUpPerDay")

        # แปลงเป็น int ถ้าเป็นตัวเลขล้วน (กันเคส type ไม่ตรง)
        if isinstance(machineGroup, str) and machineGroup.isdigit():
            machineGroup = int(machineGroup)

        # simple query: เทียบค่า machineGroup ตรงๆ แล้วเอามาทั้งหมด
        machines = db.query(Machine).filter(Machine.machineGroup == machineGroup).all()
        if not machines:
            print(f"❌ machineGroup not found: {machineGroup}")
            continue

        for m in machines:
            new_layout = KpiSetup(
                rev=rev,
                machineId=m.id,
                setupAverage=setupAverage,
                maxSetUpPerDay=maxSetUpPerDay
            )
            db.add(new_layout)
            inserted_KpiSetup += 1
            inserted_rows_KpiSetupe.append({**row, "machineId": m.id})

    db.commit()
#-------------------------------------------------------------------------------------------------------------
    #variable KpiProduction
    inserted_rows_KpiProduction = []
    inserted_KpiProduction = 0
    #select last rev
    last_rev = db.query(KpiProduction.rev).order_by(KpiProduction.rev.desc()).first()
    rev = last_rev[0] + 1 if last_rev else 1

    #insert KpiProduction
    for row in kpi_production_df.to_dict(orient="records"):
        autoMachineDailyTarget = row.get("autoMachineDailyTarget")
        manualDailyTarget = row.get("manualDailyTarget")
    
        #insert new record
        new_layout = KpiProduction(
            rev=rev,
            autoMachineDailyTarget=autoMachineDailyTarget,
            manualDailyTarget=manualDailyTarget,
        )
        db.add(new_layout)
        inserted_KpiProduction += 1
        inserted_rows_KpiProduction.append(row)

    db.commit()
#-------------------------------------------------------------------------------------------------------------
    #variable WorkingDate
    inserted_rows_WorkingDate = []
    inserted_WorkingDate = 0

    #select last rev
    last_rev = db.query(WorkingDate.rev).order_by(WorkingDate.rev.desc()).first()
    rev = last_rev[0] + 1 if last_rev else 1

    #insert WorkingDate
    for row in working_date_df.to_dict(orient="records"):
        workingDate = row.get("workingDate")
        workingHr = row.get("workingHr")
        
        #insert new record
        new_layout = WorkingDate(
            rev=rev,
            workingDate=workingDate,
            workingHr=workingHr
        )
        db.add(new_layout)
        inserted_WorkingDate += 1
        inserted_rows_WorkingDate.append(row)

    db.commit()
#-------------------------------------------------------------------------------------------------------------
    # variable wip_assy
    inserted_rows_WipAssy = []
    inserted_WipAssy = 0
    skipped_rows_WipAssy = []
    skipped_WipAssy = 0

    # select last rev
    last_rev = db.query(WipAssy.rev).order_by(WipAssy.rev.desc()).first()
    rev = last_rev[0] + 1 if last_rev else 1

    # insert WipAssy
    for row in wip_assy_df.to_dict(orient="records"):
        brgNoValue = row.get("brgNoValue")
        wosNo = row.get("wosNo")
        processValue = row.get("processValue")
        qty = row.get("qty")
        wipType = row.get("wipType")

        #find bomwos
        bom_wos_obj = db.query(BomWos).filter(BomWos.wosNo == wosNo).first()
        if not bom_wos_obj:
            continue

        if not bom_wos_obj:
            skipped_WipAssy += 1
            skipped_rows_WipAssy.append(row)
            continue

        new_layout = WipAssy(
            rev=rev, 
            processValue=processValue,
            qty=qty,
            wipType=wipType,
            bomWosId=bom_wos_obj.id,
        )
        db.add(new_layout)
        inserted_WipAssy += 1
        inserted_rows_WipAssy.append(row)

    db.commit()
#-------------------------------------------------------------------------------------------------------------
    return {"status": "success"}

@app.get("/data_management/balanceOrderMidSmall/", response_model=list[dict])
def get_all_balanceOrderMidSmall(db: Session = Depends(get_db)):
    #select last rev
    max_rev = db.query(func.max(BalanceOrderMidSmall.rev)).scalar()
    if max_rev is None:
        return []
    #select balanceOrderMidSmall
    rows = (db.query(BalanceOrderMidSmall).filter(BalanceOrderMidSmall.rev == max_rev).order_by(BalanceOrderMidSmall.id.asc()).all())
    return [
        {
            # "id": r.id,
            # "rev": r.rev,
            "targetPlanMonth": r.targetPlanMonth,
            "orderNo": r.orderNo,
            "dueDate": r.dueDate,
            "balanceOrder": r.balanceOrder,
            "partGroup": r.partGroup,
            "bomWosId": r.bomWosId,
        }
        for r in rows
    ]

@app.get("/data_management/machineNotAvailable/", response_model=list[dict])
def get_all_machineNotAvailable(db: Session = Depends(get_db)):
    #select last rev
    max_rev = db.query(func.max(MachineNotAvailable.rev)).scalar()
    if max_rev is None:
        return []
    #select machineNotAvailable
    rows = (db.query(MachineNotAvailable).filter(MachineNotAvailable.rev == max_rev).order_by(MachineNotAvailable.id.asc()).all())
    return [
        {
            # "id": r.id,
            # "rev": r.rev,
            "machineId": r.machineId,
        }
        for r in rows
    ]

@app.get("/data_management/productionPlan/", response_model=list[dict])
def get_all_productionPlan(db: Session = Depends(get_db)):
    #select last rev
    max_rev = db.query(func.max(ProductionPlan.rev)).scalar()
    if max_rev is None:
        return []
    #select productionPlan
    rows = (db.query(ProductionPlan).filter(ProductionPlan.rev == max_rev).order_by(ProductionPlan.id.asc()).all())
    return [
        {
            # "id": r.id,
            # "rev": r.rev,
            "machineId": r.machineId,
            "bomWosId": r.bomWosId,
        }
        for r in rows
    ]

@app.get("/data_management/kpiSetup/", response_model=list[dict])
def get_all_kpiSetup(db: Session = Depends(get_db)):
    #select last rev
    max_rev = db.query(func.max(KpiSetup.rev)).scalar()
    if max_rev is None:
        return []
    # เตรียม subquery ใส่ row_number() ต่อ machineGroup
    base = (
        db.query(
            KpiSetup.setupAverage.label("setupAverage"),
            KpiSetup.maxSetUpPerDay.label("maxSetUpPerDay"),
            Machine.machineGroup.label("machineGroup"),
            func.row_number()
            .over(
                partition_by=Machine.machineGroup,
                order_by=KpiSetup.id.asc()
            )
            .label("rn"),
        )
        .outerjoin(Machine, Machine.id == KpiSetup.machineId)
        .filter(KpiSetup.rev == max_rev)
    ).subquery()

    # เลือกเฉพาะแถวแรกของแต่ละ machineGroup (ตัดซ้ำ)
    rows = (
        db.query(
            base.c.setupAverage,
            base.c.maxSetUpPerDay,
            base.c.machineGroup,
        )
        .filter(base.c.rn == 1)
        .order_by(base.c.machineGroup.asc())
        .all()
    )

    return [
        {
            "machineGroup": r.machineGroup,
            "maxSetUpPerDay": r.maxSetUpPerDay,
            "setupAverage": r.setupAverage,
            
            
        }
        for r in rows
    ]

@app.get("/data_management/kpiProduction/", response_model=list[dict])
def get_all_kpiProduction(db: Session = Depends(get_db)):
    #select last rev
    max_rev = db.query(func.max(KpiProduction.rev)).scalar()
    if max_rev is None:
        return []

    #select KpiProduction
    rows = (db.query(KpiProduction).filter(KpiProduction.rev == max_rev).order_by(KpiProduction.id.asc()).all())
    return [
        {
            # "id": r.id,
            # "rev": r.rev,
            "autoMachineDailyTarget": r.autoMachineDailyTarget,
            "manualDailyTarget": r.manualDailyTarget,
        }
        for r in rows
    ]

@app.get("/data_management/workingDate/", response_model=list[dict])
def get_all_workingDate(db: Session = Depends(get_db)):
    #select last rev
    max_rev = db.query(func.max(WorkingDate.rev)).scalar()
    if max_rev is None:
        return []
    #select workingDate
    rows = (db.query(WorkingDate).filter(WorkingDate.rev == max_rev).order_by(WorkingDate.id.asc()).all())
    return [
        {
            # "id": r.id,
            # "rev": r.rev,
            "workingDate": r.workingDate,
            "workingHr": r.workingHr,
        }
        for r in rows
    ]

@app.get("/data_management/wipAssy/", response_model=list[dict])
def get_all_wip_assy(rev: int | None = None, db: Session = Depends(get_db)):
    #check last rev
    max_rev = rev if rev is not None else db.query(func.max(WipAssy.rev)).scalar()
    if max_rev is None:
        return []
    
    rows = (
        db.query(
            WipAssy.processValue.label("processValue"),
            WipAssy.qty.label("qty"),
            WipAssy.wipType.label("wipType"),
            BomWos.brgNoValue.label("brgNoValue"),
            BomWos.wosNo.label("wosNo"),
        )
        .outerjoin(BomWos, BomWos.id == WipAssy.bomWosId)  # ⬅️ หาใน BomWos ด้วย bomWosId
        .filter(WipAssy.rev == max_rev)
        .order_by(WipAssy.id.asc())
        .all()
    )
    return [
        {
            "brgNoValue": r.brgNoValue,
            "wosNo": r.wosNo,
            "processValue": r.processValue,
            "qty": int(r.qty or 0),
            "wipType": r.wipType,
        }
        for r in rows
    ]


@app.post("/data_management/create_plan/upload/")
async def Insert_plan_data(file: UploadFile = File(...), db: Session = Depends(get_db)): 
    #variable DataPlan
    inserted_rows_DataPlan = []
    inserted_DataPlan = 0
    failed_rows_DataPlan = []

    #read raw file
    contents = await file.read()

    #read flie
    if file.filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(contents))
    else:
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

    #delete coloum not header
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

    #select last rev
    last_rev = db.query(DataPlan.rev).order_by(DataPlan.rev.desc()).first()
    rev = last_rev[0] + 1 if last_rev else 1

    #insert DataPlan
    for row in df.to_dict(orient="records"):
        brgNoValue = row.get("brgNoValue")
        machineNo = row.get("machineNo")
        workingDate = row.get("workingDate")
        planTarget = row.get("planTarget")
        isMachineContinue = row.get("isMachineContinue")
        planType = row.get("planType")

        #find bomwos
        bom_wos_obj = db.query(BomWos).filter(BomWos.brgNoValue == brgNoValue).first()
        if not bom_wos_obj:
            failed_rows_DataPlan.append({"row": row + 2, "reason": f"wosNo '{brgNoValue}' not found in BomWos"})
            continue

        #find machineLayout.id
        machine_layout_obj = db.query(MachineLayout).filter(MachineLayout.machineNo == machineNo).first()
        if not machine_layout_obj:
            print(f"❌ MachineType not found for machineNo: {machineNo}")
            continue

        #find machine.id
        machine_obj = db.query(Machine).filter(Machine.machineLayoutId == machine_layout_obj.id).first()
        if not machine_obj:
            print(f"❌ Machine not found for machineTypeId: {machine_obj.id}")
            continue       

        #insert new record
        new_layout = ProductionPlan(
            rev=rev,
            machineId=machine_obj.id,
            bomWosId=bom_wos_obj.id,
            workingDate=workingDate,
            planTarget=planTarget,
            isMachineContinue=isMachineContinue,
            planType=planType
        )
        db.add(new_layout)
        inserted_DataPlan += 1
        inserted_rows_DataPlan.append(row)

    db.commit()
    return {"status": "success"}

@app.get("/data_menagement/plan_result/get", response_model=list[dict])
def get_plan_result(
    rev: int | None = None,
    brgNoValue: str | None = None,
    machineNo: str | None = None,
    db: Session = Depends(get_db),
):
    plans = (
        db.query(DataPlan)
        .options(
            joinedload(DataPlan.bomWos),                          
            joinedload(DataPlan.machine).joinedload(Machine.machineLayout), 
        )
        .order_by(DataPlan.rev.desc(), DataPlan.workingDate.asc())
        .all()
    )

    results: list[dict] = []
    for p in plans:
        bom = getattr(p, "bomWos", None)
        mc  = getattr(p, "machine", None)
        layout = getattr(mc, "machineLayout", None)

        # ฟิลเตอร์แบบง่ายฝั่ง Python
        if rev is not None and p.rev != rev:
            continue
        if brgNoValue and (not bom or bom.brgNoValue != brgNoValue):
            continue
        if machineNo and (not layout or layout.machineNo != machineNo):
            continue

        results.append({
            "id": p.id,
            "brgNoValue": bom.brgNoValue if bom else None,
            "machineNo": layout.machineNo if layout else None,
            "workingDate": p.workingDate,
            "planTarget": p.planTarget,
            "isMachineContinue": p.isMachineContinue,
            "rev": p.rev,
            "planType": p.planType,
            "updatedAt": getattr(p, "updatedAt", None),
        })

    return results

@app.post("/data_management/create_approve_plan/", response_model=dict)
def create_approve_plan(
    rev: int = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    rows = db.query(DataPlan).filter(DataPlan.rev == rev).all()
    if not rows:
        raise HTTPException(404, detail=f"No DataPlan found for rev {rev}")

    # 2) ล้างข้อมูลทั้งตาราง ApproveDataPlan ก่อน
    deleted = db.query(ApproveDataPlan).delete(synchronize_session=False)
    db.flush()  # ให้คำสั่งลบถูกส่งไปก่อน (เผื่อ DB บางตัวรอ flush)

    db.query(ApproveDataPlan).filter(ApproveDataPlan.rev == rev).delete(synchronize_session=False)

    items = [ApproveDataPlan(
        rev=r.rev,
        workingDate=r.workingDate,
        planTarget=float(r.planTarget or 0),
        isMachineContinue=bool(int(r.isMachineContinue or 0)),
        planType=r.planType,
        machineId=r.machineId,
        bomWosId=r.bomWosId,
    ) for r in rows]

    db.add_all(items)
    db.commit()
    return {"status": "ok", "rev": rev, "cleared": deleted, "inserted": len(items)}

@app.get("/data_management/plan_wos_qty/", response_model=list[dict])
def get_plan_wos_qty(rev: int | None = None, db: Session = Depends(get_db)):
    # ใช้ rev ล่าสุดของ ApproveDataPlan ถ้าไม่ส่งมา
    max_rev = rev if rev is not None else db.query(func.max(ApproveDataPlan.rev)).scalar()
    if max_rev is None:
        return []

    # (ออปชัน) ใช้ rev ล่าสุดของ BalanceOrderMidSmall ด้วยกันข้อมูลเก่า
    bal_max_rev = db.query(func.max(BalanceOrderMidSmall.rev)).scalar()

    q = (
        db.query(
            BalanceOrderMidSmall.targetPlanMonth.label("targetPlanMonth"),
            func.count(func.distinct(BomWos.wosNo)).label("wosQty"),
        )
        # เอาเฉพาะ BOM ที่ถูกอนุมัติใน ApproveDataPlan (rev ล่าสุด)
        .join(ApproveDataPlan, ApproveDataPlan.bomWosId == BalanceOrderMidSmall.bomWosId)
        # ไปดู wosNo จากตาราง BomWos
        .join(BomWos, BomWos.id == BalanceOrderMidSmall.bomWosId)
        .filter(ApproveDataPlan.rev == max_rev)
        # กันค่าที่ว่าง/null
        .filter(BomWos.wosNo.isnot(None))
        .filter(func.trim(BomWos.wosNo) != "")
    )

    if bal_max_rev is not None:
        q = q.filter(BalanceOrderMidSmall.rev == bal_max_rev)

    rows = (
        q.group_by(BalanceOrderMidSmall.targetPlanMonth)
         .order_by(BalanceOrderMidSmall.targetPlanMonth.asc())
         .all()
    )

    return [
        {"targetPlanMonth": r.targetPlanMonth, "wosQty": int(r.wosQty)}
        for r in rows
    ]

@app.get("/data_management/plan_target/", response_model=list[dict])
def get_plan_target(rev: int | None = None, db: Session = Depends(get_db)):
    # ใช้ rev ล่าสุดถ้าไม่ส่งมา
    max_rev = rev if rev is not None else db.query(func.max(ApproveDataPlan.rev)).scalar()
    if max_rev is None:
        return []

    y = extract('year', ApproveDataPlan.workingDate)
    m = extract('month', ApproveDataPlan.workingDate)

    rows = (
        db.query(
            y.label("y"),
            m.label("m"),
            func.sum(ApproveDataPlan.planTarget).label("totalPlanTarget"),
        )
        .filter(ApproveDataPlan.rev == max_rev)
        .group_by(y, m)
        .order_by(y.asc(), m.asc())
        .all()
    )

    return [
        {
            "rev": int(max_rev),
            "month": f"{int(r.y)}/{str(int(r.m)).zfill(2)}",
            "totalPlanTarget": int((r.totalPlanTarget or 0)),
        }
        for r in rows
    ]

@app.post("/data_management/actualAssy/upload")
async def Insert_actual_assy_records(file: UploadFile = File(...), db: Session = Depends(get_db)):
    #variable count
    inserted = 0
    inserted_rows = []
    failed_rows = []

    #read raw file
    contents = await file.read()
    
    # #check file name
    if not checkfilename(file.filename, "productionPlanActual"):
        raise  HTTPException(status_code=400, detail="Filename must start with 'productionPlanActual'")
    
    #check file type
    if not checkfiletype(file.filename) :
        raise  HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")
    
    #read flie
    if file.filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(contents))
    else:
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

    #delete coloum not header
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

    # #check header
    is_valid, message = checkheader(df, "productionPlanActual")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check empty
    is_valid, message = checkempty(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    #check number
    is_valid, message = checknumber(df, ['actualOutput'])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # check date
    is_valid, message = checkdate(df, ["startDate","endDate"])
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # check unknown
    is_valid, message = checkunknown(df)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    #select last rev
    last_rev = db.query(ProductionPlanActual.rev).order_by(ProductionPlanActual.rev.desc()).first()
    rev = last_rev[0] + 1 if last_rev else 1

    #insert ProductionPlanActual
    for row in df.to_dict(orient="records"):
        machineNo = row.get("machineNo")
        brgNoValue = row.get("brgNoValue")
        startDate = row.get("startDate")
        endDate = row.get("endDate")
        actualOutput = row.get("actualOutput")

        #find bomwos
        bom_wos_obj = db.query(BomWos).filter(BomWos.brgNoValue == brgNoValue).first()
        if not bom_wos_obj:
            failed_rows.append({"row": row + 2, "reason": f"wosNo '{brgNoValue}' not found in BomWos"})
            continue

        #find machineLayout.id
        machine_layout_obj = db.query(MachineLayout).filter(MachineLayout.machineNo == machineNo).first()
        if not machine_layout_obj:
            print(f"❌ machineLayout not found for machineNo: {machineNo}")
            continue

        #find machine.id
        machine_obj = db.query(Machine).filter(Machine.machineLayoutId == machine_layout_obj.id).first()
        if not machine_obj:
            print(f"❌ Machine not found for machineTypeId: {machine_obj.id}")
            continue       

        #insert new record
        new_layout = ProductionPlanActual(
            rev=rev,
            startDate=startDate,
            endDate=endDate,
            actualOutput=actualOutput,
            bomWosId=bom_wos_obj.id,
            machineId=machine_obj.id,

        )
        db.add(new_layout)
        inserted += 1
        inserted_rows.append(row)

    db.commit()
    return {"status": "success"}

@app.get("/report/plan", response_model=list[dict])
def get_plan_report(db: Session = Depends(get_db)):
    # select
    approveDataPlan = db.query(ApproveDataPlan).all()
    results = []

    for assy in approveDataPlan:
        # select BomWos with bomWosId
        bom = db.query(BomWos).filter(BomWos.id == ApproveDataPlan.bomWosId).first()

        # machine_type_name = type_row.machineType.strip() if type_row and type_row.machineType else None
        layout_row = db.query(MachineLayout).filter(MachineLayout.id == assy.machineId).first()
        
        results.append({
            "id": assy.id,
            "rev": assy.rev,
            "workingDate": assy.workingDate,
            "planTarget": assy.planTarget,
            "isMachineContinue": assy.isMachineContinue,
            "planType": assy.planType,
            "layout_row": layout_row.machineNo,
            "brgNoValue": bom.brgNoValue,
        })

    return results

@app.get("/report/actual", response_model=list[dict])
def get_actual_report(db: Session = Depends(get_db)):
    # 1) หา rev ล่าสุด
    max_rev = db.query(func.max(ProductionPlanActual.rev)).scalar()
    if max_rev is None:
        return []

    # 2) ดึงแถว actual ของ rev ล่าสุด
    rows = (db.query(ProductionPlanActual).filter(ProductionPlanActual.rev == max_rev).order_by(ProductionPlanActual.id.asc()).all()
    )
    # 3) ประกอบข้อมูลที่ต้องใช้แบบง่าย ๆ
    results = []
    for a in rows:
        bom = db.query(BomWos).filter(BomWos.id == a.bomWosId).first()
        layout = db.query(MachineLayout).filter(MachineLayout.id == a.machineId).first()
        results.append({
            "id": a.id,
            "rev": a.rev,
            "startDate": a.startDate, 
            "endDate": a.endDate,  
            "actualOutput": a.actualOutput,
            "machineNo": layout.machineNo,
            "brgNoValue": bom.brgNoValue,
        })

    return results

# ---------- MASTER: bomWos ----------
@app.delete("/data_management/bomWos/{item_id}")
def delete_bomwos(item_id: int, db: Session = Depends(get_db)):
    obj = db.get(BomWos, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="BomWos not found")
    db.delete(obj)
    db.commit()
    return {"status": "success", "deleted": 1, "id": item_id}


# ---------- MASTER: machineLayout ----------
@app.delete("/data_management/machineLayout/{item_id}")
def delete_machine_layout(item_id: int, db: Session = Depends(get_db)):
    obj = db.get(MachineLayout, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="MachineLayout not found")
    try:
        db.delete(obj)
        db.commit()
    except IntegrityError:
        db.rollback()
        # ถ้ามี FK constraint ให้ลบในตารางลูกก่อน หรือเปิด ondelete='CASCADE'
        raise HTTPException(status_code=409, detail="Cannot delete due to foreign key references")
    return {"status": "success", "deleted": 1, "id": item_id}


# ---------- MASTER: machineGroup (ลบในตาราง Machine) ----------
@app.delete("/data_management/machineGroup/{item_id}")
def delete_machine(item_id: int, db: Session = Depends(get_db)):
    obj = db.get(Machine, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Machine not found")
    try:
        db.delete(obj)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cannot delete due to foreign key references")
    return {"status": "success", "deleted": 1, "id": item_id}


# ---------- MASTER: fac1 / fac3 / sleeveAndThrustBrg (ใช้ PartAssy ตัวเดียวกัน) ----------
@app.delete("/data_management/fac1/{item_id}")
def delete_fac1(item_id: int, db: Session = Depends(get_db)):
    obj = db.get(PartAssy, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="PartAssy (fac1) not found")
    db.delete(obj)
    db.commit()
    return {"status": "success", "deleted": 1, "id": item_id}

@app.delete("/data_management/fac3/{item_id}")
def delete_fac3(item_id: int, db: Session = Depends(get_db)):
    obj = db.get(PartAssy, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="PartAssy (fac3) not found")
    db.delete(obj)
    db.commit()
    return {"status": "success", "deleted": 1, "id": item_id}

@app.delete("/data_management/sleeveAndThrustBrg/{item_id}")
def delete_sleeve_thrust(item_id: int, db: Session = Depends(get_db)):
    obj = db.get(PartAssy, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="PartAssy (sleeveAndThrustBrg) not found")
    db.delete(obj)
    db.commit()
    return {"status": "success", "deleted": 1, "id": item_id}


# ---------- MASTER: toolLimitAndCapa ----------
# ใน upload คุณสร้าง Capacity แล้วผูก JoinLimitAssy
# เพื่อลบแบบง่าย: ลบ JoinLimitAssy ที่ชี้ capacity ก่อน แล้วค่อยลบ Capacity
@app.delete("/data_management/toolLimitAndCapa/{item_id}")
def delete_capacity(item_id: int, db: Session = Depends(get_db)):
    cap = db.get(Capacity, item_id)
    if not cap:
        raise HTTPException(status_code=404, detail="Capacity not found")

    # ลบความสัมพันธ์ก่อน (ถ้าใช้ FK cascade ก็สามารถข้ามสองบรรทัดนี้ได้)
    db.query(JoinLimitAssy).filter(JoinLimitAssy.capacityId == item_id).delete(synchronize_session=False)

    db.delete(cap)
    db.commit()
    return {"status": "success", "deleted": 1, "id": item_id}


# ---------- BY MONTH: workingDate ----------
@app.delete("/data_management/workingDate/{item_id}")
def delete_working_date(item_id: int, db: Session = Depends(get_db)):
    obj = db.get(WorkingDate, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="WorkingDate not found")
    db.delete(obj)
    db.commit()
    return {"status": "success", "deleted": 1, "id": item_id}



# ---------- Divition ----------
# @app.get("/divitions", response_model=list[dict])
# def list_divitions(db: Session = Depends(get_db)):

# @app.post("/divitions", response_model=dict)
# def create_divition(db: Session = Depends(get_db)):

# ---------- Role ----------
@app.get("/roles", response_model=list[dict])
def list_roles(db: Session = Depends(get_db)):
    #select Role
    records = db.query(Role).all()
    return records

# ---------- User ----------
# @app.get("/users", response_model=list[dict])
# def list_users(db: Session = Depends(get_db)):


# @app.post("/users", response_model=dict)
# def create_user(db: Session = Depends(get_db)):

























