const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExtractionLog = sequelize.define('ExtractionLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  file_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['excel', 'pdf', 'xlsx', 'xls']]
    }
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  extraction_timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  total_records_found: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  successful_extractions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  failed_extractions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  missing_fields: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  errors: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  processing_time_ms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'completed',
    validate: {
      isIn: [['pending', 'processing', 'completed', 'failed']]
    }
  }
}, {
  tableName: 'extraction_logs',
  timestamps: false,
  underscored: true
});

module.exports = ExtractionLog;