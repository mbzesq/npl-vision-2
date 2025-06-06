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

// Upload PDF files
router.post('/pdf', upload.any(), async (req, res) => {
  try {
    console.log('📄 PDF upload started, files:', req.files?.length || 0);
    
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
        console.log(`🔄 Processing file: ${file.originalname}`);
        const fileResult = await processFile(file);
        results.successful.push(fileResult);
        console.log(`✅ File processed successfully: ${file.originalname}`);
      } catch (error) {
        console.error(`❌ File processing failed: ${file.originalname}`, error);
        results.failed.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    console.log('📊 Upload results:', results);
    res.json(results);
  } catch (error) {
    console.error('❌ PDF Upload route error:', error);
    console.error('Full error stack:', error.stack);
    res.status(500).json({ 
      error: 'PDF upload processing failed',
      details: error.message,
      stage: 'pdf_upload_route'
    });
  }
});

// Upload multiple files (general endpoint)
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

    // Automatically save validated loan data to database with enhanced duplicate prevention
    const savedLoans = [];
    const saveErrors = [];
    const duplicateActions = [];

    for (const loanData of validatedData) {
      try {
        let loan;
        let action = 'created';
        
        // Enhanced duplicate detection and prevention
        const existingLoan = await findExistingLoan(loanData);
        
        if (existingLoan) {
          // Update existing loan with new/better data
          const updatedFields = mergeAndUpdateLoanData(existingLoan, loanData);
          console.log('🔄 Updating loan with fields:', Object.keys(updatedFields));
          console.log('📊 New data values:', updatedFields);
          
          try {
            await existingLoan.update(updatedFields);
            console.log('✅ Loan update successful');
          } catch (updateError) {
            console.error('❌ Loan update failed:', updateError.message);
            console.error('Failed fields:', Object.keys(updatedFields));
            // Try updating without the new fields that might not exist
            const safeFields = {};
            ['borrower_name', 'co_borrower_name', 'property_address', 'property_city', 
             'property_state', 'property_zip', 'loan_amount', 'current_upb', 'interest_rate',
             'loan_date', 'maturity_date', 'loan_number', 'investor_name'].forEach(field => {
              if (updatedFields[field] !== undefined) {
                safeFields[field] = updatedFields[field];
              }
            });
            await existingLoan.update(safeFields);
            console.log('⚠️ Loan updated with basic fields only (missing new columns)');
          }
          
          loan = existingLoan;
          action = 'updated';
          
          duplicateActions.push({
            loanId: existingLoan.id,
            borrowerName: existingLoan.borrower_name,
            propertyAddress: existingLoan.property_address,
            matchType: getMatchType(existingLoan, loanData),
            fieldsUpdated: Object.keys(updatedFields)
          });
        } else {
          // Create new loan
          try {
            loan = await Loan.create(loanData);
            action = 'created';
          } catch (createError) {
            console.error('❌ Loan creation failed:', createError.message);
            console.error('Failed loan data:', Object.keys(loanData));
            // Try creating with only safe fields (exclude new columns that might not exist)
            const safeFields = {};
            ['borrower_name', 'co_borrower_name', 'property_address', 'property_city', 
             'property_state', 'property_zip', 'loan_amount', 'current_upb', 'interest_rate',
             'loan_date', 'maturity_date', 'loan_number', 'investor_name'].forEach(field => {
              if (loanData[field] !== undefined) {
                safeFields[field] = loanData[field];
              }
            });
            loan = await Loan.create(safeFields);
            console.log('⚠️ Loan created with basic fields only (missing new columns)');
            action = 'created';
          }
        }

        savedLoans.push({
          ...loan.toJSON(),
          _action: action
        });
        
      } catch (error) {
        saveErrors.push({
          data: loanData,
          error: error.message
        });
      }
    }

    // Helper functions for duplicate detection
    async function findExistingLoan(loanData) {
      // 1. First try exact loan number match
      if (loanData.loan_number) {
        const byLoanNumber = await Loan.findOne({ 
          where: { loan_number: loanData.loan_number } 
        });
        if (byLoanNumber) return byLoanNumber;
      }

      // 2. Try borrower name + property address combination
      if (loanData.borrower_name && loanData.property_address) {
        const byNameAndAddress = await Loan.findOne({
          where: {
            borrower_name: loanData.borrower_name,
            property_address: loanData.property_address
          }
        });
        if (byNameAndAddress) return byNameAndAddress;
      }

      // 3. Try fuzzy matching for similar records
      if (loanData.borrower_name || loanData.property_address) {
        const allLoans = await Loan.findAll({
          attributes: ['id', 'loan_number', 'borrower_name', 'property_address', 'loan_amount']
        });

        for (const existingLoan of allLoans) {
          const similarity = calculateLoanSimilarity(existingLoan, loanData);
          if (similarity > 0.85) { // High confidence threshold
            return await Loan.findByPk(existingLoan.id);
          }
        }
      }

      return null;
    }

    function calculateLoanSimilarity(existing, newLoan) {
      let score = 0;
      let factors = 0;

      // Borrower name similarity (40% weight)
      if (existing.borrower_name && newLoan.borrower_name) {
        const nameScore = stringSimilarity(
          existing.borrower_name.toLowerCase().trim(),
          newLoan.borrower_name.toLowerCase().trim()
        );
        score += nameScore * 0.4;
        factors += 0.4;
      }

      // Property address similarity (40% weight)
      if (existing.property_address && newLoan.property_address) {
        const addressScore = stringSimilarity(
          existing.property_address.toLowerCase().trim(),
          newLoan.property_address.toLowerCase().trim()
        );
        score += addressScore * 0.4;
        factors += 0.4;
      }

      // Loan amount similarity (20% weight)
      if (existing.loan_amount && newLoan.loan_amount) {
        const amountDiff = Math.abs(existing.loan_amount - newLoan.loan_amount);
        const avgAmount = (existing.loan_amount + newLoan.loan_amount) / 2;
        const amountScore = Math.max(0, 1 - (amountDiff / avgAmount));
        score += amountScore * 0.2;
        factors += 0.2;
      }

      return factors > 0 ? score / factors : 0;
    }

    function stringSimilarity(str1, str2) {
      if (!str1 || !str2) return 0;
      
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;
      
      if (longer.length === 0) return 1.0;
      
      const editDistance = levenshteinDistance(longer, shorter);
      return (longer.length - editDistance) / longer.length;
    }

    function levenshteinDistance(str1, str2) {
      const matrix = [];
      
      for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
      }
      
      for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
      }
      
      for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      
      return matrix[str2.length][str1.length];
    }

    function mergeAndUpdateLoanData(existingLoan, newLoanData) {
      const updates = {};
      
      // Update fields if new data is more complete or different
      Object.keys(newLoanData).forEach(key => {
        const newValue = newLoanData[key];
        const existingValue = existingLoan[key];
        
        // Skip null/undefined values and metadata fields
        if (newValue === null || newValue === undefined || key.startsWith('_')) {
          return;
        }
        
        // Always update if existing is null/empty
        if (!existingValue || existingValue === '') {
          updates[key] = newValue;
          return;
        }
        
        // For strings, update if new value is longer/more complete
        if (typeof newValue === 'string' && typeof existingValue === 'string') {
          if (newValue.length > existingValue.length) {
            updates[key] = newValue;
          }
        }
        
        // For numbers, update if new value is more specific (like interest rate)
        if (typeof newValue === 'number' && typeof existingValue === 'number') {
          // Update if new value has more precision or is significantly different
          if (Math.abs(newValue - existingValue) > 0.001) {
            updates[key] = newValue;
          }
        }
        
        // For dates, update if new date is provided and existing is null
        if (key.includes('date') && !existingValue) {
          updates[key] = newValue;
        }
      });
      
      // Always update the timestamp
      updates.updated_at = new Date();
      
      return updates;
    }

    function getMatchType(existingLoan, newLoanData) {
      if (existingLoan.loan_number && newLoanData.loan_number && 
          existingLoan.loan_number === newLoanData.loan_number) {
        return 'exact_loan_number';
      }
      
      if (existingLoan.borrower_name === newLoanData.borrower_name && 
          existingLoan.property_address === newLoanData.property_address) {
        return 'borrower_and_address';
      }
      
      return 'fuzzy_match';
    }

    // Update extraction log
    await extractionLog.update({
      status: 'completed',
      total_records_found: processingResult.data.length,
      successful_extractions: validatedData.length,
      failed_extractions: validationErrors.length,
      missing_fields: processingResult.missingFields || [],
      errors: [...validationErrors, ...saveErrors],
      processing_time_ms: Date.now() - startTime
    });

    const createdLoans = savedLoans.filter(loan => loan._action === 'created');
    const updatedLoans = savedLoans.filter(loan => loan._action === 'updated');

    return {
      fileName: file.originalname,
      fileType: fileExt,
      totalRecords: processingResult.data.length,
      successfulExtractions: validatedData.length,
      failedExtractions: validationErrors.length,
      loansCreated: createdLoans.length,
      loansUpdated: updatedLoans.length,
      saveErrors: saveErrors.length,
      data: savedLoans, // Return saved loan data with IDs
      validationErrors,
      saveErrors,
      duplicateActions,
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