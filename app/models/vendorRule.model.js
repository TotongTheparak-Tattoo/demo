module.exports = (sequelize, DataTypes) => {
  const VendorRule = sequelize.define(
    "VendorRule",
    {
      vendorRuleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
      },
      vendorRuleCode : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
        allowNull: false,
      },
      palletPerLocation: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      locationZoneId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      freezeTableName: true,
    }
  );
  return VendorRule;
};