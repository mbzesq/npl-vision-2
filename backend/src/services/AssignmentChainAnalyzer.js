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
      assignments: chainValidation.enhancedAssignments || orderedAssignments,
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
          console.log(`📋 Chunk ${i + 1} assignment result:`, JSON.stringify(assignment, null, 2));
          
          if (assignment && (assignment.assignor_name || assignment.assignor || assignment.assignee_name || assignment.assignee)) {
            assignments.push({
              ...assignment,
              chunkIndex: i + 1
            });
            console.log(`✅ Added assignment from chunk ${i + 1}`);
          } else {
            console.log(`❌ No valid assignment data found in chunk ${i + 1}`);
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
    
    // Look for various assignment indicators
    return (lowerText.includes('assignment') && lowerText.includes('mortgage')) ||
           lowerText.includes('assignment of deed') ||
           lowerText.includes('assign') && (lowerText.includes('transfer') || lowerText.includes('convey')) ||
           lowerText.includes('assignor') ||
           lowerText.includes('assignee') ||
           (lowerText.includes('recorded') && lowerText.includes('instrument'));
  }

  async extractAssignmentDetails(text) {
    if (!this.openai) {
      console.log('🔄 Using fallback assignment extraction (no OpenAI)');
      return this.extractAssignmentFallback(text);
    }

    const prompt = `Extract detailed assignment information from this Assignment of Mortgage document.

Extract these fields with EXACT full names:
1. assignor_name: The party transferring the mortgage (FULL EXACT NAME)
2. assignee_name: The party receiving the mortgage (FULL EXACT NAME)
3. execution_date: When the assignment was signed (YYYY-MM-DD)
4. recording_date: When recorded at county (YYYY-MM-DD)
5. instrument_number: Recording/document number if mentioned
6. power_of_attorney_indicator: true if "attorney-in-fact", "AIF", or "POA" appears
7. principal_name: If POA is used, who is the principal

CRITICAL RULES:
- Extract COMPLETE party names including all nominee/trustee language
- If you see "MERS as nominee for [Company]", extract the FULL text as assignor/assignee
- If you see "Mortgage Electronic Registration Systems, Inc. as nominee for...", extract COMPLETE text
- Do NOT abbreviate or truncate party names
- Include all "as nominee for", "as trustee for", "d/b/a" language in the name
- Look for dates near "Dated:", "Executed:", "Date of Assignment:"
- Look for recording info near "Recorded:", "Filed:", "Instrument No:"

EXAMPLES:
✅ GOOD: "MERS as nominee for Lender and Lender's successors and assigns"
❌ BAD: "MERS"

✅ GOOD: "Bank of America, N.A. by Nationstar Mortgage LLC as Attorney in Fact"  
❌ BAD: "Bank of America"

Return JSON:
{
  "assignor_name": "COMPLETE EXACT NAME WITH ALL LANGUAGE",
  "assignee_name": "COMPLETE EXACT NAME WITH ALL LANGUAGE",
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
    // Enhanced pattern matching for assignment documents with better MERS handling
    
    // Look for various assignor patterns
    const assignorPatterns = [
      /assignor[:\s]*([^,\n]+?)(?:\s*,\s*(?:assignee|to|hereby))/i,
      /hereby assigns?.*?to\s+([^,\n]+)/i,
      /grants?,\s*assigns?.*?to\s+([^,\n]+)/i
    ];
    
    // Look for various assignee patterns  
    const assigneePatterns = [
      /assignee[:\s]*([^,\n]+?)(?:\s*,|\s*$|\s*(?:recorded|dated))/i,
      /(?:assigns?|transfers?).*?to\s+([^,\n]+?)(?:\s*,|\s*$)/i,
      /in favor of\s+([^,\n]+?)(?:\s*,|\s*$)/i
    ];
    
    let assignorMatch = null, assigneeMatch = null;
    
    // Try assignor patterns
    for (const pattern of assignorPatterns) {
      assignorMatch = text.match(pattern);
      if (assignorMatch) break;
    }
    
    // Try assignee patterns
    for (const pattern of assigneePatterns) {
      assigneeMatch = text.match(pattern);  
      if (assigneeMatch) break;
    }
    
    // Enhanced date matching
    const datePatterns = [
      /dated?\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
      /executed\s*(?:on|this)?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
      /day of\s+(\w+),?\s*([0-9]{4})/i
    ];
    
    let dateMatch = null;
    for (const pattern of datePatterns) {
      dateMatch = text.match(pattern);
      if (dateMatch) break;
    }
    
    const recordedMatch = text.match(/recorded?\s*:?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i);
    const instrumentMatch = text.match(/instrument\s*(?:no\.?|number)\s*:?\s*([A-Za-z0-9\-]+)/i);
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

    // Enhance assignments with original, normalized, and effective party names
    const enhancedAssignments = orderedAssignments.map((assignment, index) => {
      const assignorOriginal = assignment.assignor_name || assignment.assignor;
      const assigneeOriginal = assignment.assignee_name || assignment.assignee;
      
      // Analyze MERS roles for both assignor and assignee
      const assignorMersInfo = this.analyzeMERSRole(assignorOriginal);
      const assigneeMersInfo = this.analyzeMERSRole(assigneeOriginal);
      const assignorPOAInfo = this.analyzePOARole(assignorOriginal, assignment.principal_name);
      
      // CRITICAL FIX: Determine true effective parties (not MERS)
      let effectiveAssignor, effectiveAssignee;
      
      // For assignor: Use true party name (not MERS)
      if (assignorMersInfo.isMERS && assignorMersInfo.effectiveName) {
        effectiveAssignor = assignorMersInfo.effectiveName; // The true lender MERS represents
      } else if (assignorPOAInfo.isPOA && assignorPOAInfo.effectiveName) {
        effectiveAssignor = assignorPOAInfo.effectiveName; // The principal in POA relationship
      } else {
        effectiveAssignor = assignorOriginal;
      }
      
      // For assignee: Use true party name (not MERS)  
      if (assigneeMersInfo.isMERS) {
        if (assigneeMersInfo.effectiveName) {
          // If MERS nominee says "Lender" instead of actual name, try to use original lender
          if (assigneeMersInfo.effectiveName.toLowerCase().includes('lender') && originalLender) {
            effectiveAssignee = originalLender;
          } else {
            effectiveAssignee = assigneeMersInfo.effectiveName; // The true lender MERS represents
          }
        } else {
          // If MERS with no nominee info, but we know it's related to original lender
          effectiveAssignee = originalLender || assigneeOriginal;
        }
      } else {
        effectiveAssignee = assigneeOriginal;
      }
      
      return {
        ...assignment,
        // Store original names for audit
        assignor_original: assignorOriginal,
        assignee_original: assigneeOriginal,
        
        // Store normalized names for display (cleaned true parties, not MERS)
        assignor_normalized: this.getNormalizedName(effectiveAssignor),
        assignee_normalized: this.getNormalizedName(effectiveAssignee),
        
        // Store effective parties for validation
        effectiveAssignor: effectiveAssignor,
        effectiveAssignee: effectiveAssignee,
        
        // Store special role information
        assignor_mers_info: assignorMersInfo.isMERS ? assignorMersInfo : null,
        assignee_mers_info: assigneeMersInfo.isMERS ? assigneeMersInfo : null,
        mers_flag: assignorMersInfo.isMERS || assigneeMersInfo.isMERS,
        poa_info: assignorPOAInfo.isPOA ? assignorPOAInfo : null,
        
        // Add confidence scoring
        confidence_score: this.calculateAssignmentConfidence(assignment),
        
        // Add source information
        source_page: assignment.chunkIndex || index + 1,
        document_type: 'assignment_of_mortgage'
      };
    });

    // Check first assignment connection to original lender
    const firstAssignment = enhancedAssignments[0];
    if (originalLender && firstAssignment.effectiveAssignor) {
      const normalizedOriginal = this.getNormalizedName(originalLender);
      const firstAssignorMatches = this.advancedNameMatch(normalizedOriginal, firstAssignment.assignor_normalized) ||
                                   this.isMERSNominee(firstAssignment.effectiveAssignor, originalLender);
      
      if (!firstAssignorMatches) {
        issues.push(`Chain break: Original lender "${originalLender}" does not properly connect to first assignor "${firstAssignment.assignor_normalized}" (original: "${firstAssignment.assignor_original}")`);
        isComplete = false;
      }
    }

    // Validate chain continuity with enhanced logic
    for (let i = 0; i < enhancedAssignments.length; i++) {
      const assignment = enhancedAssignments[i];
      
      // Update current owner to normalized assignee name
      if (assignment.assignee_normalized) {
        currentOwner = assignment.assignee_normalized;
      }

      // Check connection to next assignment
      if (i < enhancedAssignments.length - 1) {
        const nextAssignment = enhancedAssignments[i + 1];
        
        if (assignment.assignee_normalized && nextAssignment.assignor_normalized) {
          const matchConfidence = this.calculateSimilarity(assignment.assignee_normalized, nextAssignment.assignor_normalized);
          const currentMatches = matchConfidence >= 0.9;
          
          if (!currentMatches) {
            issues.push(`Chain break: Assignee "${assignment.assignee_normalized}" does not match next assignor "${nextAssignment.assignor_normalized}" (confidence: ${Math.round(matchConfidence * 100)}%)`);
            isComplete = false;
          }
        }
      }

      // Validate data completeness
      this.validateAssignmentData(assignment, i + 1, issues);
    }

    console.log(`🎯 Enhanced chain validation complete. Complete: ${isComplete}, Issues: ${issues.length}`);
    console.log('📋 Enhanced assignments summary:');
    enhancedAssignments.forEach((assignment, idx) => {
      console.log(`  Assignment ${idx + 1}: ${assignment.assignor_normalized} → ${assignment.assignee_normalized} ${assignment.mers_flag ? '[MERS]' : ''}`);
    });

    return {
      isComplete,
      currentOwner,
      issues: issues.length > 0 ? issues : null,
      enhancedAssignments
    };
  }

  getNormalizedName(name) {
    if (!name) return '';
    
    let normalized = name.toLowerCase()
      // Remove common boilerplate legal suffixes
      .replace(/,?\s*its successors and\/or assigns?.*$/i, '')
      .replace(/,?\s*its successors and assigns?.*$/i, '')
      .replace(/,?\s*and\/or assigns?.*$/i, '')
      .replace(/,?\s*and assigns?.*$/i, '')
      .replace(/,?\s*its successors.*$/i, '')
      .replace(/,?\s*their successors.*$/i, '')
      .replace(/,?\s*successors in interest.*$/i, '')
      .replace(/,?\s*their legal representatives.*$/i, '')
      .replace(/,?\s*by and through its attorney-in-fact.*$/i, '')
      .replace(/,?\s*acting through.*$/i, '')
      .replace(/,?\s*as attorney-in-fact for.*$/i, '')
      .replace(/,?\s*doing business as.*$/i, '')
      .replace(/,?\s*d\/b\/a.*$/i, '')
      .replace(/,?\s*solely as nominee.*$/i, '')
      .replace(/,?\s*as trustee for.*$/i, '')
      
      // Normalize corporate suffixes
      .replace(/\bn\.?a\.?/gi, 'na')
      .replace(/\bcorp\.?/gi, 'corporation')
      .replace(/\bllc\.?/gi, 'llc')
      .replace(/\binc\.?/gi, 'incorporated')
      .replace(/\bltd\.?/gi, 'limited')
      .replace(/\bl\.?p\.?/gi, 'lp')
      
      // Clean up whitespace and punctuation
      .replace(/\s+/g, ' ')
      .replace(/[.,;]+$/, '')
      .trim();
    
    return normalized;
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

  analyzeMERSRole(partyName) {
    if (!partyName) return { isMERS: false };
    
    const lowerName = partyName.toLowerCase();
    
    // Look for MERS nominee patterns - more comprehensive matching
    const mersPatterns = [
      /mers.*as nominee for (.+?)(?:,|\s+and\s|$)/i,
      /mers.*solely as nominee for (.+?)(?:,|\s+and\s|$)/i,
      /mortgage electronic registration systems.*as nominee for (.+?)(?:,|\s+and\s|$)/i
    ];
    
    let mersNomineeMatch = null;
    for (const pattern of mersPatterns) {
      mersNomineeMatch = partyName.match(pattern);
      if (mersNomineeMatch) break;
    }
    
    if (mersNomineeMatch || lowerName.includes('mers')) {
      const effectiveName = mersNomineeMatch ? mersNomineeMatch[1].trim() : null;
      
      return {
        isMERS: true,
        originalName: partyName,
        effectiveName: effectiveName,
        role: 'nominee',
        // CRITICAL: MERS should always be treated as passthrough to the true party
        isPassthrough: true
      };
    }
    
    return { isMERS: false };
  }

  analyzePOARole(partyName, principalName = null) {
    if (!partyName) return { isPOA: false };
    
    const lowerName = partyName.toLowerCase();
    const isPOA = lowerName.includes('attorney-in-fact') || 
                  lowerName.includes('attorney in fact') ||
                  lowerName.includes(' aif ') ||
                  lowerName.includes(' poa ');
    
    if (isPOA) {
      // Extract principal from the text if not provided
      let extractedPrincipal = principalName;
      if (!extractedPrincipal) {
        const principalMatch = partyName.match(/attorney-in-fact for (.+?)(?:,|$)/i);
        if (principalMatch) {
          extractedPrincipal = principalMatch[1].trim();
        }
      }
      
      return {
        isPOA: true,
        originalName: partyName,
        effectiveName: extractedPrincipal,
        agent: partyName.split(/attorney-in-fact|aif|poa/i)[0].trim(),
        principal: extractedPrincipal
      };
    }
    
    return { isPOA: false };
  }

  calculateAssignmentConfidence(assignment) {
    let confidence = 1.0;
    
    // Reduce confidence for missing data
    if (!assignment.execution_date && !assignment.assignmentDate) confidence -= 0.2;
    if (!assignment.recording_date && !assignment.recordingDate) confidence -= 0.1;
    if (!assignment.instrument_number) confidence -= 0.1;
    
    // Reduce confidence for incomplete names
    if (!assignment.assignor_name && !assignment.assignor) confidence -= 0.3;
    if (!assignment.assignee_name && !assignment.assignee) confidence -= 0.3;
    
    return Math.max(0.1, confidence);
  }

  validateAssignmentData(assignment, index, issues) {
    if (!assignment.assignor_original && !assignment.assignor_name && !assignment.assignor) {
      issues.push(`Assignment ${index}: Missing assignor name`);
    }
    
    if (!assignment.assignee_original && !assignment.assignee_name && !assignment.assignee) {
      issues.push(`Assignment ${index}: Missing assignee name`);
    }
    
    if (!assignment.execution_date && !assignment.assignmentDate) {
      issues.push(`Assignment ${index}: Missing execution date`);
    }
    
    if (assignment.power_of_attorney_indicator && !assignment.principal_name && !assignment.poa_info?.principal) {
      issues.push(`Assignment ${index}: Power of attorney used but principal name not identified`);
    }
    
    if (assignment.confidence_score < 0.7) {
      issues.push(`Assignment ${index}: Low confidence score (${Math.round(assignment.confidence_score * 100)}%) - manual review recommended`);
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