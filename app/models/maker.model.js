module.exports = (sequelize, DataTypes) => {
  const Maker = sequelize.define(
    "Maker",
    {
      makerId : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      makerName : {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
    },
    {
      freezeTableName: true,
    }
  );
  return Maker;
};
