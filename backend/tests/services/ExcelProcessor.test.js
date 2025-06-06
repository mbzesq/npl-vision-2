const ExcelProcessor = require('../../src/services/ExcelProcessor');
const fs = require('fs');
const path = require('path');

describe('ExcelProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new ExcelProcessor();
  });

  describe('detectColumnMappings', () => {
    test('should map common loan headers correctly', () => {
      const headers = [
        'Loan Number',
        'Borrower Name', 
        'Property Address',
        'Current Balance',
        'Interest Rate'
      ];

      const result = processor.detectColumnMappings(headers);
      
      expect(result.mappings.loan_number).toBe('Loan Number');
      expect(result.mappings.borrower_name).toBe('Borrower Name');
      expect(result.mappings.property_address).toBe('Property Address');
      expect(result.mappings.current_upb).toBe('Current Balance');
      expect(result.mappings.interest_rate).toBe('Interest Rate');
    });

    test('should handle fuzzy matching for similar headers', () => {
      const headers = [
        'Loan #',
        'Primary Borrower',
        'Prop Address', 
        'UPB',
        'Rate'
      ];

      const result = processor.detectColumnMappings(headers);
      
      expect(result.mappings.loan_number).toBe('Loan #');
      expect(result.mappings.borrower_name).toBe('Primary Borrower');
      expect(result.mappings.property_address).toBe('Prop Address');
    });
  });

  describe('parseCurrency', () => {
    test('should parse currency values correctly', () => {
      expect(processor.parseCurrency('$100,000.00')).toBe(100000);
      expect(processor.parseCurrency('250000')).toBe(250000);
      expect(processor.parseCurrency('$1,500.50')).toBe(1500.50);
      expect(processor.parseCurrency('')).toBeNull();
      expect(processor.parseCurrency(null)).toBeNull();
    });
  });

  describe('parseInterestRate', () => {
    test('should parse interest rates correctly', () => {
      expect(processor.parseInterestRate('5.5%')).toBe(0.055);
      expect(processor.parseInterestRate('0.065')).toBe(0.065);
      expect(processor.parseInterestRate('12')).toBe(0.12);
      expect(processor.parseInterestRate('')).toBeNull();
    });
  });

  describe('parseDate', () => {
    test('should parse various date formats', () => {
      expect(processor.parseDate('2023-01-15')).toBe('2023-01-15');
      expect(processor.parseDate('01/15/2023')).toBe('2023-01-15');
      expect(processor.parseDate(new Date('2023-01-15'))).toBe('2023-01-15');
      expect(processor.parseDate('')).toBeNull();
    });
  });

  describe('validateLoanData', () => {
    test('should validate required fields', () => {
      const validLoan = {
        borrower_name: 'John Doe',
        property_address: '123 Main St'
      };

      const result = processor.validateLoanData(validLoan);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject loans missing required fields', () => {
      const invalidLoan = {
        borrower_name: '',
        property_address: ''
      };

      const result = processor.validateLoanData(invalidLoan);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate business rules', () => {
      const invalidLoan = {
        borrower_name: 'John Doe',
        property_address: '123 Main St',
        interest_rate: 0.75, // 75% - too high
        current_upb: -1000   // negative balance
      };

      const result = processor.validateLoanData(invalidLoan);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Interest rate'))).toBe(true);
      expect(result.errors.some(e => e.includes('UPB'))).toBe(true);
    });
  });
});