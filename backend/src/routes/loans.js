const express = require('express');
const router = express.Router();
const { Loan, ExtractionLog } = require('../models');
const { Op } = require('sequelize');

// Get all loans with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      status,
      investor
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Add search conditions
    if (search) {
      where[Op.or] = [
        { loan_number: { [Op.iLike]: `%${search}%` } },
        { borrower_name: { [Op.iLike]: `%${search}%` } },
        { property_address: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Add filters
    if (status) {
      where.legal_status = status;
    }
    if (investor) {
      where.investor_name = investor;
    }

    const { count, rows } = await Loan.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder]]
    });

    res.json({
      loans: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get loans error:', error);
    res.status(500).json({ error: 'Failed to retrieve loans' });
  }
});

// Get single loan by ID
router.get('/:id', async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    res.json(loan);
  } catch (error) {
    console.error('Get loan error:', error);
    res.status(500).json({ error: 'Failed to retrieve loan' });
  }
});

// Update loan
router.put('/:id', async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    await loan.update(req.body);
    res.json(loan);
  } catch (error) {
    console.error('Update loan error:', error);
    res.status(500).json({ error: 'Failed to update loan' });
  }
});

// Delete loan
router.delete('/:id', async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    await loan.destroy();
    res.json({ message: 'Loan deleted successfully' });
  } catch (error) {
    console.error('Delete loan error:', error);
    res.status(500).json({ error: 'Failed to delete loan' });
  }
});

// Clear all data (GET request for easier testing)
router.get('/clear-all', async (req, res) => {
  try {
    const loanCount = await Loan.count();
    const logCount = await ExtractionLog.count();

    // Clear all data
    await Loan.destroy({ where: {} });
    await ExtractionLog.destroy({ where: {} });

    res.json({ 
      success: true,
      message: `Cleared ${loanCount} loans and ${logCount} extraction logs` 
    });

  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear data',
      details: error.message 
    });
  }
});

// Get loan statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const totalLoans = await Loan.count();
    const totalUPB = await Loan.sum('current_upb');
    const averageInterestRate = await Loan.aggregate('interest_rate', 'AVG');
    
    const loansByStatus = await Loan.findAll({
      attributes: [
        'legal_status',
        [Loan.sequelize.fn('COUNT', Loan.sequelize.col('id')), 'count']
      ],
      group: ['legal_status']
    });

    res.json({
      totalLoans,
      totalUPB,
      averageInterestRate,
      loansByStatus
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

module.exports = router;