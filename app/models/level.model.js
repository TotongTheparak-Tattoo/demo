module.exports = (sequelize, DataTypes) => {
  const Level = sequelize.define(
    "Level",
    {
      levelId : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      levelName : {
        type: DataTypes.STRING(15),
        allowNull: false,
        unique: true,
      },
    },
    {
      freezeTableName: true,
    }
  );
  return Level;
};
