class DataValidator {
  validateLoanData(loanData) {
    const errors = [];
    const warnings = [];
    
    // Required fields
    if (!loanData.borrower_name || loanData.borrower_name.trim() === '') {
      errors.push({
        field: 'borrower_name',
        message: 'Borrower name is required'
      });
    }
    
    if (!loanData.property_address || loanData.property_address.trim() === '') {
      errors.push({
        field: 'property_address',
        message: 'Property address is required'
      });
    }
    
    // Data type and format validation
    if (loanData.interest_rate !== null && loanData.interest_rate !== undefined) {
      const rate = parseFloat(loanData.interest_rate);
      if (isNaN(rate)) {
        errors.push({
          field: 'interest_rate',
          message: 'Interest rate must be a number'
        });
      } else if (rate < 0 || rate > 0.5) {
        errors.push({
          field: 'interest_rate',
          message: 'Interest rate must be between 0% and 50%'
        });
      }
    }
    
    if (loanData.loan_amount !== null && loanData.loan_amount !== undefined) {
      const amount = parseFloat(loanData.loan_amount);
      if (isNaN(amount) || amount <= 0) {
        errors.push({
          field: 'loan_amount',
          message: 'Loan amount must be a positive number'
        });
      }
    }
    
    if (loanData.current_upb !== null && loanData.current_upb !== undefined) {
      const upb = parseFloat(loanData.current_upb);
      if (isNaN(upb) || upb < 0) {
        errors.push({
          field: 'current_upb',
          message: 'Current UPB cannot be negative'
        });
      }
    }
    
    // Date validation
    const dateFields = ['loan_date', 'maturity_date', 'last_paid_date', 'next_due_date'];
    dateFields.forEach(field => {
      if (loanData[field]) {
        if (!this.isValidDate(loanData[field])) {
          errors.push({
            field,
            message: `${field} must be a valid date`
          });
        }
      }
    });
    
    // Logical validation
    if (loanData.loan_date && loanData.maturity_date) {
      const loanDate = new Date(loanData.loan_date);
      const maturityDate = new Date(loanData.maturity_date);
      if (loanDate >= maturityDate) {
        warnings.push({
          field: 'maturity_date',
          message: 'Maturity date should be after loan date'
        });
      }
    }
    
    if (loanData.current_upb && loanData.loan_amount) {
      const currentUpb = parseFloat(loanData.current_upb);
      const loanAmount = parseFloat(loanData.loan_amount);
      if (currentUpb > loanAmount) {
        warnings.push({
          field: 'current_upb',
          message: 'Current UPB is greater than original loan amount'
        });
      }
    }
    
    // State validation
    if (loanData.property_state) {
      if (!this.isValidState(loanData.property_state)) {
        warnings.push({
          field: 'property_state',
          message: 'Property state should be a valid 2-letter state code'
        });
      }
    }
    
    // ZIP code validation
    if (loanData.property_zip) {
      if (!this.isValidZip(loanData.property_zip)) {
        warnings.push({
          field: 'property_zip',
          message: 'ZIP code should be in format XXXXX or XXXXX-XXXX'
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      missingOptionalFields: this.getMissingOptionalFields(loanData)
    };
  }
  
  detectDuplicates(newLoans, existingLoans) {
    const duplicates = [];
    
    newLoans.forEach((newLoan, index) => {
      const potentialDuplicates = [];
      
      existingLoans.forEach(existingLoan => {
        let confidenceScore = 0;
        let matchReasons = [];
        
        // Check loan number (highest confidence)
        if (newLoan.loan_number && existingLoan.loan_number && 
            newLoan.loan_number === existingLoan.loan_number) {
          confidenceScore = 0.95;
          matchReasons.push('loan_number');
        } 
        // Check borrower name + property address combination
        else if (newLoan.borrower_name && existingLoan.borrower_name &&
                 newLoan.property_address && existingLoan.property_address) {
          
          const nameMatch = this.fuzzyMatch(newLoan.borrower_name, existingLoan.borrower_name);
          const addressMatch = this.fuzzyMatch(newLoan.property_address, existingLoan.property_address);
          
          if (nameMatch > 0.8 && addressMatch > 0.8) {
            confidenceScore = (nameMatch + addressMatch) / 2;
            matchReasons.push('borrower_name', 'property_address');
          }
        }
        
        if (confidenceScore > 0.7) {
          potentialDuplicates.push({
            existingLoanId: existingLoan.id,
            confidenceScore,
            matchReasons,
            existingLoan: {
              loan_number: existingLoan.loan_number,
              borrower_name: existingLoan.borrower_name,
              property_address: existingLoan.property_address
            }
          });
        }
      });
      
      if (potentialDuplicates.length > 0) {
        duplicates.push({
          newLoanIndex: index,
          newLoan: {
            loan_number: newLoan.loan_number,
            borrower_name: newLoan.borrower_name,
            property_address: newLoan.property_address
          },
          potentialDuplicates: potentialDuplicates.sort((a, b) => b.confidenceScore - a.confidenceScore)
        });
      }
    });
    
    return duplicates;
  }
  
  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
  
  isValidState(state) {
    const states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 
                   'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 
                   'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 
                   'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 
                   'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'];
    return states.includes(state.toUpperCase());
  }
  
  isValidZip(zip) {
    return /^\d{5}(-\d{4})?$/.test(zip);
  }
  
  getMissingOptionalFields(loanData) {
    const optionalFields = [
      'loan_number', 'co_borrower_name', 'property_city', 'property_state', 
      'property_zip', 'loan_amount', 'interest_rate', 'maturity_date', 
      'loan_date', 'current_upb', 'accrued_interest', 'total_balance',
      'last_paid_date', 'next_due_date', 'remaining_term', 'legal_status',
      'lien_position', 'investor_name'
    ];
    
    return optionalFields.filter(field => !loanData[field]);
  }
  
  fuzzyMatch(str1, str2) {
    // Simple fuzzy matching - in production, use a library like fuzzywuzzy
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    // Calculate similarity based on common characters
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  getEditDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }
}

module.exports = DataValidator;