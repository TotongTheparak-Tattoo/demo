// models/authentication.js
module.exports = (sequelize, DataTypes) => {
  const Authentication = sequelize.define(
    "Authentication",
    {
      authId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      empNo: {
        type: DataTypes.STRING(10),
        unique: true,
        allowNull: false,
      },
      password: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      signupStatus: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "deactivate",
      },
      roleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Role", key: "roleId" },
      },
      levelId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Level", key: "levelId" },
      },
      divisionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Division", key: "divisionId" },
      },
    },
    {
      freezeTableName: true,
    }
  );
  return Authentication;
};
