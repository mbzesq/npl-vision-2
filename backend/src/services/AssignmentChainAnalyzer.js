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

    // Process more chunks to capture all assignments (increased from 4 to 6)
    const chunksToProcess = chunks.slice(0, 6);

    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i];
      const chunkText = chunk.text.substring(0, 500); // Preview for logging
      
      console.log(`🔍 Analyzing chunk ${i + 1}/${chunksToProcess.length} (${chunk.text.length} chars)`);
      console.log(`📄 Chunk ${i + 1} preview:`, chunkText);
      
      // Check if this chunk contains assignment data
      const hasAssignmentData = this.containsAssignmentData(chunk.text);
      console.log(`📋 Chunk ${i + 1} has assignment data:`, hasAssignmentData);
      
      if (hasAssignmentData) {
        console.log(`🔍 Found assignment data in chunk ${i + 1}, extracting details...`);
        try {
          const assignment = await this.extractAssignmentDetails(chunk.text);
          console.log(`📋 Chunk ${i + 1} assignment result:`, JSON.stringify(assignment, null, 2));
          
          if (assignment && (assignment.assignor_name || assignment.assignor || assignment.assignee_name || assignment.assignee)) {
            assignments.push({
              ...assignment,
              chunkIndex: i + 1,
              chunkPreview: chunkText
            });
            console.log(`✅ Added assignment from chunk ${i + 1}: ${assignment.assignor_name || assignment.assignor} → ${assignment.assignee_name || assignment.assignee}`);
          } else {
            console.log(`❌ No valid assignment data found in chunk ${i + 1} - assignment object was:`, assignment);
          }
        } catch (error) {
          console.error(`⚠️ Error extracting assignment from chunk ${i + 1}:`, error.message);
          // Continue to next chunk
        }
      } else {
        // Check why this chunk was skipped
        const lowerText = chunk.text.toLowerCase();
        if (lowerText.includes('assignment')) {
          console.log(`⚠️ Chunk ${i + 1} contains 'assignment' but was filtered out - checking why...`);
          const isMortgageOrig = this.isMortgageOrigination(chunk.text);
          console.log(`📋 Chunk ${i + 1} - isMortgageOrigination:`, isMortgageOrig);
        }
      }
    }

    console.log(`📋 Found ${assignments.length} total assignments`);
    assignments.forEach((assignment, idx) => {
      console.log(`📄 Assignment ${idx + 1}: ${assignment.assignor_name || assignment.assignor || 'Unknown'} → ${assignment.assignee_name || assignment.assignee || 'Unknown'} (chunk ${assignment.chunkIndex})`);
    });
    
    return assignments;
  }

  containsAssignmentData(text) {
    const lowerText = text.toLowerCase();
    
    // CRITICAL: Exclude mortgage originations that mention MERS
    // These are not assignments, just the original mortgage setup
    if (this.isMortgageOrigination(text)) {
      console.log('🚫 Skipping mortgage origination - not an assignment');
      return false;
    }
    
    // Enhanced assignment detection patterns
    const assignmentIndicators = [
      // Explicit assignment language
      (lowerText.includes('assignment') && lowerText.includes('mortgage')),
      lowerText.includes('assignment of deed'),
      lowerText.includes('assignment of security deed'),
      
      // Assignor/assignee language
      lowerText.includes('assignor'),
      lowerText.includes('assignee'),
      
      // Transfer language with assignment context
      (lowerText.includes('assign') && (lowerText.includes('transfer') || lowerText.includes('convey'))),
      (lowerText.includes('hereby assign') || lowerText.includes('hereby transfer')),
      
      // Corporate assignment patterns
      (lowerText.includes('bank') && lowerText.includes('assign')),
      (lowerText.includes('mortgage') && lowerText.includes('transfer')),
      
      // Recording language that suggests assignment
      (lowerText.includes('recorded') && lowerText.includes('instrument') && 
       (lowerText.includes('assign') || lowerText.includes('transfer'))),
       
      // POA assignment patterns
      (lowerText.includes('attorney-in-fact') && lowerText.includes('mortgage')),
      (lowerText.includes('attorney in fact') && lowerText.includes('assign'))
    ];
    
    const hasAssignmentIndicator = assignmentIndicators.some(indicator => indicator);
    
    if (hasAssignmentIndicator) {
      console.log('✅ Contains assignment data - detected via indicators');
    }
    
    return hasAssignmentIndicator;
  }

  isMortgageOrigination(text) {
    const lowerText = text.toLowerCase();
    
    // CRITICAL: Only exclude if this is clearly a mortgage origination, not an assignment
    // Check for explicit assignment language first - if present, this is NOT origination
    const hasAssignmentLanguage = lowerText.includes('assignment of mortgage') ||
                                 lowerText.includes('assignment of deed') ||
                                 lowerText.includes('assignor') ||
                                 lowerText.includes('assignee') ||
                                 (lowerText.includes('assign') && (lowerText.includes('transfer') || lowerText.includes('convey')));
    
    // If it has assignment language, it's definitely not a mortgage origination
    if (hasAssignmentLanguage) {
      return false;
    }
    
    // Check for mortgage origination patterns
    const isMortgageDoc = (lowerText.includes('mortgage') && lowerText.includes('deed')) ||
                         lowerText.includes('deed of trust') ||
                         lowerText.includes('security deed');
    
    // Check for borrower-to-MERS pattern (typical in originations) 
    // BUT only if there are individual names (not corporate entities)
    const hasBorrowerMERSPattern = lowerText.includes('borrower') && lowerText.includes('mers') &&
                                  (lowerText.includes(' and ') && !lowerText.includes('bank') && !lowerText.includes('corp'));
    
    // Check for origination language
    const hasOriginationLanguage = lowerText.includes('grants and conveys') ||
                                  lowerText.includes('mortgagor') ||
                                  lowerText.includes('mortgagee') ||
                                  lowerText.includes('to secure payment');
    
    // Only exclude if it's clearly a mortgage document AND has borrower-to-MERS pattern AND origination language
    return isMortgageDoc && hasBorrowerMERSPattern && hasOriginationLanguage;
  }

  detectPOA(text) {
    // Enhanced POA patterns to capture clean agent/principal pairs
    const poaPatterns = [
      // "executed by [Agent] as attorney-in-fact for [Principal]"
      /executed\s+by\s+([^,]+?)\s*,?\s*(?:as\s+)?(?:attorney[- ]in[- ]fact|AIF)\s+(?:for|on behalf of)\s+([^,\n.]+?)(?:,|\.|\s*$|\s+(?:dated|this|on))/i,
      
      // "by [Agent] as attorney-in-fact for [Principal]"
      /(?:^|\s)by\s+([^,]+?)\s*,?\s*(?:as\s+)?(?:attorney[- ]in[- ]fact|AIF)\s+(?:for|on behalf of)\s+([^,\n.]+?)(?:,|\.|\s*$|\s+(?:dated|this|on))/i,
      
      // "[Principal] by [Agent] as attorney-in-fact"
      /^([^,]+?)\s+by\s+([^,]+?)\s*,?\s*(?:as\s+)?(?:attorney[- ]in[- ]fact|AIF)(?:\s|,|\.|$)/i,
      
      // "[Agent], as attorney-in-fact for [Principal]"
      /^([^,]+?)\s*,\s*(?:as\s+)?(?:attorney[- ]in[- ]fact|AIF)\s+(?:for|on behalf of)\s+([^,\n.]+?)(?:,|\.|\s*$|\s+(?:dated|this|on))/i
    ];

    for (let i = 0; i < poaPatterns.length; i++) {
      const pattern = poaPatterns[i];
      const match = text.match(pattern);
      if (match && match[1] && match[2]) {
        let agent, principal;
        
        // For pattern 3, the order is reversed (principal first, then agent)
        if (i === 2) {
          principal = this.cleanPOAName(match[1]);
          agent = this.cleanPOAName(match[2]);
        } else {
          agent = this.cleanPOAName(match[1]);
          principal = this.cleanPOAName(match[2]);
        }
        
        // Validate that we have reasonable names (not just punctuation or boilerplate)
        if (agent.length > 2 && principal.length > 2 && !agent.match(/^[\s,.-]+$/) && !principal.match(/^[\s,.-]+$/)) {
          console.log(`🔍 POA detected: Agent="${agent}", Principal="${principal}"`);
          
          return {
            poa_agent: agent,
            poa_principal: principal,
            isPOA: true
          };
        }
      }
    }
    
    return null;
  }

  cleanPOAName(name) {
    if (!name) return '';
    
    return name
      .trim()
      .replace(/^[,\s]+|[,\s]+$/g, '') // Remove leading/trailing commas and spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/,\s*$/, '') // Remove trailing comma
      .replace(/^(by|executed by|as)\s+/i, '') // Remove POA prefixes that leaked in
      .replace(/\s+(as attorney|as aif|attorney).*$/i, '') // Remove POA suffixes that leaked in
      .trim();
  }

  async extractAssignmentDetails(text) {
    // CRITICAL: Check if this is actually a mortgage origination, not an assignment
    if (this.isMortgageOrigination(text)) {
      console.log('🚫 Detected mortgage origination - skipping assignment extraction');
      return null;
    }

    if (!this.openai) {
      console.log('🔄 Using fallback assignment extraction (no OpenAI)');
      return this.extractAssignmentFallback(text);
    }

    // First detect POA relationships in the text
    const poaInfo = this.detectPOA(text);

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
        
        // Enhance with POA detection if not already detected by AI
        if (poaInfo && !assignment.poa_agent) {
          assignment.poa_agent = poaInfo.poa_agent;
          assignment.poa_principal = poaInfo.poa_principal;
          assignment.power_of_attorney_indicator = true;
          
          // If assignor contains POA language, use principal for normalized name
          if (assignment.assignor_name && assignment.assignor_name.toLowerCase().includes('attorney')) {
            assignment.assignor_normalized = this.getNormalizedName(poaInfo.poa_principal);
            assignment.assignor_original = assignment.assignor_name;
          }
          
          // If assignee contains POA language, use principal for normalized name  
          if (assignment.assignee_name && assignment.assignee_name.toLowerCase().includes('attorney')) {
            assignment.assignee_normalized = this.getNormalizedName(poaInfo.poa_principal);
            assignment.assignee_original = assignment.assignee_name;
          }
        }
        
        return assignment;
      } catch (parseError) {
        // Try to extract JSON from response
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const assignment = JSON.parse(jsonMatch[0]);
          
          // Apply POA enhancement to fallback parsing too
          if (poaInfo && !assignment.poa_agent) {
            assignment.poa_agent = poaInfo.poa_agent;
            assignment.poa_principal = poaInfo.poa_principal;
            assignment.power_of_attorney_indicator = true;
          }
          
          return assignment;
        }
        throw new Error('Invalid JSON response');
      }
      
    } catch (error) {
      console.error('Error extracting assignment details:', error);
      return this.extractAssignmentFallback(text);
    }
  }

  extractAssignmentFallback(text) {
    // CRITICAL: Check if this is actually a mortgage origination, not an assignment
    if (this.isMortgageOrigination(text)) {
      console.log('🚫 Detected mortgage origination in fallback - skipping assignment extraction');
      return null;
    }
    
    // Enhanced pattern matching for assignment documents with better MERS handling
    
    // First check for POA in the text
    const poaInfo = this.detectPOA(text);
    
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
    
    const baseResult = {
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
    
    // Enhance with POA detection if found
    if (poaInfo && poaInfo.isPOA) {
      baseResult.poa_agent = poaInfo.poa_agent;
      baseResult.poa_principal = poaInfo.poa_principal;
      baseResult.power_of_attorney_indicator = true;
      
      // If assignor contains POA language, use principal for normalized name
      if (baseResult.assignor_name && baseResult.assignor_name.toLowerCase().includes('attorney')) {
        baseResult.assignor_normalized = this.getNormalizedName(poaInfo.poa_principal);
        baseResult.assignor_original = baseResult.assignor_name;
      }
      
      // If assignee contains POA language, use principal for normalized name  
      if (baseResult.assignee_name && baseResult.assignee_name.toLowerCase().includes('attorney')) {
        baseResult.assignee_normalized = this.getNormalizedName(poaInfo.poa_principal);
        baseResult.assignee_original = baseResult.assignee_name;
      }
    }
    
    return baseResult;
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
      const assignorPOAInfo = this.analyzePOARole(assignorOriginal, assignment.principal_name || assignment.poa_principal);
      const assigneePOAInfo = this.analyzePOARole(assigneeOriginal, assignment.principal_name || assignment.poa_principal);
      
      // CRITICAL FIX: Determine true effective parties (not MERS)
      let effectiveAssignor, effectiveAssignee;
      
      // For assignor: Use true party name (not MERS, and principal for POA)
      if (assignorMersInfo.isMERS && assignorMersInfo.effectiveName) {
        effectiveAssignor = assignorMersInfo.effectiveName; // The true lender MERS represents
      } else if (assignorPOAInfo.isPOA && assignorPOAInfo.effectiveName) {
        effectiveAssignor = assignorPOAInfo.effectiveName; // The principal in POA relationship
      } else if (assignment.poa_principal && assignorOriginal && assignorOriginal.toLowerCase().includes('attorney')) {
        effectiveAssignor = assignment.poa_principal; // Use detected principal
      } else {
        effectiveAssignor = assignorOriginal;
      }
      
      // For assignee: Use true party name (not MERS, and principal for POA)  
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
      } else if (assigneePOAInfo.isPOA && assigneePOAInfo.effectiveName) {
        effectiveAssignee = assigneePOAInfo.effectiveName; // The principal in POA relationship
      } else if (assignment.poa_principal && assigneeOriginal && assigneeOriginal.toLowerCase().includes('attorney')) {
        effectiveAssignee = assignment.poa_principal; // Use detected principal
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
        assignor_poa_info: assignorPOAInfo.isPOA ? assignorPOAInfo : null,
        assignee_poa_info: assigneePOAInfo.isPOA ? assigneePOAInfo : null,
        poa_info: assignorPOAInfo.isPOA ? assignorPOAInfo : (assigneePOAInfo.isPOA ? assigneePOAInfo : null),
        poa_agent: assignment.poa_agent || null,
        poa_principal: assignment.poa_principal || null,
        
        // Add confidence scoring
        confidence_score: this.calculateAssignmentConfidence(assignment),
        
        // Add source information
        source_page: assignment.chunkIndex || index + 1,
        document_type: 'assignment_of_mortgage'
      };
    });

    // Check first assignment connection to original lender
    const firstAssignment = enhancedAssignments[0];
    if (originalLender && firstAssignment) {
      const normalizedOriginal = this.getNormalizedName(originalLender);
      
      // CRITICAL: Use POA principal or effective assignor for matching
      const firstAssignorForMatching = firstAssignment.poa_principal || 
                                      firstAssignment.effectiveAssignor || 
                                      firstAssignment.assignor_normalized;
      
      const firstAssignorMatches = this.advancedNameMatch(normalizedOriginal, firstAssignorForMatching) ||
                                   this.isMERSNominee(firstAssignment.effectiveAssignor, originalLender);
      
      if (!firstAssignorMatches) {
        // Only report as issue if we can't match through any method
        const mersInfo = firstAssignment.assignor_mers_info;
        if (mersInfo && mersInfo.effectiveName) {
          const mersMatches = this.advancedNameMatch(normalizedOriginal, this.getNormalizedName(mersInfo.effectiveName));
          if (!mersMatches) {
            issues.push(`Chain break: Original lender "${originalLender}" does not connect to first assignor "${firstAssignorForMatching}" (MERS effective: "${mersInfo.effectiveName}")`);
            isComplete = false;
          }
        } else {
          issues.push(`Chain break: Original lender "${originalLender}" does not connect to first assignor "${firstAssignorForMatching}"`);
          isComplete = false;
        }
      }
    }

    // Validate chain continuity with enhanced logic
    for (let i = 0; i < enhancedAssignments.length; i++) {
      const assignment = enhancedAssignments[i];
      
      // CRITICAL: Update current owner using POA principal or normalized assignee
      const effectiveAssignee = assignment.poa_principal || assignment.effectiveAssignee || assignment.assignee_normalized;
      if (effectiveAssignee) {
        currentOwner = effectiveAssignee;
      }

      // Check connection to next assignment
      if (i < enhancedAssignments.length - 1) {
        const nextAssignment = enhancedAssignments[i + 1];
        
        // CRITICAL: Use POA principals and effective parties for matching
        const currentAssigneeForMatching = assignment.poa_principal || assignment.effectiveAssignee || assignment.assignee_normalized;
        const nextAssignorForMatching = nextAssignment.poa_principal || nextAssignment.effectiveAssignor || nextAssignment.assignor_normalized;
        
        if (currentAssigneeForMatching && nextAssignorForMatching) {
          const matchConfidence = this.calculateSimilarity(currentAssigneeForMatching, nextAssignorForMatching);
          const currentMatches = matchConfidence >= 0.85; // Lowered threshold due to better normalization
          
          if (!currentMatches) {
            // Check if this is a POA situation that should be considered a match
            const isPOAMatch = (assignment.poa_agent && nextAssignment.poa_principal) ||
                              (assignment.poa_principal && nextAssignment.poa_agent);
            
            if (!isPOAMatch) {
              // Check MERS passthrough
              const mersMatch = this.checkMERSPassthrough(assignment, nextAssignment);
              if (!mersMatch) {
                issues.push(`Chain break: Assignee "${currentAssigneeForMatching}" does not match next assignor "${nextAssignorForMatching}" (confidence: ${Math.round(matchConfidence * 100)}%)`);
                isComplete = false;
              } else {
                console.log(`✅ MERS passthrough match: ${currentAssigneeForMatching} → ${nextAssignorForMatching}`);
              }
            } else {
              console.log(`✅ POA match: ${currentAssigneeForMatching} → ${nextAssignorForMatching}`);
            }
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
    
    // First check if this is a MERS nominee - extract the true principal
    const mersInfo = this.analyzeMERSRole(name);
    if (mersInfo.isMERS && mersInfo.effectiveName) {
      name = mersInfo.effectiveName; // Use the true underlying party
    }
    
    let normalized = name.toLowerCase()
      // Remove address information
      .replace(/,?\s*(?:at|located at)\s+.+$/i, '') // Remove everything after "at" or "located at"
      .replace(/,\s*\d{1,5}\s+[^,]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|blvd|boulevard).*$/i, '') // Remove street addresses
      .replace(/,\s*\d{5}(?:-\d{4})?(?:\s*,.*)?$/i, '') // Remove ZIP codes and everything after
      .replace(/,\s*(?:attn|attention)\s*[#:]?\s*\d+.*$/i, '') // Remove attention lines
      .replace(/,\s*(?:[A-Z]{2}\s+\d{5}|[A-Z]{2})\s*$/i, '') // Remove state codes at end
      
      // Remove common boilerplate legal suffixes
      .replace(/,?\s*(?:its\s+)?successors\s+and\/or\s+assigns?.*$/i, '')
      .replace(/,?\s*(?:its\s+)?successors\s+and\s+assigns?.*$/i, '')
      .replace(/,?\s*and\/or\s+assigns?.*$/i, '')
      .replace(/,?\s*and\s+assigns?.*$/i, '')
      .replace(/,?\s*(?:its\s+)?successors.*$/i, '')
      .replace(/,?\s*(?:their\s+)?successors.*$/i, '')
      .replace(/,?\s*successors\s+in\s+interest.*$/i, '')
      .replace(/,?\s*(?:their\s+)?legal\s+representatives.*$/i, '')
      .replace(/,?\s*by\s+and\s+through\s+its\s+attorney-in-fact.*$/i, '')
      .replace(/,?\s*acting\s+through.*$/i, '')
      .replace(/,?\s*as\s+attorney-in-fact\s+for.*$/i, '')
      .replace(/,?\s*doing\s+business\s+as.*$/i, '')
      .replace(/,?\s*d\/b\/a.*$/i, '')
      .replace(/,?\s*solely\s+as\s+nominee.*$/i, '')
      .replace(/,?\s*as\s+trustee\s+for.*$/i, '')
      .replace(/,?\s*as\s+nominee\s+for.*$/i, '') // Remove any remaining nominee language
      
      // Normalize corporate suffixes
      .replace(/\bn\.?a\.?/gi, 'na')
      .replace(/\bcorp\.?/gi, 'corporation')
      .replace(/\bllc\.?/gi, 'llc')
      .replace(/\binc\.?/gi, 'incorporated')
      .replace(/\bltd\.?/gi, 'limited')
      .replace(/\bl\.?p\.?/gi, 'lp')
      .replace(/\bco\.?$/gi, 'company')
      
      // Clean up whitespace and punctuation
      .replace(/\s+/g, ' ')
      .replace(/[.,;]+$/, '')
      .replace(/^[,\s]+|[,\s]+$/g, '') // Remove leading/trailing commas and spaces
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
    
    const norm1 = this.getNormalizedName(name1);
    const norm2 = this.getNormalizedName(name2);
    
    // Exact match after normalization
    if (norm1 === norm2) return true;
    
    // Fuzzy match with enhanced similarity (includes successor mapping)
    const similarity = this.calculateSimilarity(norm1, norm2);
    if (similarity >= 0.85) return true; // Lowered threshold due to better normalization
    
    // Containment match (for cases like "Bank of America" vs "Bank of America, N.A.")
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      // Make sure it's not just a short common word
      const shorter = norm1.length < norm2.length ? norm1 : norm2;
      if (shorter.length >= 5) return true; // Only if substantial overlap
    }
    
    return false;
  }

  // Known successor/acquisition mappings
  getKnownSuccessors() {
    return {
      'countrywide home loans, incorporated': 'bank of america, na',
      'countrywide home loans, inc': 'bank of america, na',
      'countrywide bank, na': 'bank of america, na',
      'countrywide bank, fsb': 'bank of america, na',
      'bac home loans servicing, lp': 'bank of america, na',
      'residential funding company, llc': 'ally bank',
      'gmac mortgage, llc': 'ally bank',
      'chase home finance llc': 'jpmorgan chase bank, na',
      'washington mutual bank': 'jpmorgan chase bank, na',
      'wamu': 'jpmorgan chase bank, na',
      'wells fargo home mortgage': 'wells fargo bank, na',
      'world savings bank, fsb': 'wells fargo bank, na',
      'wachovia mortgage, fsb': 'wells fargo bank, na'
    };
  }

  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    // Check known successor mappings first
    const successors = this.getKnownSuccessors();
    const norm1 = str1.toLowerCase().trim();
    const norm2 = str2.toLowerCase().trim();
    
    // Direct successor mapping
    if (successors[norm1] === norm2 || successors[norm2] === norm1) {
      return 1.0; // Perfect match via successor mapping
    }
    
    // Check if one maps to the other
    if (successors[norm1] && successors[norm1] === norm2) return 1.0;
    if (successors[norm2] && successors[norm2] === norm1) return 1.0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    // Enhanced fuzzy matching
    const editDistance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    const similarity = (longer.length - editDistance) / longer.length;
    
    // Boost similarity for partial matches of known entities
    if (similarity >= 0.7) {
      // Check if both contain common banking terms
      const bankTerms = ['bank', 'mortgage', 'financial', 'lending', 'loan', 'trust', 'national', 'home'];
      const commonTerms = bankTerms.filter(term => 
        norm1.includes(term) && norm2.includes(term)
      ).length;
      
      if (commonTerms >= 2) {
        return Math.min(1.0, similarity + 0.1); // Small boost for banking entities
      }
    }
    
    return similarity;
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

  extractMERSPrincipal(name) {
    if (!name) return null;
    
    // Enhanced MERS principal extraction patterns
    const mersPatterns = [
      // "MERS as nominee for [Company]"
      /mers.*?(?:as\s+|solely\s+as\s+)?nominee\s+for\s+(.+?)(?:,\s*(?:its\s+successors|and\s+assigns|located|at\s+\d)|\s*$)/i,
      // "MERS, solely as nominee for [Company]"
      /mers,?\s*solely\s+as\s+nominee\s+for\s+(.+?)(?:,\s*(?:its\s+successors|and\s+assigns|located|at\s+\d)|\s*$)/i,
      // "Mortgage Electronic Registration Systems, Inc. as nominee for [Company]"
      /mortgage\s+electronic\s+registration\s+systems.*?as\s+nominee\s+for\s+(.+?)(?:,\s*(?:its\s+successors|and\s+assigns|located|at\s+\d)|\s*$)/i
    ];
    
    for (const pattern of mersPatterns) {
      const match = name.match(pattern);
      if (match && match[1]) {
        let principal = match[1].trim();
        // Clean up the principal name
        principal = principal.replace(/,?\s*its\s+successors.*$/i, '');
        principal = principal.replace(/,?\s*and\s+assigns.*$/i, '');
        return principal;
      }
    }
    
    return null;
  }

  analyzeMERSRole(partyName) {
    if (!partyName) return { isMERS: false };
    
    const lowerName = partyName.toLowerCase();
    const isMERSEntity = lowerName.includes('mers') || lowerName.includes('mortgage electronic registration');
    
    if (isMERSEntity) {
      const principal = this.extractMERSPrincipal(partyName);
      
      return {
        isMERS: true,
        originalName: partyName,
        effectiveName: principal, // The true underlying party
        role: 'nominee',
        isPassthrough: true,
        principalFound: !!principal
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

  checkMERSPassthrough(currentAssignment, nextAssignment) {
    // Check if current assignee is MERS and next assignor is the effective party
    if (currentAssignment.assignee_mers_info?.isMERS && currentAssignment.assignee_mers_info?.effectiveName) {
      const mersEffective = this.getNormalizedName(currentAssignment.assignee_mers_info.effectiveName);
      const nextAssignor = this.getNormalizedName(nextAssignment.assignor_normalized || nextAssignment.assignor_original);
      return this.advancedNameMatch(mersEffective, nextAssignor);
    }
    
    // Check if current assignor is MERS and we're matching to the effective party
    if (nextAssignment.assignor_mers_info?.isMERS && nextAssignment.assignor_mers_info?.effectiveName) {
      const mersEffective = this.getNormalizedName(nextAssignment.assignor_mers_info.effectiveName);
      const currentAssignee = this.getNormalizedName(currentAssignment.assignee_normalized || currentAssignment.assignee_original);
      return this.advancedNameMatch(currentAssignee, mersEffective);
    }
    
    return false;
  }

  namesMatch(name1, name2) {
    if (!name1 || !name2) return false;
    
    // Use enhanced name matching
    return this.advancedNameMatch(name1, name2);
  }
}

module.exports = AssignmentChainAnalyzer;