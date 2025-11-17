const MonthlyRepo = require("../repositories/monthlyData.repository");
const MonthlyLogRepo = require("../repositories/monthlyDataLog.repository");
const MovementRepo = require("../repositories/transactionMovement.repository");
const MovementLogRepo = require("../repositories/transactionMovementLog.repository");
const db = require("../models");
const { Op } = require("sequelize");

// Helper function to get default value for empty/null/undefined values
const getDefaultValue = (value, defaultValue) => {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }
  return value;
};

class MasterUploadService {
  async insertMonthly(rows = [], { transaction } = {}) {
    if (!rows?.length) return { inserted: 0 };

    // Build composite keys from incoming rows
    const incomingKeys = [];
    const seenIncoming = new Set();
    const normalizedRows = [];
    for (const r of rows) {
      const key = `${r.ctrlDeclarationNo ?? ""}::${r.itemNo ?? ""}`;
      if (!r.ctrlDeclarationNo || r.itemNo == null) {
        // If key incomplete, still allow insert (cannot dedupe reliably)
        normalizedRows.push(r);
        continue;
      }
      if (!seenIncoming.has(key)) {
        seenIncoming.add(key);
        incomingKeys.push({ ctrlDeclarationNo: r.ctrlDeclarationNo, itemNo: r.itemNo });
        normalizedRows.push(r);
      }
    }

    // Query existing records to skip duplicates by (ctrlDeclarationNo, itemNo)
    let filteredRows = normalizedRows;
    if (incomingKeys.length > 0) {
      const existing = await db.monthlyData.findAll({
        attributes: ["ctrlDeclarationNo", "itemNo"],
        where: {
          [Op.or]: incomingKeys.map(k => ({ ctrlDeclarationNo: k.ctrlDeclarationNo, itemNo: k.itemNo })),
        },
        transaction,
      });
      const existingSet = new Set(
        existing.map(e => `${e.ctrlDeclarationNo ?? ""}::${e.itemNo ?? ""}`)
      );
      filteredRows = normalizedRows.filter(r => {
        const k = `${r.ctrlDeclarationNo ?? ""}::${r.itemNo ?? ""}`;
        return !existingSet.has(k);
      });
    }

    if (!filteredRows.length) return { inserted: 0 };

    const created = await MonthlyRepo.bulkCreate(
      filteredRows.map(r => ({
        invoiceNo: getDefaultValue(r.invoiceNo, "-"),
        itemNo: getDefaultValue(r.itemNo, 0),
        importerNameEN: getDefaultValue(r.importerNameEN, "-"),
        description: getDefaultValue(r.description, "-"),
        quantity: getDefaultValue(r.quantity, 0),
        unit: getDefaultValue(r.unit, "-"),
        netWeight: getDefaultValue(r.netWeight, 0),
        netWeightUnit: getDefaultValue(r.netWeightUnit, "-"),
        currency: getDefaultValue(r.currency, "-"),
        amount: getDefaultValue(r.amount, 0),
        cifTHB: getDefaultValue(r.cifTHB, 0),
        dutyRate: getDefaultValue(r.dutyRate, 0),
        dutyAmt: getDefaultValue(r.dutyAmt, 0),
        tariff: getDefaultValue(r.tariff, "-"),
        ctrlDeclarationNo: getDefaultValue(r.ctrlDeclarationNo, "-"),
        consignmentCountry: getDefaultValue(r.consignmentCountry, "-"),
        netWeight2: r.netWeight2 ?? null,
        netWeightUnit2: r.netWeightUnit2 ?? null,
        grossWeight: r.grossWeight ?? null,
        grossWeightUnit: r.grossWeightUnit ?? null,
        currencyCode: getDefaultValue(r.currencyCode, "-"),
        invoiceCurrency: getDefaultValue(r.invoiceCurrency, "-"),
        arrivalDate: r.arrivalDate ?? null,
      })),
      { transaction }
    );
    return { inserted: created.length };
  }

  async logMonthly(rows = [], { action = "INSERT", transaction } = {}) {
    if (!rows?.length) return { inserted: 0 };

    const normalizedRows = [];
    const seenKeys = new Set();
  
    for (const r of rows) {
      const key = `${r.ctrlDeclarationNo ?? ""}::${r.itemNo ?? ""}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        normalizedRows.push(r);
      }
    }
    if (!normalizedRows.length) {
      return { inserted: 0 };
    }

    try {
      const created = await MonthlyLogRepo.bulkCreate(
        normalizedRows.map(r => ({
          invoiceNo: getDefaultValue(r.invoiceNo, "-"),
          itemNo: getDefaultValue(r.itemNo, 0),
          importerNameEN: getDefaultValue(r.importerNameEN, "-"),
          description: getDefaultValue(r.description, "-"),
          quantity: getDefaultValue(r.quantity, 0),
          unit: getDefaultValue(r.unit, "-"),
          netWeight: getDefaultValue(r.netWeight, 0),
          netWeightUnit: getDefaultValue(r.netWeightUnit, "-"),
          currency: getDefaultValue(r.currency, "-"),
          amount: getDefaultValue(r.amount, 0),
          cifTHB: getDefaultValue(r.cifTHB, 0),
          dutyRate: getDefaultValue(r.dutyRate, 0),
          dutyAmt: getDefaultValue(r.dutyAmt, 0),
          tariff: getDefaultValue(r.tariff, "-"),
          ctrlDeclarationNo: getDefaultValue(r.ctrlDeclarationNo, "-"),
          consignmentCountry: getDefaultValue(r.consignmentCountry, "-"),
          netWeight2: r.netWeight2 ?? null,
          netWeightUnit2: r.netWeightUnit2 ?? null,
          grossWeight: r.grossWeight ?? null,
          grossWeightUnit: r.grossWeightUnit ?? null,
          currencyCode: getDefaultValue(r.currencyCode, "-"),
          invoiceCurrency: getDefaultValue(r.invoiceCurrency, "-"),
          arrivalDate: r.arrivalDate ?? null,
          action,
        })),
        { transaction }
      );
      console.log(`[logMonthly] Successfully logged ${created.length} rows`);
      return { inserted: created.length };
    } catch (error) {
      console.error("[logMonthly] Error:", error);
      throw error;
    }
  }

  async insertMovement(rows = [], { transaction } = {}) {
    if (!rows?.length) return { inserted: 0 };

    // Build composite keys from incoming rows (declarationNo + declarationLineNumber)
    const incomingKeys = [];
    const seenIncoming = new Set();
    const normalizedRows = [];
    for (const r of rows) {
      const key = `${r.declarationNo ?? ""}::${r.declarationLineNumber ?? ""}`;
      if (!r.declarationNo || r.declarationLineNumber == null) {
        normalizedRows.push(r);
        continue;
      }
      if (!seenIncoming.has(key)) {
        seenIncoming.add(key);
        incomingKeys.push({ declarationNo: r.declarationNo, declarationLineNumber: r.declarationLineNumber });
        normalizedRows.push(r);
      }
    }

    // Query existing TransactionMovement to skip duplicates by (declarationNo, declarationLineNumber)
    let filteredRows = normalizedRows;
    if (incomingKeys.length > 0) {
      const existing = await db.transactionMovement.findAll({
        attributes: ["declarationNo", "declarationLineNumber"],
        where: {
          [Op.or]: incomingKeys.map(k => ({ declarationNo: k.declarationNo, declarationLineNumber: k.declarationLineNumber })),
        },
        transaction,
      });
      const existingSet = new Set(
        existing.map(e => `${e.declarationNo ?? ""}::${e.declarationLineNumber ?? ""}`)
      );
      filteredRows = normalizedRows.filter(r => {
        const k = `${r.declarationNo ?? ""}::${r.declarationLineNumber ?? ""}`;
        return !existingSet.has(k);
      });
    }

    if (!filteredRows.length) return { inserted: 0 };

    const created = await MovementRepo.bulkCreate(
      filteredRows.map(r => ({
        invoiceNo: r.invoiceNo ?? null,
        itemNo: r.itemNo ?? null,
        exporterNameEN: r.exporterNameEN ?? null,
        description: r.description ?? null,
        declarationNo: r.declarationNo ?? null,
        declarationLineNumber: r.declarationLineNumber ?? null,
        ctrlDeclarationNo: r.ctrlDeclarationNo ?? null,
        quantity: r.quantity ?? null,
        unit: r.unit ?? null,
        netWeight: r.netWeight ?? null,
        netWeightUnit: r.netWeightUnit ?? null,
        grossWeight: r.grossWeight ?? null,
        grossWeightUnit: r.grossWeightUnit ?? null,
      })),
      { transaction }
    );
    return { inserted: created.length };
  }

  async logMovement(rows = [], { action = "INSERT", transaction } = {}) {
    if (!rows?.length) return { inserted: 0 };

    const normalizedRows = [];
    const seenKeys = new Set();
    
    for (const r of rows) {
      const key = `${r.declarationNo ?? ""}::${r.declarationLineNumber ?? ""}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        normalizedRows.push(r);
      }
    }

    if (!normalizedRows.length) return { inserted: 0 };

    try {
      const created = await MovementLogRepo.bulkCreate(
        normalizedRows.map(r => ({
          invoiceNo: r.invoiceNo ?? null,
          itemNo: r.itemNo ?? null,
          exporterNameEN: r.exporterNameEN ?? null,
          description: r.description ?? null,
          declarationNo: r.declarationNo ?? null,
          declarationLineNumber: r.declarationLineNumber ?? null,
          ctrlDeclarationNo: r.ctrlDeclarationNo ?? null,
          quantity: r.quantity ?? null,
          unit: r.unit ?? null,
          netWeight: r.netWeight ?? null,
          netWeightUnit: r.netWeightUnit ?? null,
          grossWeight: r.grossWeight ?? null,
          grossWeightUnit: r.grossWeightUnit ?? null,
          action,
        })),
        { transaction }
      );
      console.log(`[logMovement] Successfully logged ${created.length} rows`);
      return { inserted: created.length };
    } catch (error) {
      console.error("[logMovement] Error:", error);
      throw error;
    }
  }
}

module.exports = new MasterUploadService();


