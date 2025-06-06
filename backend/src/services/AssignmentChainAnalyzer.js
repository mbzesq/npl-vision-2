const OpenAI = require('openai');

class AssignmentChainAnalyzer {
  constructor() {
    // Initialize OpenAI if available
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } else {
      console.log('⚠️ OpenAI API key not configured - assignment analysis will use fallback methods');
      this.openai = null;
    }
  }

  async analyzeAssignmentChain(documentChunks, documentTypes) {
    console.log('🔗 Starting assignment chain analysis...');
    
    try {
      // Add timeout protection for the entire analysis
      const analysisPromise = this.performAnalysis(documentChunks, documentTypes);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Assignment chain analysis timed out')), 25000); // 25 second timeout
      });
      
      return await Promise.race([analysisPromise, timeoutPromise]);
      
    } catch (error) {
      console.error('❌ Assignment chain analysis failed:', error.message);
      // Return basic fallback result
      return {
        originalLender: null,
        assignments: [],
        chainComplete: null,
        chainIssues: [`Analysis failed: ${error.message}`],
        currentOwner: null
      };
    }
  }

  async performAnalysis(documentChunks, documentTypes) {
    console.log('📋 Step 1: Extracting basic assignment data...');
    
    // Step 1: Extract basic data (simple AI task)
    const originalLender = await this.extractOriginalLender(documentChunks, documentTypes);
    const assignments = await this.extractAssignments(documentChunks, documentTypes);
    
    console.log('📋 Step 2: Processing chain logic with our code...');
    
    // Step 2: Our code does the logic (no AI, fast)
    const orderedAssignments = this.orderAssignmentsChronologically(assignments);
    const chainValidation = this.validateAssignmentChain(originalLender, orderedAssignments);
    
    return {
      originalLender,
      assignments: orderedAssignments,
      chainComplete: chainValidation.isComplete,
      chainIssues: chainValidation.issues,
      currentOwner: chainValidation.currentOwner
    };
  }

  async extractOriginalLender(chunks, documentTypes) {
    console.log('🏦 Extracting original lender from mortgage documents...');
    
    // Limit to first 2 chunks to avoid long processing  
    const chunksToProcess = chunks.slice(0, 2);
    
    for (const chunk of chunksToProcess) {
      if (this.containsMortgageData(chunk.text)) {
        try {
          const lender = await this.extractLenderFromMortgage(chunk.text);
          if (lender) {
            console.log(`✅ Original lender found: ${lender}`);
            return lender;
          }
        } catch (error) {
          console.error('⚠️ Error extracting lender from chunk:', error.message);
          // Continue to next chunk
        }
      }
    }
    
    console.log('⚠️ Original lender not found in mortgage documents');
    return null;
  }

  containsMortgageData(text) {
    const lowerText = text.toLowerCase();
    return (lowerText.includes('mortgage') && lowerText.includes('deed')) ||
           lowerText.includes('deed of trust') ||
           lowerText.includes('security deed') ||
           (lowerText.includes('mortgage') && lowerText.includes('security'));
  }

  async extractLenderFromMortgage(text) {
    if (!this.openai) {
      console.log('🔄 Using fallback lender extraction (no OpenAI)');
      return this.extractLenderFallback(text);
    }

    const prompt = `Extract the original lender name from this mortgage document.

Look for:
- "Lender:" followed by a name
- "Mortgagee:" followed by a name  
- "Beneficiary:" followed by a name

Return ONLY the name, nothing else. If not found, return "NOT_FOUND".

Document text:
${text.substring(0, 8000)}`;

    try {
      // Add timeout to OpenAI call
      const openaiPromise = this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a legal document analyst specializing in mortgage documents. Extract only the exact original lender name."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout')), 10000); // 10 second timeout
      });

      const response = await Promise.race([openaiPromise, timeoutPromise]);
      const result = response.choices[0].message.content.trim();
      return result === "NOT_FOUND" ? null : result;
      
    } catch (error) {
      console.error('Error extracting original lender:', error);
      return this.extractLenderFallback(text);
    }
  }

  extractLenderFallback(text) {
    // Simple pattern matching for common mortgage language
    const patterns = [
      /lender[:\s]+([^,\n]+)/i,
      /mortgagee[:\s]+([^,\n]+)/i,
      /beneficiary[:\s]+([^,\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  async extractAssignments(chunks, documentTypes) {
    console.log('📄 Extracting assignment documents...');
    const assignments = [];

    // Limit to first 2 chunks to avoid excessive processing
    const chunksToProcess = chunks.slice(0, 2);

    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i];
      if (this.containsAssignmentData(chunk.text)) {
        console.log(`🔍 Found assignment data in chunk ${i + 1}`);
        try {
          const assignment = await this.extractAssignmentDetails(chunk.text);
          if (assignment && (assignment.assignor || assignment.assignee)) {
            assignments.push({
              ...assignment,
              chunkIndex: i + 1
            });
          }
        } catch (error) {
          console.error(`⚠️ Error extracting assignment from chunk ${i + 1}:`, error.message);
          // Continue to next chunk
        }
      }
    }

    console.log(`📋 Found ${assignments.length} assignments`);
    return assignments;
  }

  containsAssignmentData(text) {
    const lowerText = text.toLowerCase();
    return lowerText.includes('assignment') && lowerText.includes('mortgage');
  }

  async extractAssignmentDetails(text) {
    if (!this.openai) {
      console.log('🔄 Using fallback assignment extraction (no OpenAI)');
      return this.extractAssignmentFallback(text);
    }

    const prompt = `Extract assignment information from this document.

Find:
- Assignor (who is transferring)
- Assignee (who is receiving)  
- Assignment date
- Recording date

Return JSON:
{
  "assignor": "name",
  "assignee": "name", 
  "assignmentDate": "YYYY-MM-DD or null",
  "recordingDate": "YYYY-MM-DD or null"
}

Document text:
${text.substring(0, 6000)}`;

    try {
      // Add timeout to OpenAI call
      const openaiPromise = this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a legal document analyst specializing in assignment of mortgage documents. Return only valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout')), 10000); // 10 second timeout
      });

      const response = await Promise.race([openaiPromise, timeoutPromise]);
      const result = response.choices[0].message.content.trim();
      
      try {
        const assignment = JSON.parse(result);
        return assignment;
      } catch (parseError) {
        // Try to extract JSON from response
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid JSON response');
      }
      
    } catch (error) {
      console.error('Error extracting assignment details:', error);
      return this.extractAssignmentFallback(text);
    }
  }

  extractAssignmentFallback(text) {
    // Basic pattern matching for assignment documents
    const assignorMatch = text.match(/assignor[:\s]*([^,\n]+)/i);
    const assigneeMatch = text.match(/assignee[:\s]*([^,\n]+)/i);
    
    return {
      assignor: assignorMatch ? assignorMatch[1].trim() : null,
      assignee: assigneeMatch ? assigneeMatch[1].trim() : null,
      assignmentDate: null,
      recordingDate: null,
      mortgageDate: null
    };
  }

  orderAssignmentsChronologically(assignments) {
    console.log('📅 Ordering assignments chronologically...');
    
    return assignments.sort((a, b) => {
      // Primary sort by assignment date
      const dateA = a.assignmentDate ? new Date(a.assignmentDate) : new Date('1900-01-01');
      const dateB = b.assignmentDate ? new Date(b.assignmentDate) : new Date('1900-01-01');
      
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      
      // Secondary sort by recording date if assignment dates are equal
      const recordA = a.recordingDate ? new Date(a.recordingDate) : dateA;
      const recordB = b.recordingDate ? new Date(b.recordingDate) : dateB;
      
      return recordA.getTime() - recordB.getTime();
    });
  }

  validateAssignmentChain(originalLender, orderedAssignments) {
    console.log('🔗 Validating assignment chain...');
    
    const issues = [];
    let currentOwner = originalLender;
    let isComplete = true;

    if (!originalLender) {
      issues.push('Original lender not identified in mortgage documents');
      isComplete = false;
    }

    if (orderedAssignments.length === 0) {
      // No assignments found - current owner is original lender
      return {
        isComplete: originalLender ? true : false,
        currentOwner: originalLender,
        issues: issues.length > 0 ? issues : null
      };
    }

    // Check if first assignment starts with original lender
    const firstAssignment = orderedAssignments[0];
    if (originalLender && firstAssignment.assignor) {
      if (!this.namesMatch(originalLender, firstAssignment.assignor)) {
        issues.push(`Chain break: Original lender "${originalLender}" does not match first assignor "${firstAssignment.assignor}"`);
        isComplete = false;
      }
    }

    // Check chain continuity (A→B, B→C pattern)
    for (let i = 0; i < orderedAssignments.length; i++) {
      const assignment = orderedAssignments[i];
      
      // Update current owner to assignee
      if (assignment.assignee) {
        currentOwner = assignment.assignee;
      }

      // Check if this assignment connects to the next one
      if (i < orderedAssignments.length - 1) {
        const nextAssignment = orderedAssignments[i + 1];
        
        if (assignment.assignee && nextAssignment.assignor) {
          if (!this.namesMatch(assignment.assignee, nextAssignment.assignor)) {
            issues.push(`Chain break: Assignee "${assignment.assignee}" does not match next assignor "${nextAssignment.assignor}"`);
            isComplete = false;
          }
        }
      }

      // Check for missing data
      if (!assignment.assignor) {
        issues.push(`Assignment ${i + 1}: Missing assignor`);
        isComplete = false;
      }
      
      if (!assignment.assignee) {
        issues.push(`Assignment ${i + 1}: Missing assignee`);
        isComplete = false;
      }
    }

    console.log(`🎯 Chain validation complete. Complete: ${isComplete}, Issues: ${issues.length}`);

    return {
      isComplete,
      currentOwner,
      issues: issues.length > 0 ? issues : null
    };
  }

  namesMatch(name1, name2) {
    if (!name1 || !name2) return false;
    
    // Normalize names for comparison
    const normalize = (name) => name.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,]/g, '')
      .trim();
    
    const norm1 = normalize(name1);
    const norm2 = normalize(name2);
    
    // Exact match
    if (norm1 === norm2) return true;
    
    // Check if one name contains the other (for cases like "Bank of America" vs "Bank of America, N.A.")
    return norm1.includes(norm2) || norm2.includes(norm1);
  }
}

module.exports = AssignmentChainAnalyzer;