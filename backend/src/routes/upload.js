const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const ExcelProcessor = require('../services/ExcelProcessor');
const PDFProcessor = require('../services/PDFProcessor');
const DataValidator = require('../services/DataValidator');
const { Loan, ExtractionLog } = require('../models');

const excelProcessor = new ExcelProcessor();
const pdfProcessor = new PDFProcessor();
const dataValidator = new DataValidator();

// Upload multiple files
router.post('/', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = {
      successful: [],
      failed: [],
      totalFiles: req.files.length
    };

    // Process each file
    for (const file of req.files) {
      try {
        const fileResult = await processFile(file);
        results.successful.push(fileResult);
      } catch (error) {
        results.failed.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload processing failed' });
  }
});

// Process individual file
async function processFile(file) {
  const startTime = Date.now();
  const fileExt = file.originalname.split('.').pop().toLowerCase();
  
  let processingResult;
  let extractionLog;

  try {
    // Create extraction log entry
    extractionLog = await ExtractionLog.create({
      file_name: file.originalname,
      file_type: fileExt,
      file_size: file.size,
      status: 'processing'
    });

    // Process based on file type
    if (['xlsx', 'xls'].includes(fileExt)) {
      processingResult = await excelProcessor.processFile(file.buffer);
    } else if (fileExt === 'pdf') {
      processingResult = await pdfProcessor.processFile(file.buffer);
    } else {
      throw new Error('Unsupported file type');
    }

    // Validate extracted data
    const validatedData = [];
    const validationErrors = [];

    for (const loanData of processingResult.data) {
      const validation = dataValidator.validateLoanData(loanData);
      
      if (validation.isValid) {
        validatedData.push(loanData);
      } else {
        validationErrors.push({
          data: loanData,
          errors: validation.errors
        });
      }
    }

    // Check for duplicates
    const existingLoans = await Loan.findAll({
      attributes: ['id', 'loan_number', 'borrower_name', 'property_address']
    });
    
    const duplicates = dataValidator.detectDuplicates(validatedData, existingLoans);

    // Update extraction log
    await extractionLog.update({
      status: 'completed',
      total_records_found: processingResult.data.length,
      successful_extractions: validatedData.length,
      failed_extractions: validationErrors.length,
      missing_fields: processingResult.missingFields || [],
      errors: validationErrors,
      processing_time_ms: Date.now() - startTime
    });

    return {
      fileName: file.originalname,
      fileType: fileExt,
      totalRecords: processingResult.data.length,
      successfulExtractions: validatedData.length,
      failedExtractions: validationErrors.length,
      data: validatedData,
      validationErrors,
      duplicateWarnings: duplicates,
      mappingConfidence: processingResult.mappingConfidence,
      processingTime: Date.now() - startTime,
      extractionLogId: extractionLog.id
    };

  } catch (error) {
    // Update extraction log with error
    if (extractionLog) {
      await extractionLog.update({
        status: 'failed',
        errors: [{ message: error.message }],
        processing_time_ms: Date.now() - startTime
      });
    }

    throw error;
  }
}

// Save validated loan data
router.post('/save', async (req, res) => {
  try {
    const { loans } = req.body;
    
    if (!loans || !Array.isArray(loans)) {
      return res.status(400).json({ error: 'Invalid loan data' });
    }

    const savedLoans = [];
    const errors = [];

    for (const loanData of loans) {
      try {
        // Final validation before saving
        const validation = dataValidator.validateLoanData(loanData);
        
        if (!validation.isValid) {
          errors.push({
            data: loanData,
            errors: validation.errors
          });
          continue;
        }

        // Create or update loan
        let loan;
        if (loanData.loan_number) {
          // Try to find existing loan by loan number
          loan = await Loan.findOne({ where: { loan_number: loanData.loan_number } });
          
          if (loan) {
            await loan.update(loanData);
          } else {
            loan = await Loan.create(loanData);
          }
        } else {
          // Create new loan without loan number
          loan = await Loan.create(loanData);
        }

        savedLoans.push(loan);
      } catch (error) {
        errors.push({
          data: loanData,
          error: error.message
        });
      }
    }

    res.json({
      saved: savedLoans.length,
      failed: errors.length,
      savedLoans,
      errors
    });

  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save loan data' });
  }
});

module.exports = router;