module.exports = (sequelize, DataTypes) => {
	const MonthlyData = sequelize.define(
		"MonthlyData",
		{
			monthlyDataId: {
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
			importerNameEN: {
				type: DataTypes.STRING(50),
				allowNull: false,
			},
			description: {
				type: DataTypes.STRING(50),
				allowNull: false,
			},
			quantity: {
				type: DataTypes.FLOAT,
				allowNull: false,
			},
			unit: {
				type: DataTypes.STRING(10),
				allowNull: false,
			},
			netWeight: {
				type: DataTypes.FLOAT,
				allowNull: false,
			},
			netWeightUnit: {
				type: DataTypes.STRING(10),
				allowNull: false,
			},
			currency: {
				type: DataTypes.STRING(10),
				allowNull: false,
			},
			amount: {
				type: DataTypes.FLOAT,
				allowNull: false,
			},
			cifTHB: {
				type: DataTypes.FLOAT,
				allowNull: false,
			},
			dutyRate: {
				type: DataTypes.FLOAT,
				allowNull: false,
			},
			dutyAmt: {
				type: DataTypes.FLOAT,
				allowNull: false,
			},
			tariff: {
				type: DataTypes.STRING(20),
				allowNull: false,
			},
			ctrlDeclarationNo: {
				type: DataTypes.STRING(30),
				allowNull: false,
			},
			consignmentCountry: {
				type: DataTypes.STRING(10),
				allowNull: false,
			},
			netWeight2: {
				type: DataTypes.FLOAT,
				allowNull: true,
			},
			netWeightUnit2: {
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
			currencyCode: {
				type: DataTypes.STRING(10),
				allowNull: false,
			},
			invoiceCurrency: {
				type: DataTypes.STRING(10),
				allowNull: false,
			},
			arrivalDate: {
				type: DataTypes.DATEONLY,
				allowNull: true,
			},
		},
		{
			freezeTableName: true,
		}
	);
	return MonthlyData;
};
