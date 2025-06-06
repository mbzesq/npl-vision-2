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

// Delete ALL loans (use with caution!)
router.delete('/all/clear', async (req, res) => {
  try {
    // Optional: Add some basic protection
    if (req.query.confirm !== 'yes') {
      return res.status(400).json({ 
        error: 'Add ?confirm=yes to the URL to confirm deletion of all loans' 
      });
    }

    const loanCount = await Loan.count();
    const logCount = await ExtractionLog.count();

    // Clear all loans
    await Loan.destroy({
      where: {},
      truncate: true
    });

    // Clear all extraction logs
    await ExtractionLog.destroy({
      where: {},
      truncate: true
    });

    res.json({ 
      message: `Successfully deleted ${loanCount} loans and ${logCount} extraction logs` 
    });

  } catch (error) {
    console.error('Error clearing loans:', error);
    res.status(500).json({ error: 'Failed to clear loans' });
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