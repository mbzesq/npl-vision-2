const pdfParse = require('pdf-parse');
const OpenAI = require('openai');

class PDFProcessor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

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

      // Detect document type
      const documentType = this.detectDocumentType(text);
      
      // Process based on document type
      if (documentType && this.documentPrompts[documentType]) {
        const extractedData = await this.extractWithOpenAI(text, documentType);
        
        if (extractedData) {
          // Convert to loan format if it's a mortgage
          if (documentType === 'mortgage') {
            const loanData = this.convertToLoanFormat(extractedData);
            results.data.push(loanData);
          }
          
          // Always store the raw document data
          results.documents.push({
            type: documentType,
            data: extractedData,
            confidence: extractedData.confidence || 0.9
          });
        }
      } else {
        // Try generic extraction
        const genericData = await this.extractGenericLoanInfo(text);
        if (genericData) {
          results.data.push(genericData);
        }
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
      return null;
    }
  }

  async extractGenericLoanInfo(text) {
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
      return null;
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
}

module.exports = PDFProcessor;