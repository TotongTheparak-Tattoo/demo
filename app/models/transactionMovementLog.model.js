module.exports = (sequelize, DataTypes) => {
	const TransactionMovementLog = sequelize.define(
		"TransactionMovementLog",
		{
			transactionMovementLogId: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				allowNull: false,
				autoIncrement: true,
			},
			invoiceNo: {
				type: DataTypes.STRING(30),
				allowNull: false,
			},
			itemNo: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			exporterNameEN: {
				type: DataTypes.STRING(50),
				allowNull: false,
			},
			description: {
				type: DataTypes.STRING(255),
				allowNull: false,
			},
			declarationNo: {
				type: DataTypes.STRING(30),
				allowNull: false,
			},
			declarationLineNumber: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			ctrlDeclarationNo: {
				type: DataTypes.STRING(30),
				allowNull: false,
			},
			quantity: {
				type: DataTypes.FLOAT,
				allowNull: true,
			},
			unit: {
				type: DataTypes.STRING(10),
				allowNull: true,
			},
			netWeight: {
				type: DataTypes.FLOAT,
				allowNull: true,
			},
			netWeightUnit: {
				type: DataTypes.STRING(10),
				allowNull: true,
			},
			grossWeight: {
				type: DataTypes.FLOAT,
				allowNull: true,
			},
			grossWeightUnit: {
				type: DataTypes.STRING(10),
				allowNull: true,
			},
			remarks: {
				type: DataTypes.STRING(255),
				allowNull: true,
			},
			action: {
				type: DataTypes.STRING(10),
				allowNull: false,
			},
		},
		{
			freezeTableName: true,
		}
	);
	return TransactionMovementLog;
};