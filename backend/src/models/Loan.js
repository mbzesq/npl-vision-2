const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Loan = sequelize.define('Loan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  loan_number: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true
  },
  borrower_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  co_borrower_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  property_address: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  property_city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  property_state: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  property_zip: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  loan_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  interest_rate: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    validate: {
      min: 0,
      max: 1 // Stored as decimal (e.g., 0.05 for 5%)
    }
  },
  maturity_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  loan_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  current_upb: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  accrued_interest: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  total_balance: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  last_paid_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  next_due_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  remaining_term: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  legal_status: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  lien_position: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  investor_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  servicer_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  monthly_payment: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  loan_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  property_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  next_due_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  document_types: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  // Future-proofing columns
  servicing_data: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  property_data: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  credit_data: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  analytics_data: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'loans',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['loan_number']
    },
    {
      fields: ['borrower_name']
    },
    {
      fields: ['property_address']
    }
  ]
});

module.exports = Loan;