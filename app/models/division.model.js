module.exports = (sequelize, DataTypes) => {
  const Division = sequelize.define(
    "Division",
    {
      divisionId : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      divisionName : {
        type: DataTypes.STRING(15),
        allowNull: false,
        unique: true,
      },
    },
    {
      freezeTableName: true,
    }
  );
  return Division;
};
