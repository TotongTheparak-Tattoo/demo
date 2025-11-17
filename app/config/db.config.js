const CreateAssociationOneToMany = (belongsToModel, hasManyModel, fk) => {
  belongsToModel.belongsTo(hasManyModel, {
    foreignKey: fk,
  });
  hasManyModel.hasMany(belongsToModel, {
    foreignKey: fk,
  });
};

const CreateAssociationOneToOne = (belongsToModel, hasOneModel, fk) => {
  belongsToModel.belongsTo(hasOneModel, {
    foreignKey: fk,
  });
  hasOneModel.hasOne(belongsToModel, {
    foreignKey: fk,
  });
};

const dialectOptions = {
  options:{
    requestTimeout: 180000
  },
  useUTC: "true",
  dateStrings: true,
  typeCast: true,
  timezone: "+07:00"
};

// Only add instance if DB_INSTANCE is set (for local SQL Server Express)
if (process.env.DB_INSTANCE) {
  dialectOptions.instance = process.env.DB_INSTANCE;
}

module.exports = {
  // dialect: "mysql",
  dialect: "mssql",
  dialectOptions,
  CreateAssociationOneToMany,
  CreateAssociationOneToOne,
};
