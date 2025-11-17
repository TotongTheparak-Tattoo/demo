module.exports = (sequelize, DataTypes) => {
  const ItemList = sequelize.define(
    "ItemList",
    {
      itemListId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      spec: {
        type: DataTypes.STRING(50),
        primaryKey: true, //compound key
        allowNull: false,
      },
      dia: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      length: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      size: {
        type: DataTypes.STRING(30),
        primaryKey: true, //compound key
        allowNull: false,
      },
      l: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      w: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      h: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      subLocation: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      weight: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      vendorMasterId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "VendorMaster",
          key: "vendorMasterId",
        },
      },
      locationZoneId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "LocationZone",
          key: "locationZoneId",
        },
      },
      makerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Maker",
          key: "makerId",
        },
      },
    },
    {
      freezeTableName: true,
    }
  );
  return ItemList;
};
