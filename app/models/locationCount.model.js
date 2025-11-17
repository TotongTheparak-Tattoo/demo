module.exports = (sequelize, DataTypes) => {
  const LocationCount = sequelize.define(
    "LocationCount",
    {
      locationCountId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      currentCount : {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      locationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      freezeTableName: true,
    }
  );
  return LocationCount;
};