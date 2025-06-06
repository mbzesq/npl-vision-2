const express = require('express');
const router = express.Router();
const { ExtractionLog } = require('../models');

// Get extraction logs with pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      fileType
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    if (status) {
      where.status = status;
    }
    if (fileType) {
      where.file_type = fileType;
    }

    const { count, rows } = await ExtractionLog.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['extraction_timestamp', 'DESC']]
    });

    res.json({
      logs: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get extraction logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve extraction logs' });
  }
});

// Get single extraction log
router.get('/:id', async (req, res) => {
  try {
    const log = await ExtractionLog.findByPk(req.params.id);
    
    if (!log) {
      return res.status(404).json({ error: 'Extraction log not found' });
    }

    res.json(log);
  } catch (error) {
    console.error('Get extraction log error:', error);
    res.status(500).json({ error: 'Failed to retrieve extraction log' });
  }
});

// Get extraction statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const totalExtractions = await ExtractionLog.count();
    const successfulExtractions = await ExtractionLog.count({
      where: { status: 'completed' }
    });
    const failedExtractions = await ExtractionLog.count({
      where: { status: 'failed' }
    });
    
    const avgProcessingTime = await ExtractionLog.aggregate(
      'processing_time_ms', 
      'AVG',
      { where: { status: 'completed' } }
    );

    const recentExtractions = await ExtractionLog.findAll({
      limit: 5,
      order: [['extraction_timestamp', 'DESC']],
      attributes: ['id', 'file_name', 'status', 'extraction_timestamp', 'successful_extractions']
    });

    res.json({
      totalExtractions,
      successfulExtractions,
      failedExtractions,
      successRate: totalExtractions > 0 ? (successfulExtractions / totalExtractions * 100).toFixed(2) : 0,
      avgProcessingTime: avgProcessingTime || 0,
      recentExtractions
    });
  } catch (error) {
    console.error('Get extraction stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve extraction statistics' });
  }
});

module.exports = router;