module.exports = (sequelize, DataTypes) => {
    const ProductStatus = sequelize.define(
        "ProductStatus",
        {
            productStatusId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            productStatusName: {
                type: DataTypes.STRING(20),
                unique:true,
                allowNull: false
            }
        },
        {
            freezeTableName: true,
        }
    );
    return ProductStatus;
};
