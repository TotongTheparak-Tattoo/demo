module.exports = (sequelize, DataTypes) => {
  const Location = sequelize.define(
      "Location",
      {
          locationId: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              allowNull: false,
              autoIncrement: true,
          },
          locationCode : {
              type: DataTypes.STRING(10),
              allowNull: false,
              unique: true
          },
          rack: {
              type: DataTypes.STRING(3),
              allowNull: false,
          },
          bay: {
              type: DataTypes.STRING(1),
              allowNull: true
          },
          shelf: {
              type: DataTypes.INTEGER,
              allowNull: true
          },
          subBay : {
              type: DataTypes.INTEGER,
              allowNull: true
          },
          locationZoneId :{
             type: DataTypes.INTEGER,
             allowNull: false
          },
          subLocation :{
             type: DataTypes.INTEGER,
             allowNull: false
          },
          weight :{
             type: DataTypes.INTEGER,
             allowNull: false
          }
      },
      {
          freezeTableName: true,

      }
  );
  return Location;
};
