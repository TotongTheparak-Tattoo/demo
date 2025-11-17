module.exports = (sequelize, DataTypes) => {
    const ProductDetails = sequelize.define(
        "ProductDetails",
        {
            productDetailsId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                unique: true,
                allowNull: false,
                autoIncrement: true,
            },
            mfgDate: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            boxNo: {
                type: DataTypes.STRING(50),
                allowNull: false
            },
            masterInvoiceNo: {
                type: DataTypes.STRING(30),
                primaryKey: true, //compound key
                allowNull: false
            },
            caseNo: {
                type: DataTypes.STRING(10),
                primaryKey: true, //compound key
                allowNull: false
            },
            poNo: {
                type: DataTypes.STRING(30),
                allowNull: false
            },
            lotNo: {
                type: DataTypes.STRING(30),
                primaryKey: true, //compound key
                allowNull: false
            },
            heatNo: {
                type: DataTypes.STRING(30),
                allowNull: false
            },
            itemName: {
                type: DataTypes.STRING(30),
                allowNull: false
            },
            spec: {
                type: DataTypes.STRING(50),
                primaryKey: true, //compound key
                allowNull: false
            },
            size: {
                type: DataTypes.STRING(30),
                primaryKey: true, //compound key
                allowNull: false
            },
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            unit: {
                type: DataTypes.STRING(5),
                allowNull: false
            },
            width: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            currency: {
                type: DataTypes.STRING(5),
                allowNull: false
            },
            unitPrice: {
                type: DataTypes.FLOAT,
                allowNull: false
            },
            amount: {
                type: DataTypes.FLOAT,
                allowNull: false
            },
            netWeight: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            grossWeight: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            importEntryNo: {
                type: DataTypes.STRING(20),
                allowNull: false
            },
            remark: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            vendorMasterId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                references: {
                    model: 'VendorMaster',
                    key: 'vendorMasterId',
                }
            }
        },
        {
            indexes: [
                {
                    unique: true,
                    fields: ['masterInvoiceNo', 'caseNo', 'lotNo', 'spec', 'size']
                }
            ]
        },
        {
            freezeTableName: true,
        }
    );
    return ProductDetails;
};
