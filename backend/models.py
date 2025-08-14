from sqlalchemy import Integer, String, ForeignKey,Float,UniqueConstraint,Date
from sqlalchemy.orm import Mapped, mapped_column ,relationship
from sqlalchemy.sql import func
import datetime
from db import Base
from typing import Optional

class BomWos(Base):
    __tablename__ = "BomWos" 
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)
    wosNo: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    brgNoValue: Mapped[str] = mapped_column(String(100), nullable=True)
    partNoValue: Mapped[str] = mapped_column(String(100), nullable=True)
    partComponentGroup: Mapped[str] = mapped_column(String(100), nullable=True)
    qty: Mapped[int] = mapped_column(Integer, nullable=True)
    parentPartNo: Mapped[str] = mapped_column(String(100), nullable=True, index=True)
    
class Machine(Base):
    __tablename__ = "Machine"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)
    machineGroup: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    machineTypeId: Mapped[str] = mapped_column(ForeignKey("MachineType.id", ondelete="CASCADE"))
    machineLayoutId: Mapped[str] = mapped_column(ForeignKey("MachineLayout.id", ondelete="CASCADE"))
    
    machineLayout = relationship("MachineLayout")
    machineType = relationship("MachineType") 

class MachineType(Base):
    __tablename__ = "MachineType"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)
    machineType: Mapped[str] = mapped_column(String(100), nullable=True)

class MachineLayout(Base):
    __tablename__ = "MachineLayout"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)
    lineNo: Mapped[int] = mapped_column(Integer, nullable=True)
    machineNo: Mapped[str] = mapped_column(String(100), nullable=True)
    locationNo: Mapped[int] = mapped_column(Integer, nullable=True)

class Capacity(Base):
    __tablename__ = "Capacity"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)
    capaDay: Mapped[int] = mapped_column(Integer, nullable=True)
    groupBrgAndMcGroup: Mapped[str] = mapped_column(String(100), nullable=True)
    utilizeMc: Mapped[int] = mapped_column(Integer, nullable=True)
    cycleTime: Mapped[Float] = mapped_column(Integer, nullable=True)
    capaF3: Mapped[int] = mapped_column(Integer, nullable=True)
    machineId: Mapped[int] = mapped_column(ForeignKey("Machine.id", ondelete="CASCADE"))
    bomWosId: Mapped[int] = mapped_column(ForeignKey("BomWos.id", ondelete="CASCADE"))

    # ✅ relationship
    bomWos = relationship("BomWos")
    machine = relationship("Machine")
    join_limit_assies = relationship("JoinLimitAssy", back_populates="capacity")

class LimitAssy(Base):
    __tablename__ = "LimitAssy"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)
    limitByType: Mapped[int] = mapped_column(Integer, nullable=True)
    limitByGroup: Mapped[int] = mapped_column(Integer, nullable=True)
    joinToolingPartNo: Mapped[str] = mapped_column(String(100), nullable=True)

    # ✅ relationship
    join_limit_assies = relationship("JoinLimitAssy", back_populates="limitAssy")

class JoinLimitAssy(Base):
    __tablename__ = "JoinLimitAssy"
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    capacityId: Mapped[int] = mapped_column(ForeignKey("Capacity.id", ondelete="CASCADE"))
    limitAssyId: Mapped[int] = mapped_column(ForeignKey("LimitAssy.id", ondelete="CASCADE"))

    # ✅ relationship
    capacity = relationship("Capacity", back_populates="join_limit_assies")
    limitAssy = relationship("LimitAssy", back_populates="join_limit_assies")

class MachineNotAvailable(Base):
    __tablename__ = "MachineNotAvailable"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    rev: Mapped[int] = mapped_column(Integer, nullable=True)
    machineId: Mapped[int] = mapped_column(ForeignKey("Machine.id", ondelete="CASCADE"))

class ProductionPlan(Base):
    __tablename__ = "ProductinePlan"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    rev: Mapped[int] = mapped_column(Integer, nullable=True)
    machineId: Mapped[int] = mapped_column(ForeignKey("Machine.id", ondelete="CASCADE"))
    bomWosId: Mapped[int] = mapped_column(ForeignKey("BomWos.id", ondelete="CASCADE"))

class BalanceOrderMidSmall(Base):
    __tablename__ = "BalanceOrderMidSmall"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    rev: Mapped[int] = mapped_column(Integer, nullable=True)
    targetPlanMonth: Mapped[str] = mapped_column(String(100), nullable=True)
    orderNo: Mapped[str] = mapped_column(String(100), nullable=True)
    dueDate: Mapped[datetime.date] = mapped_column(index=True)
    balanceOrder: Mapped[int] = mapped_column(Integer, nullable=True)
    partGroup: Mapped[str] = mapped_column(String(100), nullable=True)
    bomWosId: Mapped[int] = mapped_column(ForeignKey("BomWos.id", ondelete="CASCADE"))

class PartAssy(Base):
    __tablename__ = "PartAssy"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)
    sleeveAndThrustBrg: Mapped[str] = mapped_column(String(100), nullable=True)
    partFac1: Mapped[str] = mapped_column(String(100), nullable=True)
    partFac3: Mapped[str] = mapped_column(String(100), nullable=True)
    bomWosId: Mapped[int] = mapped_column(ForeignKey("BomWos.id", ondelete="CASCADE"))

class KpiSetup(Base):
    __tablename__ = "KpiSetup"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    rev: Mapped[int] = mapped_column(Integer, nullable=True)
    setupAverage: Mapped[Float] = mapped_column(Integer, nullable=True)
    maxSetUpPerDay: Mapped[str] = mapped_column(String(100), nullable=True)
    machineId: Mapped[str] = mapped_column(ForeignKey("Machine.id", ondelete="CASCADE"))

class KpiProduction(Base):
    __tablename__ = "KpiProduction"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    rev: Mapped[int] = mapped_column(Integer, nullable=True)
    autoMachineDailyTarget: Mapped[int] = mapped_column(Integer, nullable=True)
    manualDailyTarget: Mapped[int] = mapped_column(Integer, nullable=True)

class WorkingDate(Base):
    __tablename__ = "WorkingDate"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    rev: Mapped[int] = mapped_column(Integer, nullable=True)
    workingDate: Mapped[datetime.date] = mapped_column(index=True)
    workingHr: Mapped[int] = mapped_column(Integer, nullable=True)
    # ✅ unique แบบคู่
    __table_args__ = (
        UniqueConstraint("rev", "workingDate", name="UQ_WorkingDate_rev_workingDate"),
    )

class WipAssy(Base):
    __tablename__ = "WipAssy"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    rev: Mapped[int] = mapped_column(Integer, nullable=True) 
    processValue: Mapped[str] = mapped_column(String(100), nullable=True)
    qty: Mapped[int] = mapped_column(Integer, nullable=True)
    wipType: Mapped[str] = mapped_column(String(100), nullable=True)
    bomWosId: Mapped[int] = mapped_column(ForeignKey("BomWos.id", ondelete="CASCADE"))

class Divition(Base):
    __tablename__ = "Divition"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    divitionName: Mapped[str] = mapped_column(String(100), nullable=True)

class Role(Base):
    __tablename__ = "Roles"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    roleName: Mapped[str] = mapped_column(String(100), nullable=True)

class User(Base):
    __tablename__ = "User"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)
    employeeId: Mapped[str] = mapped_column(String(100), nullable=True)
    firstname: Mapped[str] = mapped_column(String(100), nullable=True)
    lastname: Mapped[str] = mapped_column(String(100), nullable=True)
    email: Mapped[str] = mapped_column(String(100), nullable=True)
    roleId: Mapped[int] = mapped_column(ForeignKey("Roles.id", ondelete="CASCADE"))
    divitionId: Mapped[int] = mapped_column(ForeignKey("Divition.id", ondelete="CASCADE"))

class DataPlan(Base):
    __tablename__ = "DataPlan"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    rev: Mapped[int] = mapped_column(Integer, nullable=True)
    workingDate: Mapped[datetime.date] = mapped_column(index=True)
    planTarget: Mapped[int] = mapped_column(Integer, nullable=True)
    isMachineContinue: Mapped[int] = mapped_column(Integer, nullable=True)
    planType: Mapped[str] = mapped_column(String(100), nullable=True)
    machineId: Mapped[int] = mapped_column(ForeignKey("Machine.id", ondelete="CASCADE"))
    bomWosId: Mapped[int] = mapped_column(ForeignKey("BomWos.id", ondelete="CASCADE"))
    # ✅ relationship
    bomWos = relationship("BomWos")
    machine = relationship("Machine")

class ApproveDataPlan(Base):
    __tablename__ = "ApproveDataPlan"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    rev: Mapped[int] = mapped_column(Integer, nullable=True)
    workingDate: Mapped[datetime.date] = mapped_column(index=True)
    planTarget: Mapped[int] = mapped_column(Integer, nullable=True)
    isMachineContinue: Mapped[int] = mapped_column(Integer, nullable=True)
    planType: Mapped[str] = mapped_column(String(100), nullable=True)
    machineId: Mapped[int] = mapped_column(ForeignKey("Machine.id", ondelete="CASCADE"))
    bomWosId: Mapped[int] = mapped_column(ForeignKey("BomWos.id", ondelete="CASCADE"))
    # ✅ relationship
    bomWos = relationship("BomWos")
    machine = relationship("Machine")

class ProductionPlanActual(Base):
    __tablename__ = "ProductionPlanActual"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registeredAt: Mapped[datetime.datetime] = mapped_column(server_default=func.now(), nullable=False)
    rev: Mapped[int] = mapped_column(Integer, nullable=True)
    machineId: Mapped[int] = mapped_column(Integer, nullable=True)
    startDate: Mapped[datetime.date] = mapped_column(index=True)
    endDate: Mapped[datetime.date] = mapped_column(index=True)
    actualOutput: Mapped[int] = mapped_column(Integer, nullable=True)
    bomWosId: Mapped[int] = mapped_column(ForeignKey("BomWos.id", ondelete="CASCADE"))
