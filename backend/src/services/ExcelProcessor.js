const XLSX = require('xlsx');
const { calculateSimilarity } = require('../utils/stringUtils');

class ExcelProcessor {
  constructor() {
    this.columnMappings = {
      loan_number: ['loan number', 'loan #', 'loan id', 'account number', 'loan no', 'account', 'loan_id'],
      borrower_name: ['borrower', 'borrower name', 'primary borrower', 'mortgagor', 'borrower_name', 'name'],
      co_borrower_name: ['co-borrower', 'co borrower', 'secondary borrower', 'coborrower', 'co_borrower'],
      property_address: ['property address', 'property', 'address', 'property addr', 'prop address', 'street address'],
      property_city: ['city', 'property city', 'prop city'],
      property_state: ['state', 'property state', 'prop state', 'st'],
      property_zip: ['zip', 'zip code', 'postal code', 'zipcode', 'property zip'],
      loan_amount: ['loan amount', 'original balance', 'original amount', 'principal', 'orig bal', 'original loan amount'],
      interest_rate: ['interest rate', 'rate', 'int rate', 'ir', 'coupon', 'note rate'],
      maturity_date: ['maturity date', 'maturity', 'mat date', 'balloon date'],
      loan_date: ['loan date', 'origination date', 'orig date', 'date of loan', 'closing date'],
      current_upb: ['current balance', 'unpaid balance', 'upb', 'principal balance', 'current upb', 'outstanding balance'],
      accrued_interest: ['accrued interest', 'accrued int', 'interest accrued', 'unpaid interest'],
      total_balance: ['total balance', 'total debt', 'total amount due', 'total payoff'],
      last_paid_date: ['last paid date', 'last payment date', 'last paid', 'paid to date'],
      next_due_date: ['next due date', 'next payment date', 'due date', 'next due'],
      remaining_term: ['remaining term', 'remaining months', 'months remaining'],
      legal_status: ['legal status', 'legal', 'foreclosure status', 'fc status'],
      lien_position: ['lien position', 'lien', 'position', 'lien type'],
      investor_name: ['investor', 'investor name', 'owner', 'note holder']
    };
  }

  async processFile(fileBuffer) {
    const startTime = Date.now();
    const results = {
      data: [],
      mappingConfidence: {},
      errors: [],
      missingFields: []
    };

    try {
      // Read the Excel file
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
      
      if (jsonData.length === 0) {
        throw new Error('No data found in Excel file');
      }

      // Get headers from the first row
      const headers = Object.keys(jsonData[0]);
      
      // Detect column mappings
      const columnMap = this.detectColumnMappings(headers);
      results.mappingConfidence = columnMap.confidence;
      
      // Process each row
      for (let i = 0; i < jsonData.length; i++) {
        try {
          const row = jsonData[i];
          const loanData = this.extractLoanData(row, columnMap.mappings);
          
          // Validate the extracted data
          const validation = this.validateLoanData(loanData);
          if (validation.isValid) {
            results.data.push(loanData);
          } else {
            results.errors.push({
              row: i + 2, // Excel rows start at 1, plus header
              errors: validation.errors
            });
          }
        } catch (rowError) {
          results.errors.push({
            row: i + 2,
            errors: [rowError.message]
          });
        }
      }

      // Track missing fields
      const requiredFields = ['borrower_name', 'property_address'];
      requiredFields.forEach(field => {
        if (!columnMap.mappings[field]) {
          results.missingFields.push(field);
        }
      });

      results.processingTime = Date.now() - startTime;
      return results;

    } catch (error) {
      throw new Error(`Excel processing failed: ${error.message}`);
    }
  }

  detectColumnMappings(headers) {
    const mappings = {};
    const confidence = {};
    
    // Normalize headers for comparison
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    
    // For each target field, find the best matching header
    Object.entries(this.columnMappings).forEach(([targetField, variations]) => {
      let bestMatch = null;
      let bestScore = 0;
      
      normalizedHeaders.forEach((header, index) => {
        variations.forEach(variation => {
          const score = calculateSimilarity(header, variation);
          if (score > bestScore && score > 0.7) { // 70% similarity threshold
            bestScore = score;
            bestMatch = headers[index]; // Use original header
          }
        });
      });
      
      if (bestMatch) {
        mappings[targetField] = bestMatch;
        confidence[targetField] = Math.round(bestScore * 100);
      }
    });
    
    return { mappings, confidence };
  }

  extractLoanData(row, mappings) {
    const loanData = {};
    
    // Extract mapped fields
    Object.entries(mappings).forEach(([targetField, sourceColumn]) => {
      const value = row[sourceColumn];
      
      // Handle different data types
      if (targetField.includes('date') && value) {
        // Parse dates
        loanData[targetField] = this.parseDate(value);
      } else if (['loan_amount', 'current_upb', 'accrued_interest', 'total_balance'].includes(targetField)) {
        // Parse currency values
        loanData[targetField] = this.parseCurrency(value);
      } else if (targetField === 'interest_rate') {
        // Parse interest rate
        loanData[targetField] = this.parseInterestRate(value);
      } else if (targetField === 'remaining_term') {
        // Parse integer
        loanData[targetField] = parseInt(value) || null;
      } else {
        // String values
        loanData[targetField] = value ? String(value).trim() : null;
      }
    });
    
    return loanData;
  }

  validateLoanData(loanData) {
    const errors = [];
    
    // Required fields
    if (!loanData.borrower_name) {
      errors.push('Borrower name is required');
    }
    if (!loanData.property_address) {
      errors.push('Property address is required');
    }
    
    // Business rules
    if (loanData.interest_rate && (loanData.interest_rate < 0 || loanData.interest_rate > 0.5)) {
      errors.push('Interest rate must be between 0% and 50%');
    }
    if (loanData.current_upb && loanData.current_upb < 0) {
      errors.push('Current UPB cannot be negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  parseDate(value) {
    if (!value) return null;
    
    // If it's already a Date object
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    
    // Try to parse string date
    const date = new Date(value);
    if (!isNaN(date)) {
      return date.toISOString().split('T')[0];
    }
    
    return null;
  }

  parseCurrency(value) {
    if (!value) return null;
    
    // Remove currency symbols and commas
    const cleaned = String(value).replace(/[$,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? null : parsed;
  }

  parseInterestRate(value) {
    if (!value) return null;
    
    // Remove % symbol
    const cleaned = String(value).replace(/%/g, '').trim();
    let parsed = parseFloat(cleaned);
    
    if (isNaN(parsed)) return null;
    
    // Convert to decimal if it appears to be a percentage
    if (parsed > 1) {
      parsed = parsed / 100;
    }
    
    return parsed;
  }
}

module.exports = ExcelProcessor;