module.exports = (sequelize, DataTypes) => {
  const LocationZone = sequelize.define(
    "LocationZone",
    {
      locationZoneId : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      zone : {
        type: DataTypes.STRING(1),
        allowNull: false,
        unique: true,
      },
      type:{
        type : DataTypes.STRING(10),
        allowNull: false,
      }
    },
    {
      freezeTableName: true,
    }
  );
  return LocationZone;
};
