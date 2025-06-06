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
    
    // Process first 3 chunks to capture all assignments  
    const chunksToProcess = chunks.slice(0, 3);
    
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

    // Process first 4 chunks to capture all assignments
    const chunksToProcess = chunks.slice(0, 4);

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

    const prompt = `Extract detailed assignment information from this Assignment of Mortgage document.

Extract these fields:
1. assignor_name: The party transferring the mortgage
2. assignee_name: The party receiving the mortgage
3. execution_date: When the assignment was signed (YYYY-MM-DD)
4. recording_date: When recorded at county (YYYY-MM-DD)
5. instrument_number: Recording/document number if mentioned
6. power_of_attorney_indicator: true if "attorney-in-fact", "AIF", or "POA" appears
7. principal_name: If POA is used, who is the principal (e.g., "Deutsche Bank" if "Ocwen as attorney-in-fact for Deutsche Bank")

IMPORTANT RULES:
- If you see "MERS as nominee for [Company]", treat [Company] as the true assignor
- If you see "attorney-in-fact for [Principal]", extract [Principal] as principal_name
- Look for dates near "Dated:", "Executed:", "Date of Assignment:"
- Look for recording info near "Recorded:", "Filed:", "Instrument No:"

Return JSON:
{
  "assignor_name": "exact name",
  "assignee_name": "exact name",
  "execution_date": "YYYY-MM-DD or null",
  "recording_date": "YYYY-MM-DD or null", 
  "instrument_number": "number or null",
  "power_of_attorney_indicator": true/false,
  "principal_name": "name if POA, otherwise null"
}

Document text:
${text.substring(0, 8000)}`;

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
    // Enhanced pattern matching for assignment documents
    const assignorMatch = text.match(/assignor[:\s]*([^,\n]+)/i);
    const assigneeMatch = text.match(/assignee[:\s]*([^,\n]+)/i);
    const dateMatch = text.match(/dated?\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i);
    const recordedMatch = text.match(/recorded?\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i);
    const instrumentMatch = text.match(/instrument\s*(?:no\.?|number)\s*:?\s*([0-9\-]+)/i);
    const poaIndicator = /attorney.?in.?fact|aif\b|power.?of.?attorney/i.test(text);
    
    // Extract principal name if POA is detected
    let principalName = null;
    if (poaIndicator) {
      const principalMatch = text.match(/attorney.?in.?fact\s+for\s+([^,\n]+)/i);
      if (principalMatch) {
        principalName = principalMatch[1].trim();
      }
    }
    
    return {
      assignor_name: assignorMatch ? assignorMatch[1].trim() : null,
      assignee_name: assigneeMatch ? assigneeMatch[1].trim() : null,
      execution_date: dateMatch ? this.parseDate(dateMatch[1]) : null,
      recording_date: recordedMatch ? this.parseDate(recordedMatch[1]) : null,
      instrument_number: instrumentMatch ? instrumentMatch[1].trim() : null,
      power_of_attorney_indicator: poaIndicator,
      principal_name: principalName,
      // Legacy fields for compatibility
      assignor: assignorMatch ? assignorMatch[1].trim() : null,
      assignee: assigneeMatch ? assigneeMatch[1].trim() : null,
      assignmentDate: dateMatch ? this.parseDate(dateMatch[1]) : null,
      recordingDate: recordedMatch ? this.parseDate(recordedMatch[1]) : null
    };
  }

  parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      // Handle various date formats
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    } catch (error) {
      return null;
    }
  }

  orderAssignmentsChronologically(assignments) {
    console.log('📅 Ordering assignments chronologically by execution date...');
    
    return assignments.sort((a, b) => {
      // Primary sort by execution date (business rule: execution takes precedence)
      const dateA = a.execution_date || a.assignmentDate;
      const dateB = b.execution_date || b.assignmentDate;
      
      const parsedDateA = dateA ? new Date(dateA) : new Date('1900-01-01');
      const parsedDateB = dateB ? new Date(dateB) : new Date('1900-01-01');
      
      if (parsedDateA.getTime() !== parsedDateB.getTime()) {
        return parsedDateA.getTime() - parsedDateB.getTime();
      }
      
      // Secondary sort by recording date if execution dates are equal
      const recordA = a.recording_date || a.recordingDate;
      const recordB = b.recording_date || b.recordingDate;
      
      const parsedRecordA = recordA ? new Date(recordA) : parsedDateA;
      const parsedRecordB = recordB ? new Date(recordB) : parsedDateB;
      
      return parsedRecordA.getTime() - parsedRecordB.getTime();
    });
  }

  validateAssignmentChain(originalLender, orderedAssignments) {
    console.log('🔗 Validating assignment chain with enhanced business logic...');
    
    const issues = [];
    let currentOwner = originalLender;
    let isComplete = true;

    if (!originalLender) {
      issues.push('Original lender not identified in mortgage documents');
      isComplete = false;
    }

    if (orderedAssignments.length === 0) {
      return {
        isComplete: originalLender ? true : false,
        currentOwner: originalLender,
        issues: issues.length > 0 ? issues : null
      };
    }

    // Normalize assignments for validation
    const normalizedAssignments = orderedAssignments.map(assignment => ({
      ...assignment,
      normalizedAssignor: this.getNormalizedName(assignment.assignor_name || assignment.assignor),
      normalizedAssignee: this.getNormalizedName(assignment.assignee_name || assignment.assignee),
      effectiveAssignor: this.getEffectiveParty(assignment.assignor_name || assignment.assignor, assignment.principal_name),
      effectiveAssignee: this.getEffectiveParty(assignment.assignee_name || assignment.assignee)
    }));

    // Check first assignment connection to original lender
    const firstAssignment = normalizedAssignments[0];
    if (originalLender && firstAssignment.effectiveAssignor) {
      const normalizedOriginal = this.getNormalizedName(originalLender);
      const firstAssignorMatches = this.advancedNameMatch(normalizedOriginal, firstAssignment.normalizedAssignor) ||
                                   this.isMERSNominee(firstAssignment.effectiveAssignor, originalLender);
      
      if (!firstAssignorMatches) {
        issues.push(`Chain break: Original lender "${originalLender}" does not properly connect to first assignor "${firstAssignment.effectiveAssignor}"`);
        isComplete = false;
      }
    }

    // Validate chain continuity with enhanced logic
    for (let i = 0; i < normalizedAssignments.length; i++) {
      const assignment = normalizedAssignments[i];
      
      // Update current owner
      if (assignment.effectiveAssignee) {
        currentOwner = assignment.effectiveAssignee;
      }

      // Check connection to next assignment
      if (i < normalizedAssignments.length - 1) {
        const nextAssignment = normalizedAssignments[i + 1];
        
        if (assignment.effectiveAssignee && nextAssignment.effectiveAssignor) {
          const currentMatches = this.advancedNameMatch(
            assignment.normalizedAssignee, 
            nextAssignment.normalizedAssignor
          );
          
          if (!currentMatches) {
            issues.push(`Chain break: Assignee "${assignment.effectiveAssignee}" does not match next assignor "${nextAssignment.effectiveAssignor}"`);
            isComplete = false;
          }
        }
      }

      // Validate data completeness
      this.validateAssignmentData(assignment, i + 1, issues);
    }

    console.log(`🎯 Enhanced chain validation complete. Complete: ${isComplete}, Issues: ${issues.length}`);

    return {
      isComplete,
      currentOwner,
      issues: issues.length > 0 ? issues : null
    };
  }

  getNormalizedName(name) {
    if (!name) return '';
    
    return name.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,]/g, '')
      .replace(/\bas trustee for.*$/i, '')
      .replace(/\bsolely as nominee.*$/i, '')
      .replace(/\bn\.?a\.?/gi, 'na')
      .replace(/\bcorp\.?/gi, 'corporation')
      .replace(/\bllc\.?/gi, 'llc')
      .replace(/\binc\.?/gi, 'incorporated')
      .trim();
  }

  getEffectiveParty(partyName, principalName = null) {
    if (!partyName) return null;
    
    // If POA is used, use the principal name for chain validation
    if (principalName && this.isPowerOfAttorney(partyName)) {
      return principalName;
    }
    
    // Handle MERS nominee situations
    const mersNominee = this.extractMERSNominee(partyName);
    if (mersNominee) {
      return mersNominee;
    }
    
    return partyName;
  }

  isPowerOfAttorney(partyName) {
    if (!partyName) return false;
    const lower = partyName.toLowerCase();
    return lower.includes('attorney-in-fact') || 
           lower.includes('attorney in fact') ||
           lower.includes(' aif ') ||
           lower.includes(' poa ');
  }

  extractMERSNominee(partyName) {
    if (!partyName) return null;
    const lower = partyName.toLowerCase();
    
    // Look for "MERS as nominee for [Company]" pattern
    const mersMatch = lower.match(/mers.*as nominee for (.+?)(?:,|$)/);
    if (mersMatch) {
      return mersMatch[1].trim();
    }
    
    return null;
  }

  isMERSNominee(assignorName, originalLender) {
    if (!assignorName || !originalLender) return false;
    
    const nominee = this.extractMERSNominee(assignorName);
    if (nominee) {
      return this.advancedNameMatch(
        this.getNormalizedName(nominee),
        this.getNormalizedName(originalLender)
      );
    }
    
    return false;
  }

  advancedNameMatch(name1, name2) {
    if (!name1 || !name2) return false;
    
    // Exact match
    if (name1 === name2) return true;
    
    // Fuzzy match with 90% similarity threshold
    const similarity = this.calculateSimilarity(name1, name2);
    if (similarity >= 0.9) return true;
    
    // Containment match (for cases like "Bank of America" vs "Bank of America, N.A.")
    if (name1.includes(name2) || name2.includes(name1)) return true;
    
    return false;
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
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

  validateAssignmentData(assignment, index, issues) {
    if (!assignment.assignor_name && !assignment.assignor) {
      issues.push(`Assignment ${index}: Missing assignor name`);
    }
    
    if (!assignment.assignee_name && !assignment.assignee) {
      issues.push(`Assignment ${index}: Missing assignee name`);
    }
    
    if (!assignment.execution_date && !assignment.assignmentDate) {
      issues.push(`Assignment ${index}: Missing execution date`);
    }
    
    if (assignment.power_of_attorney_indicator && !assignment.principal_name) {
      issues.push(`Assignment ${index}: Power of attorney used but principal name not identified`);
    }
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