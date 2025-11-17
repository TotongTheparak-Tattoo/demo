module.exports = (sequelize, DataTypes) => {
    const ProductBalance = sequelize.define(
        "ProductBalance",
        {
            productBalanceId: {
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
                unique: true,
                allowNull: false,
                references: {
                    model: 'ProductDetails',
                    key: 'productDetailsId'
                }
            },
            mrRequestId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null,
            },
        },
        {
            freezeTableName: true,
        },


    );

    return ProductBalance;
};
