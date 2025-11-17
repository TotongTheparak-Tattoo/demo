module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    "Role",
    {
      roleId : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      roleName : {
        type: DataTypes.STRING(15),
        allowNull: false,
        unique: true,
      },
    },
    {
      freezeTableName: true,
    }
  );
  return Role;
};
