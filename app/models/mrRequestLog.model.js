module.exports = (sequelize, DataTypes) => {
  const MRRequestLog = sequelize.define(
    "MRRequestLog",
    {
      mrRequestLogId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      mrNo: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      mrNoDate: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      mrNoIncrement: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      stockOutDate: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      invoiceNo_MasterLot: {
        type: DataTypes.STRING(30),
        primaryKey: true, //compound key
        allowNull: false,
      },
      invoiceNo_PartialInv: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      nmbPoNo: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      itemName: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      itemNo: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      lotNo: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      caseNo: {
        type: DataTypes.STRING(10),
        primaryKey: true, // compound key
        allowNull: false,
      },
      spec: {
        type: DataTypes.STRING(50),
        primaryKey: true, // compound key
        allowNull: false,
      },
      size: {
        type: DataTypes.STRING(30),
        primaryKey: true, // compound key
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      unit: {
        type: DataTypes.STRING(5),
        allowNull: false,
      },
      exportEntryNo: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      remark: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
    },
    {
      freezeTableName: true,
    }
  );
  return MRRequestLog;
};