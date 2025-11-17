const db = require("../models");
const { Op } = db.Sequelize;
const ProductLog = db.productLog;
const Division = db.division;
const ProductDetails = db.productDetails;
const ProductStatus = db.productStatus;
const Location = db.location;
const BaseRepository = require("./base.repository");

class ProductLogRepository extends BaseRepository {
  constructor() {
    super(ProductLog);
  }
  async findAll(opts = {}) {
    const {
      where = {},
      order = [
        ["updatedAt", "DESC"],
        ["productLogId", "DESC"],
      ],
      raw = true,
      ...rest
    } = opts || {};

    return this.model.findAll({
      where,
      order,
      raw,
      ...rest,
    });
  }
  async InsertProductLogTransaction(data, transaction) {
    let date = new Date();
    date.setHours(date.getHours() + 7);
    if (date.getUTCHours() < 7) {
      date.setDate(date.getDate() - 1);
    }
    return await ProductLog.create(
      {
        mfgDate: date,
        palletNo: data.palletNo,
        productDetailsId: data.productDetailsId,
        productStatusId: data.productStatusId,
        locationId: data.locationId,
        mrRequestId: data.mrRequestId,
      },
      { transaction }
    );
  }
  async InsertProductLogUpload(productDetailsId, transaction) {
    return await ProductLog.create({
      productDetailsId: productDetailsId,
      productStatusId: 4,
    }, {
      transaction: transaction
    });
  }
  async deleteProductLogByProductDetailsId(productDetailsId, transaction) {
    return await ProductLog.destroy({ where: { productDetailsId: productDetailsId }, transaction })
  }
  async InsertProductLogPutAway(data) {
    let date = new Date();
    date.setHours(date.getHours() + 7);
    if (date.getUTCHours() < 7) {
      date.setDate(date.getDate() - 1);
    }

    return await ProductLog.create({
      palletNo: data.palletNo,
      mfgDate: date,
      productDetailsId: data.productDetailsId,
      productStatusId: data.productStatusId,
      locationId: data.locationId,
    });
  }
  async InsertProductLog(data) {
    let date = new Date();
    date.setHours(date.getHours() + 7);
    if (date.getUTCHours() < 7) {
      date.setDate(date.getDate() - 1);
    }
    const exists = await ProductLog.findOne({
      where: {
        palletNo: data.palletNo,
        productDetailsId: data.productDetailsId,
        productStatusId: data.productStatusId,
        locationId: data.locationId,
      }
    });

    if (!exists) {
      return await ProductLog.create({
        palletNo: data.palletNo,
        mfgDate: date,
        productDetailsId: data.productDetailsId,
        productStatusId: data.productStatusId,
        locationId: data.locationId,
      });
    } else {
      console.log('Duplicate log skipped:', data);
      return null;
    }
  }
  async updateProductLog(data) {
    return await ProductLog.update(
      { locationId: data.locationId },
      { where: { palletNo: data.palletNo } }
    );
  }
  async getTransactionLog(start, end) {
    return await ProductLog.findAll({
      include: [
        { model: ProductDetails, required: true },
        { model: ProductStatus, required: true },
        {
          model: Location, required: false,
          include: [{ model: Division, required: true }],
        },
      ],
      where: {
        "$ProductStatus.productStatusName$": {
          [db.Sequelize.Op.in]: [
            "receive",
            "put away",
            "picking",
            "change location",
          ],
        },
        createdAt: {
          [db.Sequelize.Op.between]: [start, end],
        },
      },
      raw: true,
      logging: console.log
    });
  }
  async getReceiveHomeCard() {
    const query = `
        WITH rawTB AS (
          SELECT 
            [ProductLog].[productLogId], 
            [ProductLog].[palletNo], 
            [ProductLog].[mfgDate], 
            [ProductLog].[productDetailsId],
            [ProductLog].[productStatusId], 
            [ProductLog].[locationId],
            [ProductLog].[createdAt],
            [ProductLog].[updatedAt],
            [ProductDetail].[productDetailsId] AS [ProductDetail.productDetailsId],
            [ProductDetail].[mfgDate] AS [ProductDetail.mfgDate],
            [ProductDetail].[boxNo] AS [ProductDetail.boxNo],
            [ProductStatus].[productStatusId] AS [ProductStatus.productStatusId],
            [ProductStatus].[productStatusName] AS [ProductStatus.productStatusName],
            [Location].[locationId] AS [Location.locationId],
            [Location].[locationCode] AS [Location.locationCode],
            [Location].[divisionId] AS [Location.divisionId]
          FROM [ProductLog] 
          LEFT OUTER JOIN [ProductDetails] AS [ProductDetail] 
            ON [ProductLog].[productDetailsId] = [ProductDetail].[productDetailsId] 
          INNER JOIN [ProductStatus] AS [ProductStatus] 
            ON [ProductLog].[productStatusId] = [ProductStatus].[productStatusId] 
          LEFT OUTER JOIN [Location] AS [Location] 
            ON [ProductLog].[locationId] = [Location].[locationId] 
          WHERE [ProductStatus].[productStatusName] IN ('receive')
        )
        SELECT 
          COUNT(DISTINCT 
            CAST(palletNo AS VARCHAR) + '|' + CONVERT(VARCHAR(10), mfgDate, 120)
          ) AS count
        FROM rawTB
        WHERE CONVERT(DATE, mfgDate) = (
          SELECT 
            CASE 
              WHEN DATEPART(HOUR, DATEADD(HOUR, 7, GETUTCDATE())) < 7 
                THEN CONVERT(DATE, DATEADD(DAY, -1, DATEADD(HOUR, 7, GETUTCDATE())))
              ELSE CONVERT(DATE, DATEADD(HOUR, 7, GETUTCDATE()))
            END
        );
      `;
    const [results] = await db.sequelize.query(query);
    return results[0];
  }
  async getPutawayHomeCard() {
    const query = `
        WITH rawTB AS (
  SELECT 
    [ProductLog].[productLogId], 
    [ProductLog].[palletNo], 
    [ProductLog].[mfgDate], 
    [ProductLog].[productDetailsId],
    [ProductLog].[productStatusId], 
    [ProductLog].[locationId],
    [ProductLog].[createdAt],
    [ProductLog].[updatedAt],
    [ProductDetail].[productDetailsId] AS [ProductDetail.productDetailsId],
    [ProductDetail].[mfgDate] AS [ProductDetail.mfgDate],
    [ProductDetail].[boxNo] AS [ProductDetail.boxNo],
    [ProductStatus].[productStatusId] AS [ProductStatus.productStatusId],
    [ProductStatus].[productStatusName] AS [productStatusName]
  FROM [ProductLog] 
  LEFT OUTER JOIN [ProductDetails] AS [ProductDetail] 
    ON [ProductLog].[productDetailsId] = [ProductDetail].[productDetailsId] 
  INNER JOIN [ProductStatus] AS [ProductStatus] 
    ON [ProductLog].[productStatusId] = [ProductStatus].[productStatusId] 
  WHERE [ProductStatus].[productStatusName] IN ('receive', 'put away')
)
,summary as (SELECT 
    [productStatusName] ,
  COUNT(DISTINCT CAST(palletNo AS VARCHAR) + '|' + CONVERT(VARCHAR(10), mfgDate, 120)) AS count
FROM rawTB
WHERE CONVERT(DATE, mfgDate) = (
  SELECT 
    CASE 
      WHEN DATEPART(HOUR, DATEADD(HOUR, 7, GETUTCDATE())) < 7 
        THEN CONVERT(DATE, DATEADD(DAY, -1, DATEADD(HOUR, 7, GETUTCDATE())))
      ELSE CONVERT(DATE, DATEADD(HOUR, 7, GETUTCDATE()))
  END
)
GROUP BY  [productStatusName] 
)
SELECT 
  ISNULL(receive.count, 0) AS receiveCount,
  ISNULL(putaway.count, 0) AS putawayCount,
  CASE 
    WHEN ISNULL(receive.count, 0) - ISNULL(putaway.count, 0) < 0 THEN 0
    ELSE ISNULL(receive.count, 0) - ISNULL(putaway.count, 0)
  END AS waitingPutaway
FROM
  (SELECT count FROM summary WHERE productStatusName = 'receive') AS receive
FULL OUTER JOIN
  (SELECT count FROM summary WHERE productStatusName = 'put away') AS putaway
  ON 1 = 1;`;
    const [results] = await db.sequelize.query(query);
    return results[0];
  }
  async getPickingHomeCard() {
    const query = `
        WITH rawTB AS (
          SELECT 
            [ProductLog].[productLogId], 
            [ProductLog].[palletNo], 
            [ProductLog].[mfgDate], 
            [ProductLog].[productDetailsId],
            [ProductLog].[productStatusId], 
            [ProductLog].[locationId],
            [ProductLog].[createdAt],
            [ProductLog].[updatedAt],
            [ProductDetail].[productDetailsId] AS [ProductDetail.productDetailsId],
            [ProductDetail].[mfgDate] AS [ProductDetail.mfgDate],
            [ProductDetail].[boxNo] AS [ProductDetail.boxNo],
            [ProductStatus].[productStatusId] AS [ProductStatus.productStatusId],
            [ProductStatus].[productStatusName] AS [ProductStatus.productStatusName],
            [Location].[locationId] AS [Location.locationId],
            [Location].[locationCode] AS [Location.locationCode],
            [Location].[divisionId] AS [Location.divisionId]
          FROM [ProductLog] 
          LEFT OUTER JOIN [ProductDetails] AS [ProductDetail] 
            ON [ProductLog].[productDetailsId] = [ProductDetail].[productDetailsId] 
          INNER JOIN [ProductStatus] AS [ProductStatus] 
            ON [ProductLog].[productStatusId] = [ProductStatus].[productStatusId] 
          LEFT OUTER JOIN [Location] AS [Location] 
            ON [ProductLog].[locationId] = [Location].[locationId] 
          WHERE [ProductStatus].[productStatusName] IN ('picking')
        )
        SELECT 
          COUNT(DISTINCT 
            CAST(palletNo AS VARCHAR) + '|' + CONVERT(VARCHAR(10), mfgDate, 120)
          ) AS count
        FROM rawTB
        WHERE CONVERT(DATE, mfgDate) = (
          SELECT 
            CASE 
              WHEN DATEPART(HOUR, DATEADD(HOUR, 7, GETUTCDATE())) < 7 
                THEN CONVERT(DATE, DATEADD(DAY, -1, DATEADD(HOUR, 7, GETUTCDATE())))
              ELSE CONVERT(DATE, DATEADD(HOUR, 7, GETUTCDATE()))
            END
        );
      `;
    const [results] = await db.sequelize.query(query);
    return results[0];
  }
  async getTransaction7DaysLogHome() {
    const query = `
        WITH currentDateRef AS (
        SELECT CAST(
          CASE 
            WHEN DATEPART(HOUR, DATEADD(HOUR, 7, GETUTCDATE())) < 7 
              THEN DATEADD(DAY, -1, DATEADD(HOUR, 7, GETUTCDATE()))
            ELSE DATEADD(HOUR, 7, GETUTCDATE())
          END AS DATE
        ) AS refDate
      ),
      calendar AS (
        SELECT DATEADD(DAY, -n.number, refDate) AS logDate
        FROM currentDateRef
        CROSS JOIN (
          SELECT TOP 7 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS number
          FROM master..spt_values
        ) AS n
      ),
      rawTB AS (
        SELECT 
          CONVERT(DATE, [ProductLog].[mfgDate]) AS logDate,
          [ProductStatus].[productStatusName],
          [ProductLog].[palletNo]
        FROM [ProductLog]
        INNER JOIN [ProductStatus]
          ON [ProductLog].[productStatusId] = [ProductStatus].[productStatusId]
        WHERE [ProductStatus].[productStatusName] IN (N'receive', N'picking')
      ),
      filteredTB AS (
        SELECT *
        FROM rawTB, currentDateRef
        WHERE logDate BETWEEN DATEADD(DAY, -6, refDate) AND refDate
      ),
      grouped AS (
        SELECT 
          logDate,
          productStatusName,
          COUNT(DISTINCT CAST(palletNo AS VARCHAR) + '|' + CONVERT(VARCHAR(10), logDate, 120)) AS count
        FROM filteredTB
        GROUP BY logDate, productStatusName
      ),
      joined AS (
        SELECT 
          cal.logDate,
          ISNULL(SUM(CASE WHEN g.productStatusName = 'receive' THEN g.count ELSE 0 END), 0) AS inbound,
          ISNULL(SUM(CASE WHEN g.productStatusName = 'picking' THEN g.count ELSE 0 END), 0) AS outbound
        FROM calendar cal
        LEFT JOIN grouped g ON g.logDate = cal.logDate
        GROUP BY cal.logDate
      )
      SELECT 
        logDate AS [date],
        inbound,
        outbound
      FROM joined
      ORDER BY logDate;
      `;

    const [results] = await db.sequelize.query(query);
    return results;
  }
  async getTransactionLogHome() {
    return await ProductLog.findAll({
      include: [
        { model: ProductDetails, required: false },
        { model: ProductStatus, required: true },
        { model: Location, required: false },
      ],
      where: {
        "$ProductStatus.productStatusName$": { [db.Sequelize.Op.in]: ["receive", "picking"] },
      },
      raw: true,
    });
  }
  async getAllReceivedLog() {
    return await ProductLog.findAll({
      include: [
        { model: ProductDetails, required: true },
        { model: ProductStatus, required: true },
        {
          model: Location,
          required: true,
          include: [{ model: Division, required: true }],
        },
      ],
      where: { "$ProductStatus.productStatusName$": "receive" },
      raw: true,
    });
  }
  async bulkInsertProductLog(data) {
    return await this.model.bulkCreate(data);
  }
  async findAndCountAll(opts = {}) {
    const {
      where = {},
      attributes,
      order = [["updatedAt", "DESC"]],
      offset = 0,
      limit = 50,
      raw = true,
      ...rest
    } = opts || {};

    const result = await this.model.findAndCountAll({
      where,
      attributes,
      order,
      offset,
      limit,
      raw,
      ...rest,
    });
    let count = 0;
    if (typeof result.count === "number") {
      count = result.count;
    } else if (Array.isArray(result.count)) {
      count = result.count.length;
    } else if (result.count && typeof result.count.count === "number") {
      count = result.count.count;
    }

    return {
      rows: Array.isArray(result.rows) ? result.rows : [],
      count,
    };
  }
  async GetLatestProductLog() {
    return await ProductLog.findOne({
      order: [['palletNo', 'DESC']], where: {
        palletNo: {
          [db.Sequelize.Op.ne]: null,
        }
      }, raw: true
    })
  }
}

module.exports = new ProductLogRepository();
