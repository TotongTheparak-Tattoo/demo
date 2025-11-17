// models/mr-request.model.js
module.exports = (sequelize, DataTypes) => {
  const MRRequest = sequelize.define(
    "MRRequest",
    {
      mrRequestId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      mrNo: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      requestDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      deliveryTo: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      partialInvoice: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      masterInvoiceNo: {
        type: DataTypes.STRING(30),
        // primaryKey: true, //compound key
        allowNull: false,
      },
      caseNo: {
        type: DataTypes.STRING(10),
        // primaryKey: true, //compound key
        allowNull: false,
      },
      poNo: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      lotNo: {
        type: DataTypes.STRING(30),
        // primaryKey: true, //compound key
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      spec: {
        type: DataTypes.STRING(50),
        // primaryKey: true, //compound key
        allowNull: false,
      },
      size: {
        type: DataTypes.STRING(30),
        // primaryKey: true, //compound key
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
      netWeight: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      grossWeight: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      exportEntryNo: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      vendorMasterId: {
        type: DataTypes.INTEGER,
        // primaryKey: true,
        allowNull: true,
      },
    },
    {
      freezeTableName: true,
      indexes: [
        {
          unique: true,
          fields: ["masterInvoiceNo", "caseNo", "spec", "size", "lotNo"],
        },
      ],
    }
  );

  return MRRequest;
};
