from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
import os

DB_USER = os.getenv("DB_USER", "sa")
DB_PASSWORD = os.getenv("DB_PASSWORD", "DmX08775416421")
DB_SERVER = os.getenv("DB_SERVER", "db")           # ต้องตรงกับ service ชื่อ db หรือ sql_server ตาม compose
DB_NAME = os.getenv("DB_NAME", "autoplan_nmb")

# ใช้ ODBC Driver 18 + เปิด TrustServerCertificate (แนะนำ)
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC+Driver+18+for+SQL+Server")
DB_EXTRA  = os.getenv("DB_EXTRA", "TrustServerCertificate=yes")  # เติม Encrypt=yes ได้ถ้าต้องการ

# ใช้รูปแบบ host,port (comma) จะชัวร์กับ pyodbc
MASTER_URL  = f"mssql+pyodbc://{DB_USER}:{DB_PASSWORD}@{DB_SERVER},1433/master?driver={DB_DRIVER}&{DB_EXTRA}"
DATABASE_URL = f"mssql+pyodbc://{DB_USER}:{DB_PASSWORD}@{DB_SERVER},1433/{DB_NAME}?driver={DB_DRIVER}&{DB_EXTRA}"

engine_master = create_engine(MASTER_URL, isolation_level="AUTOCOMMIT", connect_args={"timeout": 30})

try:
    with engine_master.connect() as conn:
        result = conn.execute(text("SELECT name FROM sys.databases WHERE name = :dbname"), {"dbname": DB_NAME})
        if not result.first():
            conn.execute(text(f"CREATE DATABASE {DB_NAME}"))
            print(f"✅ Created database: {DB_NAME}")
        else:
            print(f"✅ Database already exists: {DB_NAME}")
except Exception as e:
    print(f"❌ Failed to connect to master DB or create database: {e}")

engine = create_engine(DATABASE_URL, connect_args={"timeout": 30})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
