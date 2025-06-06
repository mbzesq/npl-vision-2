const sequelize = require('../config/database');
const Loan = require('./Loan');
const ExtractionLog = require('./ExtractionLog');

// Define associations here if needed
// For example:
// Loan.hasMany(Document);
// Document.belongsTo(Loan);

module.exports = {
  sequelize,
  Loan,
  ExtractionLog
};