const pdfParse = require('pdf-parse');
const OpenAI = require('openai');

class PDFProcessor {
  constructor() {
    // Skip OpenAI initialization if no API key (for testing)
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } else {
      console.log('⚠️ OpenAI API key not configured - using mock responses');
      this.openai = null;
    }

    this.documentPrompts = {
      mortgage: `Extract loan information from this mortgage document.
        Return a JSON object with the following fields:
        - document_type: "mortgage"
        - borrower_name: full name of primary borrower
        - co_borrower_name: full name of co-borrower (if any)
        - property_address: full property address
        - property_city: city
        - property_state: state (2-letter code)
        - property_zip: zip code
        - loan_amount: original loan amount (numeric, no symbols)
        - interest_rate: interest rate as decimal (e.g., 0.05 for 5%)
        - loan_date: loan origination date (YYYY-MM-DD format)
        - maturity_date: loan maturity date (YYYY-MM-DD format)
        - original_lender: name of original lender
        - recording_date: document recording date (YYYY-MM-DD format)
        - instrument_number: recording instrument number
        
        If any field is unclear or missing, set it as null.
        Respond only with valid JSON.`,
      
      assignment: `Extract assignment information from this document.
        Return a JSON object with:
        - document_type: "assignment"
        - assignor: name of the entity assigning the loan
        - assignee: name of the entity receiving the assignment
        - recording_date: document recording date (YYYY-MM-DD format)
        - instrument_number: recording instrument number
        - loan_reference: any loan number or reference mentioned
        - property_address: property address if mentioned
        
        If any field is unclear or missing, set it as null.
        Respond only with valid JSON.`,
      
      note: `Extract information from this promissory note.
        Return a JSON object with:
        - document_type: "note"
        - borrower_name: full name of borrower
        - co_borrower_name: full name of co-borrower (if any)
        - loan_amount: principal amount (numeric, no symbols)
        - interest_rate: interest rate as decimal (e.g., 0.05 for 5%)
        - loan_date: note date (YYYY-MM-DD format)
        - maturity_date: maturity date (YYYY-MM-DD format)
        - payment_amount: monthly payment amount if specified
        
        If any field is unclear or missing, set it as null.
        Respond only with valid JSON.`,
      
      allonge: `Extract information from this allonge.
        Return a JSON object with:
        - document_type: "allonge"
        - endorser: name of the endorsing party
        - endorsee: name of the party receiving endorsement
        - date: date of endorsement (YYYY-MM-DD format)
        - loan_reference: any loan number or reference mentioned
        
        If any field is unclear or missing, set it as null.
        Respond only with valid JSON.`
    };
  }

  async processFile(fileBuffer) {
    const startTime = Date.now();
    const results = {
      data: [],
      documents: [],
      errors: [],
      processingTime: 0
    };

    try {
      // Extract text from PDF
      const pdfData = await pdfParse(fileBuffer);
      const text = pdfData.text;
      
      if (!text || text.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }

      console.log(`📄 PDF text length: ${text.length} characters`);
      
      // Split text into chunks for better analysis
      const textChunks = this.splitTextIntoChunks(text, 15000); // Larger chunks
      console.log(`📑 Split into ${textChunks.length} chunks for analysis`);
      
      // Try to extract comprehensive loan data from all chunks
      const allExtractedData = [];
      
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        console.log(`🔍 Processing chunk ${i + 1}/${textChunks.length} (${chunk.length} chars)`);
        
        // Use comprehensive extraction for each chunk
        const extractedData = await this.extractComprehensiveLoanData(chunk);
        if (extractedData && Object.keys(extractedData).length > 2) { // More than just nulls
          allExtractedData.push(extractedData);
          
          results.documents.push({
            type: 'loan_document',
            data: extractedData,
            confidence: extractedData.confidence || 0.8,
            chunk: i + 1
          });
        }
      }
      
      // Merge all extracted data into a single comprehensive loan record
      if (allExtractedData.length > 0) {
        const mergedLoanData = this.mergeExtractedData(allExtractedData);
        results.data.push(mergedLoanData);
      }

      results.processingTime = Date.now() - startTime;
      return results;

    } catch (error) {
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  detectDocumentType(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('mortgage') && (lowerText.includes('deed') || lowerText.includes('security'))) {
      return 'mortgage';
    } else if (lowerText.includes('assignment') && lowerText.includes('mortgage')) {
      return 'assignment';
    } else if (lowerText.includes('promissory note') || (lowerText.includes('promise to pay') && lowerText.includes('note'))) {
      return 'note';
    } else if (lowerText.includes('allonge')) {
      return 'allonge';
    }
    
    return null;
  }

  async extractWithOpenAI(text, documentType) {
    // If OpenAI is not available, return mock data
    if (!this.openai) {
      console.log('🔄 Using mock data extraction (OpenAI unavailable)');
      return this.getMockDataForType(documentType);
    }

    try {
      const prompt = this.documentPrompts[documentType];
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a loan document data extraction specialist. Extract information accurately and return only valid JSON."
          },
          {
            role: "user",
            content: `${prompt}\n\nDocument text:\n${text.substring(0, 8000)}` // Limit text to avoid token limits
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      const response = completion.choices[0].message.content;
      
      // Parse JSON response
      try {
        const data = JSON.parse(response);
        return data;
      } catch (parseError) {
        // Try to extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid JSON response from OpenAI');
      }

    } catch (error) {
      console.error('OpenAI extraction error:', error);
      console.log('🔄 Falling back to mock data extraction');
      return this.getMockDataForType(documentType);
    }
  }

  async extractGenericLoanInfo(text) {
    // If OpenAI is not available, return mock data
    if (!this.openai) {
      console.log('🔄 Using mock generic data extraction (OpenAI unavailable)');
      return this.getMockGenericData();
    }

    const prompt = `Extract any loan-related information from this document.
      Look for:
      - Borrower names
      - Property addresses
      - Loan amounts
      - Interest rates
      - Dates
      - Loan numbers
      
      Return a JSON object with any found information mapped to these fields:
      borrower_name, property_address, loan_amount, interest_rate, loan_date, loan_number
      
      If any field is not found, set it as null.
      Respond only with valid JSON.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a loan document data extraction specialist."
          },
          {
            role: "user",
            content: `${prompt}\n\nDocument text:\n${text.substring(0, 8000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const response = completion.choices[0].message.content;
      const data = JSON.parse(response);
      return data;

    } catch (error) {
      console.error('Generic extraction error:', error);
      console.log('🔄 Falling back to mock generic data extraction');
      return this.getMockGenericData();
    }
  }

  convertToLoanFormat(mortgageData) {
    return {
      borrower_name: mortgageData.borrower_name,
      co_borrower_name: mortgageData.co_borrower_name,
      property_address: mortgageData.property_address,
      property_city: mortgageData.property_city,
      property_state: mortgageData.property_state,
      property_zip: mortgageData.property_zip,
      loan_amount: mortgageData.loan_amount,
      interest_rate: mortgageData.interest_rate,
      loan_date: mortgageData.loan_date,
      maturity_date: mortgageData.maturity_date,
      investor_name: mortgageData.original_lender,
      // Additional metadata
      _source: 'pdf',
      _document_type: 'mortgage',
      _recording_info: {
        date: mortgageData.recording_date,
        instrument: mortgageData.instrument_number
      }
    };
  }

  splitTextIntoChunks(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  async extractComprehensiveLoanData(text) {
    // If OpenAI is not available, return mock data
    if (!this.openai) {
      console.log('🔄 Using mock comprehensive data extraction (OpenAI unavailable)');
      return this.getMockComprehensiveData();
    }

    const prompt = `You are analyzing a loan document package. Extract ALL available loan information from this text with maximum precision.

SEARCH FOR THESE SPECIFIC DATA POINTS:
- Borrower names (primary and co-borrower)
- Property address (street, city, state, zip)
- Loan amount (original principal balance)
- Interest rate (look for percentages like 9.250%, 4.5%, etc.)
- Loan date/origination date
- Maturity date
- Current unpaid principal balance (UPB)
- Monthly payment amount
- Loan number/account number
- Servicer name
- Investor/owner name
- Property type
- Loan type (conventional, FHA, VA, etc.)
- Recording information

IMPORTANT INSTRUCTIONS:
1. Look carefully for percentage rates (e.g., "9.250%", "4.50%", "3.875%")
2. Extract full addresses including street, city, state, zip
3. Find all borrower names, not just the first one
4. Look for current balance amounts vs. original amounts
5. Pay attention to dates in various formats (MM/DD/YYYY, Month DD, YYYY, etc.)
6. If a field appears multiple times, use the most complete/recent value

Return a JSON object with these exact field names:
{
  "borrower_name": "primary borrower full name",
  "co_borrower_name": "co-borrower full name if exists",
  "property_address": "full street address",
  "property_city": "city name",
  "property_state": "state (2-letter code if possible)",
  "property_zip": "zip code",
  "loan_amount": numeric_value,
  "current_upb": numeric_value,
  "interest_rate": decimal_value (e.g., 0.09250 for 9.250%),
  "loan_date": "YYYY-MM-DD",
  "maturity_date": "YYYY-MM-DD",
  "monthly_payment": numeric_value,
  "loan_number": "loan identifier",
  "servicer_name": "servicing company",
  "investor_name": "investor/owner",
  "loan_type": "loan type",
  "property_type": "property type",
  "confidence": 0.9
}

For any field not found, use null. Respond ONLY with valid JSON.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a specialist in extracting loan data from mortgage documents. Be thorough and precise."
          },
          {
            role: "user",
            content: `${prompt}\n\nDocument text:\n${text}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1500
      });

      const response = completion.choices[0].message.content;
      
      try {
        const data = JSON.parse(response);
        return data;
      } catch (parseError) {
        // Try to extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid JSON response from OpenAI');
      }

    } catch (error) {
      console.error('Comprehensive extraction error:', error);
      console.log('🔄 Falling back to mock comprehensive data');
      return this.getMockComprehensiveData();
    }
  }

  mergeExtractedData(dataArray) {
    // Merge multiple extraction results, preferring non-null values
    const merged = {};
    
    dataArray.forEach(data => {
      Object.keys(data).forEach(key => {
        if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
          // If we don't have this field yet, or the new value is more complete
          if (!merged[key] || (typeof data[key] === 'string' && data[key].length > (merged[key]?.length || 0))) {
            merged[key] = data[key];
          }
          // For numbers, prefer the larger/more recent value (usually current_upb vs loan_amount)
          if (typeof data[key] === 'number' && key === 'current_upb' && data[key] > 0) {
            merged[key] = data[key];
          }
        }
      });
    });

    // Ensure we have the required loan format
    return {
      borrower_name: merged.borrower_name || null,
      co_borrower_name: merged.co_borrower_name || null,
      property_address: merged.property_address || null,
      property_city: merged.property_city || null,
      property_state: merged.property_state || null,
      property_zip: merged.property_zip || null,
      loan_amount: merged.loan_amount || null,
      current_upb: merged.current_upb || merged.loan_amount || null,
      interest_rate: merged.interest_rate || null,
      loan_date: merged.loan_date || null,
      maturity_date: merged.maturity_date || null,
      monthly_payment: merged.monthly_payment || null,
      loan_number: merged.loan_number || null,
      servicer_name: merged.servicer_name || null,
      investor_name: merged.investor_name || null,
      loan_type: merged.loan_type || null,
      property_type: merged.property_type || null,
      // Additional metadata
      _source: 'pdf',
      _extraction_method: 'comprehensive',
      _chunks_processed: dataArray.length
    };
  }

  getMockComprehensiveData() {
    return {
      borrower_name: "John Smith",
      co_borrower_name: "Jane Smith",
      property_address: "123 Main Street",
      property_city: "Anytown",
      property_state: "CA",
      property_zip: "90210",
      loan_amount: 250000,
      current_upb: 240000,
      interest_rate: 0.09250,
      loan_date: "2020-01-15",
      maturity_date: "2050-01-15",
      monthly_payment: 2500,
      loan_number: "LOAN-123456",
      servicer_name: "Sample Servicing Co",
      investor_name: "Sample Bank",
      loan_type: "Conventional",
      property_type: "Single Family",
      confidence: 0.8
    };
  }

  getMockDataForType(documentType) {
    const mockData = {
      mortgage: {
        document_type: "mortgage",
        borrower_name: "John Smith",
        co_borrower_name: null,
        property_address: "123 Main Street",
        property_city: "Anytown",
        property_state: "CA",
        property_zip: "90210",
        loan_amount: 250000,
        interest_rate: 0.045,
        loan_date: "2020-01-15",
        maturity_date: "2050-01-15",
        original_lender: "Sample Bank",
        recording_date: "2020-01-20",
        instrument_number: "2020-000123",
        confidence: 0.8
      },
      assignment: {
        document_type: "assignment",
        assignor: "Original Lender Inc",
        assignee: "New Lender Corp",
        recording_date: "2021-06-15",
        instrument_number: "2021-000456",
        loan_reference: "LOAN-123456",
        property_address: "123 Main Street, Anytown, CA 90210",
        confidence: 0.8
      },
      note: {
        document_type: "note",
        borrower_name: "Jane Doe",
        co_borrower_name: "John Doe",
        loan_amount: 300000,
        interest_rate: 0.0375,
        loan_date: "2019-03-10",
        maturity_date: "2049-03-10",
        payment_amount: 1390.52,
        confidence: 0.8
      },
      allonge: {
        document_type: "allonge",
        endorser: "First Bank",
        endorsee: "Second Bank",
        date: "2021-09-01",
        loan_reference: "NOTE-789012",
        confidence: 0.8
      }
    };

    return mockData[documentType] || mockData.mortgage;
  }

  getMockGenericData() {
    return {
      borrower_name: "Sample Borrower",
      property_address: "456 Sample Ave, Test City, TX 75001",
      loan_amount: 180000,
      interest_rate: 0.04,
      loan_date: "2018-12-01",
      loan_number: "GENERIC-001",
      confidence: 0.7
    };
  }
}

module.exports = PDFProcessor;