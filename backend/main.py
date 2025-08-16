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
from sqlalchemy import func,extract,insert, values, column, and_
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
    allow_origins=["http://192.168.100.124:3001","http://localhost:3000"],
    # "http://192.168.100.124:3001","http://localhost:3000"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/data_management/bomWos/upload/")
async def bom_wos(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # -------------------- เตรียมตัวแปรนับผลลัพธ์ --------------------
    inserted = 0                       # นับจำนวนแถวที่ insert ใหม่จริง ๆ
    skipped = 0                        # นับจำนวนแถวที่ข้าม (เจอว่ามีอยู่แล้ว)
    # ถ้าต้องการเก็บรายการแถวจริง ๆ ให้เปิดลิสต์ 2 ตัวนี้
    # inserted_rows = []
    # skipped_rows = []

    # -------------------- อ่านไฟล์และตรวจสอบ --------------------
    contents = await file.read()       # อ่าน bytes จากไฟล์อัปโหลด

    # ตรวจชื่อไฟล์ต้องขึ้นต้น bomWos
    if not checkfilename(file.filename, "bomWos"):
        raise HTTPException(status_code=400, detail="Filename must start with 'bomWos'")

    # ตรวจชนิดไฟล์ csv/xlsx
    if not checkfiletype(file.filename):
        raise HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")

    # แปลงเป็น DataFrame
    if file.filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(contents))
    else:
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

    # ลบคอลัมน์ Unnamed ที่หลุดมาจาก Excel
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

    # ตรวจ schema และข้อมูล
    ok, msg = checkheader(df, "bomWos")
    if not ok: raise HTTPException(status_code=400, detail=msg)

    ok, msg = checkempty(df)
    if not ok: raise HTTPException(status_code=400, detail=msg)

    ok, msg = checknumber(df, ['qty'])
    if not ok: raise HTTPException(status_code=400, detail=msg)

    ok, msg = checkdate(df, ["updateAt"])
    if not ok: raise HTTPException(status_code=400, detail=msg)

    ok, msg = checkunknown(df)
    if not ok: raise HTTPException(status_code=400, detail=msg)

    # -------------------- ทำความสะอาด & ลดซ้ำตั้งแต่ต้นน้ำ --------------------
    # เลือกเฉพาะคอลัมน์ที่เกี่ยวกับ uniqueness (ให้ตรงกับเงื่อนไขเช็กซ้ำเดิม)
    need_cols = ["wosNo", "brgNoValue", "partNoValue", "parentPartNo", "partComponentGroup", "qty", "updateAt"]
    df = df[need_cols].copy()

    # จัดชนิดข้อมูลให้สม่ำเสมอ (กัน mismatch ตอน JOIN)
    df["wosNo"]               = df["wosNo"].astype(str).str.strip()
    df["brgNoValue"]          = df["brgNoValue"].astype(str).str.strip()
    df["partNoValue"]         = df["partNoValue"].astype(str).str.strip()
    df["parentPartNo"]        = df["parentPartNo"].astype(str).str.strip()
    df["partComponentGroup"]  = df["partComponentGroup"].astype(str).str.strip()
    df["qty"]                 = pd.to_numeric(df["qty"]).astype(int)  # ให้ตรงกับ DB (int)
    # updateAt เก็บไว้ถ้าคุณต้องการใช้ต่อ (ตอนนี้ schema ไม่ได้ insert คอลัมน์นี้)

    # ตัดแถวซ้ำในไฟล์ (ถ้าผู้ใช้อัปโหลดซ้ำกันเอง)
    df = df.drop_duplicates()

    # -------------------- เตรียมข้อมูลเป็น list ของ dict (เร็วกว่า to_dict ทีละรอบ) --------------------
    rows = df.to_dict(orient="records")

    # -------------------- หาแถวที่ “มีอยู่แล้ว” ใน DB แบบ batch (JOIN ... VALUES) --------------------
    from sqlalchemy import values, column, and_

    # สร้างลิสต์ “คีย์ธรรมชาติ” ของ BomWos ที่ใช้ตัดซ้ำ (ยึดตามโค้ดเดิมทุกฟิลด์)
    key_list = [
        (
            r["wosNo"],
            r["brgNoValue"],
            r["partNoValue"],
            r["parentPartNo"],
            r["partComponentGroup"],
            r["qty"],
        )
        for r in rows
    ]

    # de-dupe keys ในหน่วยความจำอีกชั้น (กันค่าซ้ำในไฟล์)
    key_list = list(dict.fromkeys(key_list))

    # เก็บคีย์ที่มีอยู่แล้วใน DB
    existing_keys = set()

    # ตั้งค่า chunk เพื่อหลบลิมิต 2100 parameters (6 คอลัมน์/แถว -> 350 แถว/ก้อน ≈ 2100)
    CHUNK = 300  # ปลอดภัย + เผื่อพารามิเตอร์อื่น

    for start in range(0, len(key_list), CHUNK):
        part = key_list[start:start + CHUNK]

        # สร้าง VALUES table ชั่วคราว (คอลัมน์เรียงให้ตรงกับฝั่งซ้าย)
        v = values(
            column('wosNo',               BomWos.wosNo.type),
            column('brgNoValue',          BomWos.brgNoValue.type),
            column('partNoValue',         BomWos.partNoValue.type),
            column('parentPartNo',        BomWos.parentPartNo.type),
            column('partComponentGroup',  BomWos.partComponentGroup.type),
            column('qty',                 BomWos.qty.type),
        ).data(part).alias('v')

        # JOIN กับตารางจริงตามทุกคอลัมน์คีย์
        q = db.query(
                BomWos.wosNo,
                BomWos.brgNoValue,
                BomWos.partNoValue,
                BomWos.parentPartNo,
                BomWos.partComponentGroup,
                BomWos.qty,
            ).join(
                v,
                and_(
                    BomWos.wosNo              == v.c.wosNo,
                    BomWos.brgNoValue         == v.c.brgNoValue,
                    BomWos.partNoValue        == v.c.partNoValue,
                    BomWos.parentPartNo       == v.c.parentPartNo,
                    BomWos.partComponentGroup == v.c.partComponentGroup,
                    BomWos.qty                == v.c.qty,
                )
            )

        # เติมชุดคีย์ที่พบว่ามีอยู่แล้ว
        existing_keys.update(q.all())

    # -------------------- กรองเฉพาะแถวที่ยังไม่อยู่ใน DB --------------------
    to_insert = []
    for r in rows:
        k = (r["wosNo"], r["brgNoValue"], r["partNoValue"], r["parentPartNo"], r["partComponentGroup"], r["qty"])
        if k in existing_keys:
            skipped += 1
            # skipped_rows.append(r)
        else:
            to_insert.append({
                "wosNo": r["wosNo"],
                "brgNoValue": r["brgNoValue"],
                "partNoValue": r["partNoValue"],
                "partComponentGroup": r["partComponentGroup"],
                "qty": r["qty"],
                "parentPartNo": r["parentPartNo"],
            })

    # -------------------- เขียน DB ด้วย bulk insert ครั้งเดียว --------------------
    try:
        if to_insert:
            # ใช้ bulk insert ผ่าน Core เพื่อความเร็ว (pyodbc + SQL Server เร็วขึ้นอีกถ้าเปิด fast_executemany ตอนสร้าง engine)
            db.execute(insert(BomWos), to_insert)
            inserted = len(to_insert)
            # inserted_rows.extend(to_insert)

        db.commit()
    except Exception:
        db.rollback()
        raise

    # -------------------- ส่งผลลัพธ์กลับ --------------------
    return {
        "status": "success",
        "inserted": inserted,
        "skipped": skipped,
        # "inserted_rows": inserted_rows,
        # "skipped_rows": skipped_rows,
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

    #ถ้า error ให้ rollback
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")

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

    #ถ้า error ให้ rollback
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")

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

    #ถ้า error ให้ rollback
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")

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

    #ถ้า error ให้ rollback
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")

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

    #ถ้า error ให้ rollback
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")

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
    # -------------------- read & validate --------------------
    contents = await file.read()  # อ่านไฟล์จาก request

    # ตรวจสอบว่าไฟล์ขึ้นต้นชื่อถูกต้อง
    if not checkfilename(file.filename, "toolLimitAndCapa"):
        raise HTTPException(status_code=400, detail="Filename must start with 'toolLimitAndCapa'")
    # ตรวจสอบว่าไฟล์เป็น csv หรือ xlsx
    if not checkfiletype(file.filename):
        raise HTTPException(status_code=400, detail="Filetype must .csv or .xlsx")

    # อ่านไฟล์ตามชนิด
    if file.filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(contents))
    else:
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

    # ลบ column ที่ชื่อขึ้นด้วย "Unnamed"
    df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

    # ตรวจสอบ header
    ok, msg = checkheader(df, "toolLimitAndCapa")
    if not ok: raise HTTPException(status_code=400, detail=msg)
    # ตรวจสอบว่าค่าเป็นตัวเลขใน column ที่ต้องเป็นตัวเลข
    ok, msg = checknumber(df, ['capaDay', 'cycleTime','utilizeMc'])
    if not ok: raise HTTPException(status_code=400, detail=msg)
    # ตรวจสอบว่าไม่มีค่าเป็นค่าว่าง
    ok, msg = checkempty(df)
    if not ok: raise HTTPException(status_code=400, detail=msg)
    # ตรวจสอบว่าไม่มีค่า "unknown"
    ok, msg = checkunknown(df)
    if not ok: raise HTTPException(status_code=400, detail=msg)

    # ลดงานซ้ำ: ตัด duplicate rows ออก
    df = df.drop_duplicates()

    # -------------------- preload maps (คิวรีทีเดียว) --------------------
    # เก็บค่า key ที่เจอใน DataFrame
    brg_vals = set(df["brgNoValue"].dropna().astype(str))
    mc_nos   = set(df["machineNo"].dropna().astype(str))
    mc_types = set(df["machineType"].dropna().astype(str))

    # preload BomWos: mapping brgNoValue -> id
    bom_rows = db.query(BomWos.brgNoValue, BomWos.id)\
                 .filter(BomWos.brgNoValue.in_(brg_vals or {"__NONE__"})).all()
    bom_map = {b: i for b, i in bom_rows}

    # preload MachineLayout: mapping machineNo -> id
    layout_rows = db.query(MachineLayout.machineNo, MachineLayout.id)\
                    .filter(MachineLayout.machineNo.in_(mc_nos or {"__NONE__"})).all()
    layout_map = {m: i for m, i in layout_rows}

    # preload MachineType: mapping machineType -> id
    type_rows = db.query(MachineType.machineType, MachineType.id)\
                  .filter(MachineType.machineType.in_(mc_types or {"__NONE__"})).all()
    type_map = {t: i for t, i in type_rows}

    # -------------------- เตรียม keys ที่ต้องใช้ --------------------
    need_machine_keys = set()
    need_la_keys = set()
    for r in df.to_dict(orient="records"):
        mg = r.get("machineGroup")
        t  = str(r.get("machineType", "")).strip()
        n  = str(r.get("machineNo", "")).strip()
        type_id   = type_map.get(t)
        layout_id = layout_map.get(n)
        if type_id and layout_id:
            # key ของ machine ที่ใช้ join หา machine.id
            need_machine_keys.add((mg, type_id, layout_id))

        # key ของ LimitAssy ที่ใช้ join หา limitAssy.id
        need_la_keys.add((
            r.get("limitByType"),
            r.get("limitByGroup"),
            r.get("joinToolingPartNo"),
        ))

    # -------------------- JOIN VALUES แบบ chunk (กัน 2100 params) --------------------
    CHUNK = 600  # กันไม่ให้ query IN() เกิน 2100 params ของ SQL Server

    # preload Machine mapping (machineGroup + typeId + layoutId -> machine.id)
    machine_map = {}
    if need_machine_keys:
        need_machine_keys_list = list(need_machine_keys)
        for start in range(0, len(need_machine_keys_list), CHUNK):
            part = need_machine_keys_list[start:start+CHUNK]
            v_mach = values(
                column('machineGroup',   Machine.machineGroup.type),
                column('machineTypeId',  Machine.machineTypeId.type),
                column('machineLayoutId',Machine.machineLayoutId.type),
            ).data(part).alias('v_mach')

            q_mach = db.query(
                        Machine.machineGroup,
                        Machine.machineTypeId,
                        Machine.machineLayoutId,
                        Machine.id
                    ).join(
                        v_mach,
                        and_(
                            Machine.machineGroup    == v_mach.c.machineGroup,
                            Machine.machineTypeId   == v_mach.c.machineTypeId,
                            Machine.machineLayoutId == v_mach.c.machineLayoutId,
                        )
                    )
            for mg, mt, ml, mid in q_mach.all():
                machine_map[(mg, mt, ml)] = mid

    # preload LimitAssy mapping
    la_map = {}
    if need_la_keys:
        need_la_keys_list = list(need_la_keys)
        for start in range(0, len(need_la_keys_list), CHUNK):
            part = need_la_keys_list[start:start+CHUNK]
            v_la = values(
                column('limitByType',       LimitAssy.limitByType.type),
                column('limitByGroup',      LimitAssy.limitByGroup.type),
                column('joinToolingPartNo', LimitAssy.joinToolingPartNo.type),
            ).data(part).alias('v_la')

            q_la = db.query(
                        LimitAssy.limitByType,
                        LimitAssy.limitByGroup,
                        LimitAssy.joinToolingPartNo,
                        LimitAssy.id
                    ).join(
                        v_la,
                        and_(
                            LimitAssy.limitByType       == v_la.c.limitByType,
                            LimitAssy.limitByGroup      == v_la.c.limitByGroup,
                            LimitAssy.joinToolingPartNo == v_la.c.joinToolingPartNo,
                        )
                    )
            for a, b, c, i in q_la.all():
                la_map[(a, b, c)] = i

    # เตรียมรายการ LimitAssy ที่ต้องสร้างใหม่
    to_create_la = [
        {"limitByType": a, "limitByGroup": b, "joinToolingPartNo": c}
        for (a, b, c) in need_la_keys if (a, b, c) not in la_map
    ]

    failed_rows = []        # เก็บแถวที่ error
    pending_capacity = []   # เก็บแถว Capacity ที่ valid แล้ว
    cap_la_keys_in_order = []  # เก็บ key LimitAssy สำหรับ join

    # -------------------- วนรอบ validate ทีละแถว --------------------
    for i, r in enumerate(df.to_dict(orient="records"), start=2):
        brg   = str(r.get("brgNoValue", "")).strip()
        mtype = str(r.get("machineType", "")).strip()
        mno   = str(r.get("machineNo", "")).strip()
        mg    = r.get("machineGroup")

        bom_id    = bom_map.get(brg)
        type_id   = type_map.get(mtype)
        layout_id = layout_map.get(mno)

        # ตรวจว่ามี key ที่ preload มาหรือไม่
        if not bom_id:
            failed_rows.append({"row": i, "reason": f"brgNoValue '{brg}' not found in BomWos"})
            continue
        if not layout_id:
            failed_rows.append({"row": i, "reason": f"machineNo '{mno}' not found in MachineLayout"})
            continue
        if not type_id:
            failed_rows.append({"row": i, "reason": f"machineType '{mtype}' not found in MachineType"})
            continue

        # หา machine_id จาก 3 key
        machine_id = machine_map.get((mg, type_id, layout_id))
        if not machine_id:
            failed_rows.append({"row": i, "reason": "Machine not found from combination of group, type, layout"})
            continue

        la_key = (r.get("limitByType"), r.get("limitByGroup"), r.get("joinToolingPartNo"))

        # เก็บ row ที่ผ่านตรวจแล้วรอ insert
        pending_capacity.append({
            "bomWosId": bom_id,
            "machineId": machine_id,
            "groupBrgAndMcGroup": r.get("groupBrgAndMcGroup"),
            "capaDay": r.get("capaDay"),
            "utilizeMc": r.get("utilizeMc"),
            "cycleTime": r.get("cycleTime"),
            "capaF3": r.get("capaF3"),
        })
        cap_la_keys_in_order.append(la_key)

    # -------------------- เขียน DB --------------------
    inserted = 0
    try:
        # 1) สร้าง LimitAssy ใหม่ (ถ้ามี)
        if to_create_la:
            db.execute(insert(LimitAssy), to_create_la)

            # เติม la_map อีกรอบหลังจาก insert
            to_create_keys = [(x["limitByType"], x["limitByGroup"], x["joinToolingPartNo"]) for x in to_create_la]
            for start in range(0, len(to_create_keys), CHUNK):
                part = to_create_keys[start:start+CHUNK]
                v_la2 = values(
                    column('limitByType',       LimitAssy.limitByType.type),
                    column('limitByGroup',      LimitAssy.limitByGroup.type),
                    column('joinToolingPartNo', LimitAssy.joinToolingPartNo.type),
                ).data(part).alias('v_la2')

                q_la2 = db.query(
                            LimitAssy.limitByType,
                            LimitAssy.limitByGroup,
                            LimitAssy.joinToolingPartNo,
                            LimitAssy.id
                        ).join(
                            v_la2,
                            and_(
                                LimitAssy.limitByType       == v_la2.c.limitByType,
                                LimitAssy.limitByGroup      == v_la2.c.limitByGroup,
                                LimitAssy.joinToolingPartNo == v_la2.c.joinToolingPartNo,
                            )
                        )
                for a, b, c, i in q_la2.all():
                    la_map[(a, b, c)] = i

        # ---------- (A) ป้องกันซ้ำ: Capacity ----------
        cap_keys = [
            (row["bomWosId"], row["machineId"], row["groupBrgAndMcGroup"])
            for row in pending_capacity
        ]
        cap_keys = list(dict.fromkeys(cap_keys))  # ลบ duplicate ใน memory

        exist_cap_keys = set()
        if cap_keys:
            for start in range(0, len(cap_keys), CHUNK):
                part = cap_keys[start:start+CHUNK]
                v_cap = values(
                    column('bomWosId',            Capacity.bomWosId.type),
                    column('machineId',           Capacity.machineId.type),
                    column('groupBrgAndMcGroup',  Capacity.groupBrgAndMcGroup.type),
                ).data(part).alias('v_cap')

                q_cap_exist = db.query(
                                    Capacity.bomWosId,
                                    Capacity.machineId,
                                    Capacity.groupBrgAndMcGroup
                                ).join(
                                    v_cap,
                                    and_(
                                        Capacity.bomWosId           == v_cap.c.bomWosId,
                                        Capacity.machineId          == v_cap.c.machineId,
                                        Capacity.groupBrgAndMcGroup == v_cap.c.groupBrgAndMcGroup,
                                    )
                                )
                exist_cap_keys.update({(bw, mc, grp) for (bw, mc, grp) in q_cap_exist.all()})

        # กรองเฉพาะ capacity ใหม่
        filtered_capacity = []
        filtered_la_keys  = []
        for row, la_key in zip(pending_capacity, cap_la_keys_in_order):
            k = (row["bomWosId"], row["machineId"], row["groupBrgAndMcGroup"])
            if k not in exist_cap_keys:
                filtered_capacity.append(row)
                filtered_la_keys.append(la_key)

        # 2) insert Capacity ใหม่
        cap_ids = []
        if filtered_capacity:
            res = db.execute(insert(Capacity).returning(Capacity.id), filtered_capacity)
            cap_ids = [row[0] for row in res.fetchall()]
            inserted = len(cap_ids)

        # ---------- (B) ป้องกันซ้ำ: JoinLimitAssy ----------
        join_rows = []
        if cap_ids:
            la_ids = [la_map.get(la_key) for la_key in filtered_la_keys]
            raw_pairs = [(cid, lid) for cid, lid in zip(cap_ids, la_ids) if lid]

            if raw_pairs:
                exist_pairs = set()
                for start in range(0, len(raw_pairs), CHUNK):
                    part = raw_pairs[start:start+CHUNK]
                    v_jla = values(
                        column('capacityId',  JoinLimitAssy.capacityId.type),
                        column('limitAssyId', JoinLimitAssy.limitAssyId.type),
                    ).data(part).alias('v_jla')

                    q_jla_exist = db.query(
                                        JoinLimitAssy.capacityId,
                                        JoinLimitAssy.limitAssyId
                                    ).join(
                                        v_jla,
                                        and_(
                                            JoinLimitAssy.capacityId  == v_jla.c.capacityId,
                                            JoinLimitAssy.limitAssyId == v_jla.c.limitAssyId,
                                        )
                                    )
                    exist_pairs.update({(c, l) for (c, l) in q_jla_exist.all()})

                join_rows = [
                    {"capacityId": c, "limitAssyId": l}
                    for (c, l) in raw_pairs if (c, l) not in exist_pairs
                ]

        # 3) insert JoinLimitAssy ใหม่
        if join_rows:
            db.execute(insert(JoinLimitAssy), join_rows)

        # ✅ commit ครั้งเดียว
        db.commit()

    except Exception:
        db.rollback()
        raise

    # response กลับไปหา client
    return {
        "status": "success",
        "inserted": inserted,   # จำนวน Capacity ที่เพิ่มใหม่จริง ๆ
        "failed_rows": failed_rows
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

    #ถ้า error ให้ rollback
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")
    
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

    #ถ้า error ให้ rollback
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")
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

    #ถ้า error ให้ rollback
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")
    
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
    #ถ้า error ให้ rollback
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")
    
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

























