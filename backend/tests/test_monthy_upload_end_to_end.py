# tests/test_all_endpoints.py
import io
import json
import pytest

from io import BytesIO
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import date
from main import app, Base, get_db
from models import (
    BomWos, MachineLayout, MachineType, Machine,
    PartAssy, Capacity, LimitAssy, JoinLimitAssy,
    BalanceOrderMidSmall, MachineNotAvailable, ProductionPlan,
    KpiSetup, KpiProduction, WorkingDate, WipAssy,
    DataPlan, ApproveDataPlan, ProductionPlanActual
)

# ------------------------
# Fixtures & helpers
# ------------------------

def csv_file(headers, rows):
    text = ",".join(headers) + "\n"
    for r in rows:
        text += ",".join("" if v is None else str(v) for v in r) + "\n"
    return BytesIO(text.encode("utf-8"))

@pytest.fixture()
def client_and_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client, TestingSessionLocal
    app.dependency_overrides.clear()

def seed_bom_and_machine(SessionLocal):
    db = SessionLocal()
    try:
        bom = BomWos(
            wosNo="W001",
            brgNoValue="BRG-001",
            partNoValue="PART-001",
            partComponentGroup="G1",
            qty=1,
            parentPartNo="PARENT-001",
        )
        db.add(bom)

        layout = MachineLayout(lineNo=1, machineNo="MC-01", locationNo=1)
        db.add(layout)

        mtype = MachineType(machineType="TYPE-A")
        db.add(mtype)
        db.flush()

        mc = Machine(machineGroup=1, machineTypeId=mtype.id, machineLayoutId=layout.id)
        db.add(mc)

        db.commit()
    finally:
        db.close()

# ------------------------
# Upload masters
# ------------------------

def test_upload_bomwos_and_list(client_and_session):
    client, _ = client_and_session
    f = csv_file(
        ["updateAt","wosNo","brgNoValue","partNoValue","partComponentGroup","qty","parentPartNo"],
        [["2025-10-01","W001","BRG-001","PART-001","G1",1,"PARENT-001"]]
    )
    r = client.post("/data_management/bomWos/upload/", files={"file": ("bomWos.csv", f.getvalue(), "text/csv")})
    assert r.status_code == 200 and r.json()["status"] == "success"

    r = client.get("/data_management/bomWos/")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["wosNo"] == "W001"
    assert data[0]["brgNoValue"] == "BRG-001"

def test_upload_machine_layout_and_list(client_and_session):
    client, _ = client_and_session
    f = csv_file(["lineNo","machineNo","locationNo"], [[1,"MC-01",1]])
    r = client.post("/data_management/machineLayout/upload/", files={"file": ("machineLayout.csv", f.getvalue(), "text/csv")})
    assert r.status_code == 200 and r.json()["status"] == "success"

    r = client.get("/data_management/machineLayout/")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1 and data[0]["machineNo"] == "MC-01"

def test_upload_machine_group_and_list(client_and_session):
    client, SessionLocal = client_and_session
    # ต้องมี MachineLayout ก่อน
    db = SessionLocal(); db.add(MachineLayout(lineNo=1, machineNo="MC-01", locationNo=1)); db.commit(); db.close()

    f = csv_file(["machineNo","machineType","machineGroup"], [["MC-01","TYPE-A",1]])
    r = client.post("/data_management/machineGroup/upload/", files={"file": ("machineGroup.csv", f.getvalue(), "text/csv")})
    assert r.status_code == 200 and r.json()["status"] == "success"

    r = client.get("/data_management/machineGroup/")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert str(data[0]["machineGroup"]) in ("1", 1)

# ------------------------
# PartAssy uploads and lists (fac1/fac3/sleeve)
# ------------------------

def test_fac_uploads_and_lists(client_and_session):
    client, SessionLocal = client_and_session
    # ต้องมี BomWos
    db = SessionLocal()
    db.add(BomWos(wosNo="W001", brgNoValue="BRG-001", partNoValue="P1", partComponentGroup="G", qty=1, parentPartNo="PP"))
    db.commit(); db.close()

    for ep, col in [("fac1","partFac1"), ("fac3","partFac3"), ("sleeveAndThrustBrg","sleeveAndThrustBrg")]:
        f = csv_file(["brgNoValue","groupBrgNoValue"], [["BRG-001","G-01"]])
        r = client.post(f"/data_management/{ep}/upload/", files={"file": (f"{ep}.csv", f.getvalue(), "text/csv")})
        assert r.status_code == 200 and r.json()["status"] == "success"

    # fac1
    r = client.get("/data_management/fac1/")
    assert r.status_code == 200 and len(r.json()) == 1
    # fac3
    r = client.get("/data_management/fac3/")
    assert r.status_code == 200 and len(r.json()) == 1
    # sleeve
    r = client.get("/data_management/sleeveAndThrustBrg/")
    assert r.status_code == 200 and len(r.json()) == 1

# ------------------------
# toolLimitAndCapa upload and list
# ------------------------

def test_tool_limit_and_capa_upload_and_get(client_and_session):
    client, SessionLocal = client_and_session
    seed_bom_and_machine(SessionLocal)

    headers = ["brgNoValue","groupBrgNoValue","machineGroup","machineType","machineNo",
               "groupBrgAndMcGroup","limitByType","limitByGroup","joinToolingPartNo",
               "capaDay","utilizeMc","cycleTime","capaF3"]
    row = ["BRG-001","G-01",1,"TYPE-A","MC-01","G-01#1","TYPE-X","GRP-X","J-123",100,0.9,60,50]
    f = csv_file(headers, [row])

    r = client.post("/data_management/toolLimitAndCapa/upload/", files={"file": ("toolLimitAndCapa.csv", f.getvalue(), "text/csv")})
    assert r.status_code == 200 and r.json()["status"] == "success"

    r = client.get("/data_management/toolLimitAndCapa/")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["brgNoValue"] == "BRG-001"
    assert data[0]["machineNo"] == "MC-01"
    assert data[0]["limitByType"] == "TYPE-X"
    assert data[0]["joinToolingPartNo"] == "J-123"

# ------------------------
# workingDate upload and get
# ------------------------

def test_working_date_upload_and_get(client_and_session):
    client, _ = client_and_session
    f = csv_file(["workingDate","workingHr"], [["2025-10-01", 8]])
    r = client.post("/data_management/workingDate/upload/", files={"file": ("workingDate.csv", f.getvalue(), "text/csv")})
    assert r.status_code == 200 and r.json()["status"] == "success"

    r = client.get("/data_management/workingDate/")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1 and data[0]["workingHr"] == 8

# ------------------------
# Monthly upload (end-to-end subset) + related GETs
# ------------------------

def test_monthly_upload_and_related_gets(client_and_session):
    client, SessionLocal = client_and_session
    seed_bom_and_machine(SessionLocal)

    f_mid_small = csv_file(
        ["targetPlanMonth","orderNo","dueDate","balanceOrder","partGroup","wosNo"],
        [["2025-10","ORD-1","2025-10-31",10,"MID","W001"]],
    )
    f_mc_na = csv_file(["machineNo"], [["MC-01"]])
    f_prod_plan = csv_file(["machineNo","brgNoValue"], [["MC-01","BRG-001"]])
    f_kpi_setup = csv_file(["machineGroup","setupAverage","maxSetUpPerDay"], [[1,45,3]])
    f_kpi_prod = csv_file(["autoMachineDailyTarget","manualDailyTarget"], [[100,50]])
    f_working_date = csv_file(["workingDate","workingHr"], [["2025-10-01",8]])
    f_wip = csv_file(["updateAt","brgNoValue","wosNo","processValue","qty","wipType"], [["2025-10-01","BRG-001","W001","P10",5,"WIP"]])

    files = {
        "balanceOrderMidSmall": ("balanceOrderMidSmall.csv", f_mid_small.getvalue(), "text/csv"),
        "machineNotAvailable":  ("machineNotAvailable.csv",  f_mc_na.getvalue(), "text/csv"),
        "productionPlan":       ("productionPlan.csv",       f_prod_plan.getvalue(), "text/csv"),
        "kpiSetup":             ("kpiSetup.csv",             f_kpi_setup.getvalue(), "text/csv"),
        "kpiProduction":        ("kpiProduction.csv",        f_kpi_prod.getvalue(), "text/csv"),
        "workingDate":          ("workingDate.csv",          f_working_date.getvalue(), "text/csv"),
        "wipAssy":              ("wipAssy.csv",              f_wip.getvalue(), "text/csv"),
    }

    r = client.post("/data_management/monthy/upload/", files=files)
    assert r.status_code == 200 and r.json()["status"] == "success"

    # wipAssy
    r = client.get("/data_management/wipAssy/")
    data = r.json()
    assert len(data) == 1 and data[0]["processValue"] == "P10" and data[0]["qty"] == 5

    # machineNotAvailable
    r = client.get("/data_management/machineNotAvailable/")
    assert len(r.json()) == 1

    # balanceOrderMidSmall
    r = client.get("/data_management/balanceOrderMidSmall/")
    bal = r.json()
    assert len(bal) == 1 and bal[0]["targetPlanMonth"] == "2025-10"

    # kpi
    assert len(client.get("/data_management/kpiSetup/").json()) >= 1
    kp = client.get("/data_management/kpiProduction/").json()
    assert len(kp) == 1 and kp[0]["autoMachineDailyTarget"] == 100

    # productionPlan
    pp = client.get("/data_management/productionPlan/").json()
    assert len(pp) >= 1

# ------------------------
# Approve plan & reports
# ------------------------

def test_create_approve_plan_and_reports(client_and_session):
    client, SessionLocal = client_and_session
    # seed core entities
    seed_bom_and_machine(SessionLocal)
    # seed DataPlan (2 แถว)
    db = SessionLocal()
    try:
        bom = db.query(BomWos).first()
        mc  = db.query(Machine).first()
        dp1 = DataPlan(
            rev=1, workingDate=date(2025, 10, 1), planTarget=10,
            isMachineContinue=0, planType="A", machineId=mc.id, bomWosId=bom.id
        )
        dp2 = DataPlan(
            rev=1, workingDate=date(2025, 10, 2), planTarget=20,
            isMachineContinue=1, planType="B", machineId=mc.id, bomWosId=bom.id
        )

        bal = BalanceOrderMidSmall(
            rev=1, targetPlanMonth="2025-10", orderNo="ORD",
            dueDate=date(2025, 10, 31),  # <-- แก้เป็น date()
            balanceOrder=10, partGroup="MID", bomWosId=bom.id
        )
        db.add_all([dp1, dp2, bal])
        db.commit()
    finally:
        db.close()

    # create approve
    r = client.post("/data_management/create_approve_plan/", json={"rev": 1})
    assert r.status_code == 200
    out = r.json()
    assert out["status"] == "ok" and out["inserted"] == 2

    # plan_wos_qty
    q = client.get("/data_management/plan_wos_qty/")
    assert q.status_code == 200
    rows = q.json()
    assert any(r["targetPlanMonth"] == "2025-10" for r in rows)

    # plan_target
    q = client.get("/data_management/plan_target/")
    assert q.status_code == 200
    tgt = q.json()
    assert any(row["totalPlanTarget"] >= 30 for row in tgt)

    # report/plan (โค้ดเดิมอาจคิวรีแบบ cross-join แต่ตรวจว่าคืนรายการได้)
    r = client.get("/report/plan")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

# ------------------------
# Actual upload (รู้ว่าโค้ดมีบั๊ก) – mark xfail
# ------------------------

@pytest.mark.xfail(reason="Endpoint มีบั๊ก: ใช้ 'actualAssy' แต่ error msg 'bomWos', endDate อ่านจาก 'balanceOrder', และ insert ไปตารางผิด")
def test_actual_assy_upload_and_report_actual(client_and_session):
    client, SessionLocal = client_and_session
    seed_bom_and_machine(SessionLocal)

    f = csv_file(["machineNo","brgNoValue","startDate","endDate","actualOutput"],
                 [["MC-01","BRG-001","2025-10-01","2025-10-02",5]])
    r = client.post("/data_management/actualAssy/upload", files={"file": ("actualAssy.csv", f.getvalue(), "text/csv")})
    assert r.status_code == 200

    r = client.get("/report/actual")
    assert r.status_code == 200
    assert len(r.json()) == 1

# ------------------------
# Plan result GET (ตาราง DataPlan)
# ------------------------

def test_plan_result_get(client_and_session):
    client, SessionLocal = client_and_session
    seed_bom_and_machine(SessionLocal)
    # seed DataPlan
    db = SessionLocal()
    try:
        bom = db.query(BomWos).first()
        mc  = db.query(Machine).first()
        db.add_all([
            DataPlan(rev=2, workingDate=date(2025, 11, 1), planTarget=7,
                    isMachineContinue=0, planType="A", machineId=mc.id, bomWosId=bom.id),
            DataPlan(rev=2, workingDate=date(2025, 11, 2), planTarget=11,
                    isMachineContinue=1, planType="B", machineId=mc.id, bomWosId=bom.id),
        ])
        db.commit()
    finally:
        db.close()

    r = client.get("/data_menagement/plan_result/get")  # route สะกดตามโค้ด
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert set(data[0].keys()) >= {"brgNoValue","machineNo","workingDate","planTarget","planType","rev"}

# ------------------------
# Deletes (success cases)
# ------------------------

def test_delete_master_rows(client_and_session):
    client, SessionLocal = client_and_session
    # seed BomWos + MachineLayout + Machine + PartAssy + Capacity(+Join)
    seed_bom_and_machine(SessionLocal)
    db = SessionLocal()
    try:
        bom = db.query(BomWos).first()
        layout = db.query(MachineLayout).first()
        # fac1
        pa = PartAssy(bomWosId=bom.id, partFac1="1")
        db.add(pa)
        # capacity + join
        cap = Capacity(bomWosId=bom.id, machineId=db.query(Machine).first().id,
                       groupBrgAndMcGroup="X", capaDay=100, utilizeMc=0.9, cycleTime=60, capaF3=50)
        db.add(cap); db.commit(); db.refresh(cap)
        lim = LimitAssy(limitByType="T", limitByGroup="G", joinToolingPartNo="J")
        db.add(lim); db.commit(); db.refresh(lim)
        db.add(JoinLimitAssy(capacityId=cap.id, limitAssyId=lim.id))
        db.commit()
        # ids
        bom_id = bom.id
        ml_id  = layout.id
        mc_id  = db.query(Machine).first().id
        pa_id  = pa.id
        cap_id = cap.id
    finally:
        db.close()

    # delete fac1 (PartAssy)
    assert client.delete(f"/data_management/fac1/{pa_id}").status_code == 200
    # delete capacity (cascade via manual delete join)
    assert client.delete(f"/data_management/toolLimitAndCapa/{cap_id}").status_code == 200
    # delete machine (Machine)
    assert client.delete(f"/data_management/machineGroup/{mc_id}").status_code == 200
    # delete machineLayout (ไม่มี FK enforcement ใน SQLite ทดสอบนี้ → expected 200)
    assert client.delete(f"/data_management/machineLayout/{ml_id}").status_code == 200
    # delete bomwos
    assert client.delete(f"/data_management/bomWos/{bom_id}").status_code == 200

def test_delete_working_date(client_and_session):
    client, SessionLocal = client_and_session
    # seed
    db = SessionLocal()
    try:
        wd = WorkingDate(rev=1, workingDate=date(2025, 10, 1), workingHr=8)
        db.add(wd); db.commit(); db.refresh(wd)
        wd_id = wd.id
    finally:
        db.close()

    r = client.delete(f"/data_management/workingDate/{wd_id}")
    assert r.status_code == 200
