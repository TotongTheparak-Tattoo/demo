module.exports = (sequelize, DataTypes) => {
  const VendorMaster = sequelize.define(
    "VendorMaster",
    {
      vendorMasterId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      vendorMasterCode : {
        type: DataTypes.STRING(7),
        unique: true,
        allowNull: false,
      },
      vendorMasterName: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
      },
    },
    {
      freezeTableName: true,
    }
  );
  return VendorMaster;
};