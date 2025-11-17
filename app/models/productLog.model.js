module.exports = (sequelize, DataTypes) => {
    const ProductLog = sequelize.define(
        "ProductLog",
        {
            productLogId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            palletNo: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            mfgDate: {
                type: DataTypes.DATEONLY,
                allowNull: true
            },
            productDetailsId: {
                type: DataTypes.INTEGER,
                primaryKey: true, //compound key
                allowNull: false,
                references: {
                    model: 'ProductDetails',
                    key: 'productDetailsId'
                }
            },
            productStatusId: {
                type: DataTypes.INTEGER,
                primaryKey: true, //compound key
                allowNull: false,
            },
            locationId: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            mrRequestId: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
        },
        {
            freezeTableName: true,
        }
    );
    return ProductLog;
};
