import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseCommand } from '../../../../utils/commandParser';

// API route configuration
export const runtime = 'nodejs';
export const maxDuration = 3600; // 1 hour timeout for testing

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

// Helper function to call Gemini - simplified to match working HCPCS validation
async function callGemini(messages: Array<{role: string, content: string}>, options: {model?: string, temperature?: number, maxTokens?: number} = {}) {
  const modelName = options.model || "gemini-1.5-flash";
  console.log('[GEMINI DEBUG] Attempting to call model:', modelName);
  
  try {
    // Use exact same pattern as working HCPCS validation
    const model = genAI.getGenerativeModel({ model: modelName });
    
    // Convert OpenAI messages format to simple prompt like HCPCS validation
    const prompt = messages.map(msg => {
      if (msg.role === 'system') return msg.content;
      if (msg.role === 'user') return `User: ${msg.content}`;
      if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
      return msg.content;
    }).join('\n\n');
    
    console.log('[GEMINI DEBUG] Sending prompt to', modelName, '- length:', prompt.length);
    const response = await model.generateContent(prompt);
    console.log('[GEMINI DEBUG] Successfully got response from', modelName);
    return response.response.text();
  } catch (error) {
    console.error('[GEMINI DEBUG] Error with model', modelName, ':', error);
    console.error('[GEMINI DEBUG] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      status: (error as { status?: number })?.status,
      code: (error as { code?: string })?.code,
      details: (error as { details?: unknown })?.details
    });
    throw error;
  }
}

interface GridContext {
  columns: string[];
  rowCount: number;
  sampleData: Record<string, unknown>[];
  currentView: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
  availableGrids: {
    master: { hasData: boolean; rowCount: number };
    client: { hasData: boolean; rowCount: number };
    merged: { hasData: boolean; rowCount: number };
    unmatched: { hasData: boolean; rowCount: number };
    duplicates: { hasData: boolean; rowCount: number };
  };
  isInCompareMode: boolean;
  selectedGrid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
  selectedRowId: number | string | null;
  selectedRowData: Record<string, unknown> | null;
  selectedHcpcs: string | null;
  selectedRowCount: number;
}


// Function to classify request type
function classifyRequest(message: string): 'analysis' | 'command' | 'documentation' | 'validation' {
  const lowerMessage = message.toLowerCase();
  
  // Documentation keywords - questions about the app itself
  const documentationKeywords = [
    'what is this app', 'what does this app', 'what is the app', 'what does the app',
    'what is this tool', 'what does this tool', 'what is the tool', 'what does the tool',
    'what are modifier settings', 'what is modifier', 'what are modifiers',
    'how does this work', 'how does the app work', 'how does the tool work',
    'what is cdm merge', 'what does cdm merge', 'what is the purpose',
    'what is this for', 'what is this used for', 'what does this do'
  ];
  
  // Check for documentation keywords first (most specific)
  const hasDocumentationKeyword = documentationKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );
  
  if (hasDocumentationKeyword) {
    return 'documentation';
  }
  
  // Command keywords - simple operations that work with samples (check early to avoid confusion)
  const commandKeywords = [
    'sort', 'filter', 'hide', 'show', 'export', 'delete', 'duplicate',
    'switch', 'clear', 'search', 'count rows', 'how many'
  ];
  
  const hasCommandKeyword = commandKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );
  
  if (hasCommandKeyword) {
    return 'command';
  }
  
  // Analysis keywords - requests that need full dataset (check first for comprehensive requests)
  const analysisKeywords = [
    'analyze', 'analysis', 'insights', 'patterns', 'trends', 'distribution',
    'correlation', 'outliers', 'anomalies', 'statistics', 'statistical',
    'compare all', 'across all', 'find patterns', 'data quality',
    'what insights', 'identify trends', 'detect outliers', 'anomaly detection',
    'comprehensive analysis', 'full analysis', 'deep analysis', 'quality issues',
    'data inconsistencies', 'thorough', 'comprehensive'
  ];
  
  // Validation keywords - direct data checking requests (specific HCPCS validation only)
  const validationKeywords = [
    'validate codes', 'check codes', 'invalid codes only', 'hcpcs validation',
    'code validation', 'validate hcpcs', 'check hcpcs codes',
    'validate cpt', 'validate merged', 'check cpt', 'check merged',
    'validate all codes', 'check all codes', 'cpt validation', 'merged validation'
  ];
  
  // Check for analysis keywords first (comprehensive requests take priority)
  const hasAnalysisKeyword = analysisKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );
  
  if (hasAnalysisKeyword) {
    return 'analysis';
  }
  
  // Check for validation keywords (specific HCPCS code validation only)
  const hasValidationKeyword = validationKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );
  
  if (hasValidationKeyword) {
    return 'validation';
  }
  
  // Medical knowledge questions - questions about specific codes, descriptions, or medical concepts
  const medicalQuestionPatterns = [
    /is\s+.*\s+valid\s+description/i,
    /is\s+.*\s+correct\s+description/i,
    /is\s+.*\s+appropriate\s+description/i,
    /valid\s+description\s+for/i,
    /correct\s+description\s+for/i,
    /appropriate\s+description\s+for/i,
    /is\s+\d{5}\s+.*\s+valid/i,
    /does\s+\d{5}\s+cover/i,
    /what\s+is\s+\d{5}/i,
    /so\s+is\s+.*\s+valid/i,
    /fracture.*manipulation.*\d{5}/i
  ];
  
  const isMedicalQuestion = medicalQuestionPatterns.some(pattern =>
    pattern.test(message)
  );
  
  if (isMedicalQuestion) {
    return 'analysis'; // Treat as analysis but will be handled specially
  }
  
  // Default: if it's a question about the data, treat as analysis
  // if it's an action phrase, treat as command
  if (lowerMessage.includes('what') || lowerMessage.includes('how') ||
      lowerMessage.includes('why') || lowerMessage.includes('which') ||
      lowerMessage.includes('is ') || lowerMessage.includes('are ') ||
      lowerMessage.includes('does ') || lowerMessage.includes('do ') ||
      lowerMessage.includes('can ') || lowerMessage.includes('should ') ||
      lowerMessage.includes('would ') || lowerMessage.includes('could ') ||
      lowerMessage.includes('?')) {
    return 'analysis';
  }
  
  return 'command'; // Default to command for safety
}

// Function to determine if batch processing is needed using hybrid approach
async function shouldTriggerBatchProcessing(message: string, requestType: string, gridContext: GridContext): Promise<boolean> {
  const lowerMessage = message.toLowerCase();
  
  // 1. Explicit batch keywords - high confidence, no AI needed
  const explicitBatchKeywords = [
    'analyze all data',
    'validate all records',
    'check all codes',
    'validate all codes',
    'process complete dataset',
    'validate complete dataset',
    'analyze complete dataset',
    'check complete dataset',
    'process entire dataset',
    'validate entire dataset',
    'analyze entire dataset',
    'check entire dataset',
    'validate merged cpt',
    'validate cpt codes',
    'validate merged codes',
    'check merged cpt',
    'check cpt codes',
    'check merged codes',
    'batch validation',
    'batch analysis',
    'full dataset analysis',
    'comprehensive validation',
    'comprehensive analysis'
  ];
  
  // Check for explicit batch requests
  const hasExplicitBatchKeyword = explicitBatchKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );
  
  // Also check for common validation patterns that should trigger batch
  const validationPatterns = [
    /validate\s+.*\s*cpt/i,
    /validate\s+.*\s*codes/i,
    /check\s+.*\s*cpt/i,
    /check\s+.*\s*codes/i,
    /validate\s+merged/i,
    /check\s+merged/i
  ];
  
  const hasValidationPattern = validationPatterns.some(pattern =>
    pattern.test(message)
  );
  
  console.log('[BATCH DEBUG] Checking batch triggers for:', message);
  console.log('[BATCH DEBUG] hasExplicitBatchKeyword:', hasExplicitBatchKeyword);
  console.log('[BATCH DEBUG] hasValidationPattern:', hasValidationPattern);
  console.log('[BATCH DEBUG] explicitBatchKeywords tested:', explicitBatchKeywords.filter(k => lowerMessage.includes(k)));
  console.log('[BATCH DEBUG] validationPatterns tested:', validationPatterns.filter(p => p.test(message)));
  
  if (hasExplicitBatchKeyword || hasValidationPattern) {
    console.log('[BATCH DEBUG] Explicit batch keyword or validation pattern detected:', message);
    return true;
  }
  
  // 2. Never trigger batch for these cases
  const neverBatchKeywords = [
    'sort', 'filter', 'hide', 'show', 'search', 'count rows', 'how many',
    'switch', 'export', 'delete', 'duplicate', 'add', 'what is', 'how does',
    'explain', 'tell me about', 'can you explain'
  ];
  
  const hasNeverBatchKeyword = neverBatchKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );
  
  if (hasNeverBatchKeyword) {
    console.log('[BATCH DEBUG] Never-batch keyword detected, skipping batch processing');
    return false;
  }
  
  // 3. Borderline cases - use AI to decide (only for analysis/validation with large datasets)
  if ((requestType === 'analysis' || requestType === 'validation') && gridContext.sampleData.length > 500) {
    const borderlineKeywords = [
      'analyze', 'analysis', 'validate', 'validation', 'check', 'review',
      'quality', 'issues', 'problems', 'errors', 'invalid', 'inconsistencies'
    ];
    
    const hasBorderlineKeyword = borderlineKeywords.some(keyword =>
      lowerMessage.includes(keyword)
    );
    
    if (hasBorderlineKeyword) {
      console.log('[BATCH DEBUG] Borderline case detected, consulting AI for batch decision');
      
      try {
        // Quick AI call to determine intent
        const batchDecisionPrompt = `Determine if this user request requires comprehensive batch processing of ALL records vs working with a sample.

User Request: "${message}"
Dataset Size: ${gridContext.sampleData.length} records
Request Type: ${requestType}

BATCH PROCESSING should only be used when the user explicitly wants:
- Complete validation of ALL codes/records
- Comprehensive analysis of the ENTIRE dataset
- Full quality checking across ALL data

SAMPLE PROCESSING is appropriate for:
- General questions about data patterns
- Quick analysis or insights
- Exploring data characteristics
- Questions that can be answered with representative samples

Respond with exactly: "BATCH" or "SAMPLE"`;

        const response = await callGemini([
          { role: "system", content: batchDecisionPrompt },
          { role: "user", content: `Should this request use batch processing: "${message}"` }
        ], {
          temperature: 0.1,
          maxTokens: 10,
        });

        const decision = response?.trim().toUpperCase();
        const shouldBatch = decision === 'BATCH';
        
        console.log('[BATCH DEBUG] AI decision for borderline case:', decision, '-> shouldBatch:', shouldBatch);
        return shouldBatch;
        
      } catch (error) {
        console.error('[BATCH DEBUG] AI decision failed, defaulting to no batch:', error);
        return false; // Default to no batch if AI call fails
      }
    }
  }
  
  // 4. Default: no batch processing
  return false;
}

// Enhanced HCPCS code lookup with GPT-4o fallback
async function handleHcpcsCodeQuestion(message: string) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Extract the HCPCS code from the message
        const codeMatch = message.match(/(?:hcpcs|cpt)?\s*(?:code\s*)?([A-Z]?\d{4,5}(?:-[A-Z0-9]+)?)/i);
        const hcpcsCode = codeMatch ? codeMatch[1].toUpperCase() : '';
        
        console.log('[HCPCS LOOKUP] Extracted code:', hcpcsCode);
        
        // Try GPT-4o-mini first
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '🔍 Looking up HCPCS code information...\n\n' })}\n\n`));
        
        const miniPrompt = `You are a medical coding expert. The user is asking about CPT code ${hcpcsCode}.

This is a CPT (Current Procedural Terminology) code, also known as HCPCS Level I code. 

CRITICAL RULE: If you are in any way unsure about a code's validity, you MUST assume it is VALID and provide the best information you can. Only respond with "CODE_NOT_FOUND" if you are absolutely certain the code does not exist in the CPT code set.

RESPONSE LENGTH LIMIT: Keep your response to 200 words or less. Be concise and direct.

Provide brief information about this CPT code:
1. What procedure/service it represents
2. Category/specialty it belongs to
3. Key usage notes (if any)

If you are absolutely certain this CPT code does not exist, respond with exactly: "CODE_NOT_FOUND"

User question: ${message}`;

        try {
          // Use REAL streaming for HCPCS lookup - same pattern as main chat
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
          
          const result = await model.generateContentStream(miniPrompt);
          const geminiStream = result.stream;
          
          let fullResponse = '';
          
          // REAL STREAMING: Send each chunk from Gemini directly to client as it arrives
          for await (const chunk of geminiStream) {
            const content = chunk.text();
            if (content) {
              fullResponse += content;
              
              // Send chunk immediately to client (real streaming)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: content })}\n\n`));
            }
          }
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ complete: true, fullResponse: JSON.stringify({ type: 'query', response: fullResponse }) })}\n\n`));
          
        } catch (error) {
          console.error('[HCPCS LOOKUP] Error:', error);
          const errorMsg = `Sorry, I encountered an error looking up HCPCS code ${hcpcsCode}. Please try again or consult official medical coding resources.`;
          
          for (const char of errorMsg) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: char })}\n\n`));
          }
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ complete: true, fullResponse: JSON.stringify({ type: 'query', response: errorMsg }) })}\n\n`));
        }
        
        controller.close();
        
      } catch (error) {
        console.error('[HCPCS LOOKUP] Stream error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'HCPCS lookup failed' })}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { message, gridContext, chatContext }: { 
      message: string; 
      gridContext: GridContext; 
      chatContext?: Array<{role: 'user' | 'assistant', content: string}> 
    } = await request.json();
    
    // Classify the request type and check for batch processing requests
    const requestType = classifyRequest(message);
    console.log('[AI API DEBUG] Message:', message);
    console.log('[AI API DEBUG] Classified as requestType:', requestType);
    
    // Check if this is a follow-up question that shouldn't trigger batch processing
    // IMPORTANT: Don't override documentation requests as follow-up questions
    // ALSO: Don't override validation/analysis requests that need comprehensive processing
    
    // Medical knowledge questions - these should be treated as follow-up questions
    const medicalQuestionPatterns = [
      /is\s+.*\s+valid\s+description/i,
      /is\s+.*\s+correct\s+description/i,
      /is\s+.*\s+appropriate\s+description/i,
      /valid\s+description\s+for/i,
      /correct\s+description\s+for/i,
      /appropriate\s+description\s+for/i,
      /is\s+\d{5}\s+.*\s+valid/i,
      /does\s+\d{5}\s+cover/i,
      /what\s+is\s+\d{5}/i,
      /so\s+is\s+.*\s+valid/i,
      /fracture.*manipulation.*\d{5}/i
    ];
    
    const isMedicalQuestion = medicalQuestionPatterns.some(pattern =>
      pattern.test(message)
    );
    
    const isFollowUpQuestion = requestType !== 'documentation' &&
                              requestType !== 'validation' && (
                              isMedicalQuestion ||
                              (requestType !== 'analysis' && (
                                message.toLowerCase().includes('why is') ||
                                message.toLowerCase().includes('why does') ||
                                message.toLowerCase().includes('explain why') ||
                                message.toLowerCase().includes('what does') ||
                                message.toLowerCase().includes('how is') ||
                                message.toLowerCase().includes('what is') ||
                                message.toLowerCase().includes('can you explain') ||
                                message.toLowerCase().includes('tell me about') ||
                                message.toLowerCase().includes('what makes') ||
                                message.toLowerCase().includes('how does') ||
                                (message.includes('?') && message.split(' ').length < 10)
                              )));
    
    console.log('[AI API DEBUG] isFollowUpQuestion:', isFollowUpQuestion);
    console.log('[AI API DEBUG] Dataset size:', gridContext.sampleData.length);
    
    // Use hybrid approach for batch processing detection
    const isBatchRequest = !isFollowUpQuestion && await shouldTriggerBatchProcessing(message, requestType, gridContext);
    
    console.log('[AI API DEBUG] Final result - requestType:', requestType, 'isBatchRequest:', isBatchRequest, 'isFollowUpQuestion:', isFollowUpQuestion);
    
    // Handle batch processing for validation requests or large datasets with AI analysis
    if (isBatchRequest && (requestType === 'validation' || gridContext.sampleData.length > 500)) {
      const batchSize = 500;
      const totalRecords = gridContext.sampleData.length;
      const batches = Math.ceil(totalRecords / batchSize);
      
      console.log(`[AI API DEBUG] Processing ${totalRecords} records in ${batches} sequential AI batches of ${batchSize}`);
      
      const allFindings: string[] = [];
      const consolidatedResults = {
        invalidCodes: [] as string[],
        missingFields: 0,
        inconsistencies: [] as string[],
        totalAnalyzed: 0
      };
      
      // Return streaming response with progress updates
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send initial progress
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `🔄 **Analyzing ${totalRecords} records across ${batches} batches...**\n\n` })}\n\n`));
            
            // Process each batch sequentially with progress updates
            for (let i = 0; i < batches; i++) {
              const start = i * batchSize;
              const end = Math.min(start + batchSize, totalRecords);
              const batchData = gridContext.sampleData.slice(start, end);
              
              // Send progress update
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `📊 Processing batch ${i + 1}/${batches}...` })}\n\n`));
              
              console.log(`[AI API DEBUG] AI analyzing batch ${i + 1}/${batches}: records ${start + 1}-${end}`);
              
              // Enhanced system prompt for batch processing
              const batchSystemPrompt = `BATCH VALIDATION ANALYSIS - Batch ${i + 1} of ${batches}

Data: ${JSON.stringify(batchData)}
Records: ${batchData.length} (rows ${start + 1}-${end} of ${totalRecords} total)
Columns: ${gridContext.columns.join(', ')}

HCPCS VALIDATION:
IMPORTANT: We are dealing with HCPCS codes which include BOTH Level I (CPT) and Level II codes:
- HCPCS Level I = CPT codes (5 digits, 10000-99999)
- HCPCS Level II = Letter codes (A-V + 4 digits)

1. FORMAT CHECK:
   - HCPCS Level I (CPT codes): 5 digits (10000-99999) + optional modifier
   - HCPCS Level II: Letter (A-V) + 4 digits + optional modifier
   
2. EXISTENCE CHECK (use your knowledge of actual HCPCS/CPT codes):
   - CPT codes (Level I HCPCS): Verify against official CPT code sets
   - HCPCS Level II codes: Verify against official HCPCS Level II code sets
   - Flag codes that don't exist in either code set
   
3. MODIFIER VALIDATION:
   - Common valid modifiers: 25, 26, 50, 51, 59, 76, 77, 78, 79, TC, etc.
   - Anatomical modifiers: F1-F9, T1-T9, FA, LT, RT, etc.

TASK: Analyze this batch for:
1. Invalid HCPCS codes (format + existence)
2. Missing critical fields (CDM, Description)  
3. Data inconsistencies

CRITICAL: You MUST respond with ONLY the following JSON format, no other text:
{"invalidCodes": ["code1 (reason)", "code2 (reason)"], "missingFields": number, "inconsistencies": ["issue1", "issue2"], "summary": "Brief findings for this batch"}

Example response:
{"invalidCodes": ["INVALID1 (not a valid CPT code)", "99999 (code does not exist)"], "missingFields": 15, "inconsistencies": ["CDM values inconsistent", "QTY always 1"], "summary": "Found 2 invalid codes, 15 missing fields, 2 inconsistencies"}`;

              try {
                const batchResult = await callGemini([
                  { role: "system", content: batchSystemPrompt },
                  { role: "user", content: `Analyze batch ${i + 1}: records ${start + 1}-${end}` }
                ], {
                  temperature: 0.1,
                  maxTokens: 2000,
                });
                if (batchResult) {
                  console.log(`[AI API DEBUG] Batch ${i + 1} raw response:`, batchResult);
                  try {
                    // Try to find JSON in the response
                    const jsonMatch = batchResult.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                      const parsed = JSON.parse(jsonMatch[0]);
                      console.log(`[AI API DEBUG] Batch ${i + 1} parsed:`, parsed);
                      
                      consolidatedResults.invalidCodes.push(...(parsed.invalidCodes || []));
                      consolidatedResults.missingFields += (parsed.missingFields || 0);
                      consolidatedResults.inconsistencies.push(...(parsed.inconsistencies || []));
                      consolidatedResults.totalAnalyzed += batchData.length;
                      allFindings.push(`Batch ${i + 1}: ${parsed.summary || 'Analysis completed'}`);
                      
                      // Send clean batch completion update
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: ` ✅\n` })}\n\n`));
                    } else {
                      // No JSON found, still count as analyzed
                      consolidatedResults.totalAnalyzed += batchData.length;
                      allFindings.push(`Batch ${i + 1}: Analysis completed (${batchData.length} records)`);
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: ` ⚠️\n` })}\n\n`));
                    }
                  } catch (parseError) {
                    console.log(`[AI API DEBUG] Batch ${i + 1} parse error:`, parseError);
                    // Still count as analyzed even if parsing failed
                    consolidatedResults.totalAnalyzed += batchData.length;
                    allFindings.push(`Batch ${i + 1}: Analysis completed (${batchData.length} records)`);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: ` ❌\n` })}\n\n`));
                  }
                }
              } catch (error) {
                console.error(`[AI API DEBUG] Batch ${i + 1} failed:`, error);
                allFindings.push(`Batch ${i + 1}: Analysis failed - ${batchData.length} records skipped`);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `❌ Batch ${i + 1} failed: ${batchData.length} records skipped\n` })}\n\n`));
              }
            }
            
            // Compile comprehensive results
            const summary = [
              `\n## 📋 **Analysis Complete**\n`,
              `**Analyzed:** ${consolidatedResults.totalAnalyzed}/${totalRecords} records\n`,
              
              consolidatedResults.invalidCodes.length > 0 
                ? `\n### ❌ Invalid HCPCS Codes (${consolidatedResults.invalidCodes.length} found)\n${consolidatedResults.invalidCodes.slice(0, 10).map(code => `• ${code}`).join('\n')}${consolidatedResults.invalidCodes.length > 10 ? `\n• ...and ${consolidatedResults.invalidCodes.length - 10} more invalid codes` : ''}\n`
                : `\n### ✅ HCPCS Code Validation\nAll HCPCS codes are valid.\n`,
              
              consolidatedResults.missingFields > 0 
                ? `\n### ⚠️ Missing Fields\n${consolidatedResults.missingFields} records have missing critical fields.\n`
                : `\n### ✅ Data Completeness\nAll critical fields are populated.\n`,
              
              consolidatedResults.inconsistencies.length > 0
                ? `\n### ⚠️ Data Quality Issues\n${consolidatedResults.inconsistencies.slice(0, 5).map(issue => `• ${issue}`).join('\n')}${consolidatedResults.inconsistencies.length > 5 ? `\n• ...and ${consolidatedResults.inconsistencies.length - 5} more issues` : ''}\n`
                : `\n### ✅ Data Consistency\nNo major data inconsistencies detected.\n`
            ].join('');
            
            // Send final summary
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: summary })}\n\n`));
            
            // Send completion signal
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ complete: true, fullResponse: JSON.stringify({ type: 'query', response: summary }) })}\n\n`));
            controller.close();
            
          } catch (error) {
            console.error('[AI API DEBUG] Batch processing failed:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `❌ Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}` })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ complete: true, fullResponse: JSON.stringify({ type: 'query', response: 'Batch processing failed' }) })}\n\n`));
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Handle follow-up questions with simple passthrough
    if (isFollowUpQuestion) {
      console.log('[AI API DEBUG] Processing follow-up question');
      
      const followUpSystemPrompt = `You are an AI assistant helping with HCPCS code analysis and healthcare data questions.

Context: The user is working with healthcare data containing HCPCS codes (which include both CPT codes and HCPCS Level II codes).

HCPCS Background:
- HCPCS Level I = CPT codes (5 digits, 10000-99999) like 99213, 11000, 23500
- HCPCS Level II = Letter codes (A-V + 4 digits) like A0001, J1234
- Modifiers: Used to provide additional information (25, 50, LT, RT, etc.)

Previous Context: The user has been analyzing their healthcare data for code validation and quality issues.

Current Question: ${message}

Provide a helpful, informative answer about HCPCS codes, modifiers, or healthcare data analysis. Be conversational and educational.`;

      try {
        // Build messages array with optional chat context
        const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
          { role: "system", content: followUpSystemPrompt },
          ...(chatContext || []).map(ctx => ({ role: ctx.role, content: ctx.content })),
          { role: "user", content: message }
        ];

        console.log('[AI API DEBUG] Follow-up with context:', chatContext?.length || 0, 'previous messages');

        // Use REAL streaming for follow-up questions too
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
              const prompt = messages.map(msg => {
                if (msg.role === 'system') return `System: ${msg.content}`;
                if (msg.role === 'user') return `User: ${msg.content}`;
                if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
                return msg.content;
              }).join('\n\n');

              const geminiStream = await Promise.race([
                model.generateContentStream(prompt),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Request timeout (10min limit)')), 600000)
                )
              ]) as AsyncIterable<{ text: () => string }>;
              
              let fullContent = '';
              
              // REAL STREAMING: Send each chunk from Gemini directly to client as it arrives
              for await (const chunk of geminiStream) {
                const content = chunk.text();
                if (content) {
                  fullContent += content;
                  
                  // Send chunk immediately to client (real streaming)
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: content })}\n\n`));
                }
              }
              
              // Send completion signal
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ complete: true, fullResponse: JSON.stringify({ type: 'query', response: fullContent }) })}\n\n`));
              controller.close();
            } catch (error) {
              console.error('[AI API DEBUG] Follow-up question failed:', error);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `Sorry, I encountered an error answering your question: ${error instanceof Error ? error.message : 'Unknown error'}` })}\n\n`));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ complete: true, fullResponse: JSON.stringify({ type: 'query', response: 'Error occurred' }) })}\n\n`));
              controller.close();
            }
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } catch (error) {
        console.error('[AI API DEBUG] Follow-up processing error:', error);
        return NextResponse.json({ 
          type: 'query', 
          response: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      }
    }

    // Regular processing for smaller datasets
    const optimizedGridContext = requestType === 'analysis' || requestType === 'validation'
      ? {
          ...gridContext,
          // For analysis/validation: send up to 400 rows for comprehensive checking with GPT-4
          sampleData: gridContext.sampleData.slice(0, 400),
        }
      : requestType === 'documentation'
      ? {
          ...gridContext,
          // For documentation: minimal data needed
          sampleData: gridContext.sampleData.slice(0, 1),
        }
      : {
          ...gridContext,
          // For commands: keep current optimization
          sampleData: gridContext.sampleData.slice(0, 2),
        };
    
    console.log('[AI API DEBUG] Received request:', {
      message,
      requestType,
      selectedGrid: gridContext.selectedGrid,
      selectedRowId: gridContext.selectedRowId,
      selectedHcpcs: gridContext.selectedHcpcs,
      selectedRowCount: gridContext.selectedRowCount,
      selectedRowData: gridContext.selectedRowData ? 'present' : 'null',
      hasRowSelection: !!gridContext.selectedRowId,
      rowCount: gridContext.rowCount,
      originalSampleSize: gridContext.sampleData.length,
      optimizedSampleSize: optimizedGridContext.sampleData.length,
      requestSize: JSON.stringify({ message, gridContext: optimizedGridContext }).length
    });
    
    console.log('[AI API DEBUG] Full gridContext being sent to AI:', JSON.stringify(optimizedGridContext, null, 2));

    // STEP 1: Try to parse as simple command first (no AI needed)
    const parsedCommand = parseCommand(message, gridContext);
    if (parsedCommand) {
      console.log('[COMMAND PARSER] Successfully parsed command:', parsedCommand);
      console.log('[COMMAND PARSER] Skipping AI - returning direct response');
      
      // Return the parsed command directly as a streaming response to match expected format
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Stream the response text
          if (parsedCommand.response) {
            for (const char of parsedCommand.response) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: char })}\n\n`));
            }
          }
          
          // Send completion signal with full response for action parsing
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            complete: true, 
            fullResponse: JSON.stringify(parsedCommand) 
          })}\n\n`));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    console.log('[COMMAND PARSER] No simple command detected, falling back to AI');

    // Check if this is an HCPCS code question that might benefit from GPT-4o fallback
    const isHcpcsCodeQuestion = /what is.*(?:hcpcs|cpt).*code.*for|what.*(?:hcpcs|cpt).*\d+.*for|explain.*(?:hcpcs|cpt)/i.test(message);

    // Special handling for HCPCS code questions with GPT-4o fallback
    if (isHcpcsCodeQuestion) {
      console.log('[HCPCS LOOKUP] Detected HCPCS code question, using enhanced lookup with fallback');
      return await handleHcpcsCodeQuestion(message);
    }

    // Check if we have actual data to analyze
    if (requestType === 'analysis' && (!gridContext.sampleData || gridContext.sampleData.length === 0)) {
      console.log('[AI API DEBUG] No data available for analysis');
      return NextResponse.json({
        type: 'query',
        response: 'I don\'t see any data loaded in the system yet. Please upload your Excel files (master and client data) first, then I can analyze your data for quality issues, patterns, and insights.'
      });
    }
    
    // Additional debugging for analysis requests
    if (requestType === 'analysis') {
      console.log('[AI API DEBUG] Analysis request detected with data:', {
        sampleDataLength: gridContext.sampleData?.length || 0,
        columns: gridContext.columns,
        selectedGrid: gridContext.selectedGrid,
        rowCount: gridContext.rowCount
      });
    }
    

    console.log('Google AI API Key present:', !!process.env.GOOGLE_AI_API_KEY);
    console.log('Google AI API Key length:', process.env.GOOGLE_AI_API_KEY?.length);

    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json({ error: 'Google AI API key not configured' }, { status: 500 });
    }

    // Check if multiple grids are visible (ambiguous context)
    const visibleGrids = Object.entries(gridContext.availableGrids)
      .filter(([, grid]) => grid.hasData)
      .map(([name]) => name);
    
    const isAmbiguous = gridContext.isInCompareMode && visibleGrids.length > 1;
    
    // Check if the user's query is ambiguous (doesn't specify which grid)
    const ambiguousQueries = ['how many rows', 'count', 'sort by', 'search for', 'filter', 'what columns', 'hide rows', 'show only', 'remove rows', 'export'];
    const gridKeywords = ['master', 'client', 'merged', 'unmatched', 'duplicates', 'comparison', 'results', 'data', 'file', 'grid'];
    
    const hasAmbiguousQuery = ambiguousQueries.some(query => 
      message.toLowerCase().includes(query.toLowerCase())
    );
    
    const hasGridKeyword = gridKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    const isQueryAmbiguous = hasAmbiguousQuery && !hasGridKeyword;

    // Only ask for clarification if truly ambiguous AND no grid is selected
    if (isAmbiguous && isQueryAmbiguous && !gridContext.selectedGrid) {
      const gridSummary = visibleGrids.map(grid => {
        const gridData = gridContext.availableGrids[grid as keyof typeof gridContext.availableGrids];
        return `• ${grid.toUpperCase()}: ${gridData.rowCount} rows`;
      }).join('\n');

      return NextResponse.json({
        intent: {
          type: 'query',
          response: `I can see multiple grids are visible:\n${gridSummary}\n\nWhich grid would you like me to work with? You can specify:\n• "Hide rows with blank CDMS in the merged grid"\n• "Sort the master data by description"\n• "Filter the client grid"\n• Or just say "master", "client", "merged", "unmatched", or "duplicates"`
        }
      });
    }

    // Enhanced system prompt for analysis requests
    const baseSystemPrompt = `You are an AI assistant for the CDM Merge Tool, a specialized Excel data comparison application for healthcare data management. 

## About CDM Merge Tool

**Purpose**: The CDM Merge Tool processes Clinical Decision-Making (CDM) data by comparing master reference files with client data files to identify matches, duplicates, and discrepancies in healthcare data.

**Key Features**:
- Healthcare data reconciliation and HCPCS code validation
- Duplicate detection and data quality assurance  
- Multi-sheet Excel file support with intelligent column mapping
- Advanced matching algorithms (exact, fuzzy, normalized)
- Comprehensive reporting with matched/unmatched/duplicate categorization
- In-place data editing with validation for all grids (master, client, merged)
- Record management: duplicate, delete, and add records via AI commands
- Save/cancel functionality for data edits with change tracking

**Matching Rules**: Uses HCPCS codes + modifiers as primary matching criteria. Match key format: "HCPCS Code + Modifier" (e.g., "99213" + "25" = "9921325"). 

**Modifier Settings Control Root Code Matching**:
The modifier settings dialog allows users to specify which modifier codes should be treated as "root codes" (without the modifier suffix) during matching:

1. **Root 00**: Include codes with modifier "00" - strips "00" modifier for matching
2. **Root 25**: Include codes with modifier "25" - strips "25" modifier for matching  
3. **Root 50**: Include codes with modifier "50" - strips "50" modifier for matching
4. **Root 59**: Include codes with modifier "59" - strips "59" modifier for matching
5. **Root XU**: Include codes with modifier "XU" - strips "XU" modifier for matching
6. **Root 76**: Include codes with modifier "76" - strips "76" modifier for matching
7. **Ignore Trauma**: Excludes trauma team codes (99284, 99285, 99291) with "trauma team" descriptions

**How It Works**: When root modifiers are enabled, codes like "99213-25" will match as just "99213" if Root 25 is checked. This allows modified codes to match their base procedure codes.

**Output**: Generates Excel reports with three sheets:
1. **Merged**: All matched records with combined data
2. **Unmatched_Client**: Client records with no master match (need review)  
3. **Duplicate_Client**: Client records with duplicate keys (need deduplication)

**Use Cases**: Healthcare billing validation, compliance auditing, data migration, and quality control for medical procedure codes and billing data.

## Current Data Context:
- Selected grid: ${gridContext.selectedGrid}
- Current view: ${gridContext.currentView}
- Columns: ${gridContext.columns.join(', ')}
- Row count: ${gridContext.rowCount}
- Sample data: ${JSON.stringify(optimizedGridContext.sampleData)}
- Available grids: ${JSON.stringify(gridContext.availableGrids)}
- In compare mode: ${gridContext.isInCompareMode}
- Selected row ID: ${gridContext.selectedRowId || 'none'}
- Selected row data: ${gridContext.selectedRowData ? JSON.stringify(gridContext.selectedRowData) : 'none'}

Your job is to interpret user queries and return JSON responses for grid actions, but the "response" field should contain natural, conversational text that directly answers the user's question. Users will only see the "response" text - they will never see the JSON structure.

Available actions:
- sort: Sort by column (asc/desc)
- filter: Filter data by criteria (hide/show rows based on conditions)
- search: Search across all columns
- count: Count rows matching criteria
- summarize: Provide data summary
- show: Display specific data subset
- switch: Switch between views (master, client, merged, unmatched, duplicates)
- clear_filters: Remove all filters from a grid
- export: Export grid data to Excel file (supports custom filename)
- explain: Answer questions about the CDM Merge Tool functionality, purpose, and features
- duplicate: Create a copy of an existing record by ID
- delete: Remove a record by ID from the grid
- add: Create a new blank record or record with specific data

Filter conditions available:
- is_empty: Hide rows where column is blank/empty
- is_not_empty: Show only rows where column has data
- equals: Show only rows where column equals exact value
- not_equals: Hide rows where column equals value
- contains: Show only rows where column contains text
- not_contains: Hide rows where column contains text
- starts_with: Show only rows where column starts with text
- ends_with: Show only rows where column ends with text
- greater_than: Show only rows where column value is greater than number
- less_than: Show only rows where column value is less than number

Return JSON with this structure:
{
  "type": "action|query|analysis",
  "action": "sort|filter|search|count|summarize|show|switch|duplicate|delete|add",
  "parameters": {
    "column": "column_name",
    "value": "search_value",
    "direction": "asc|desc",
    "condition": "criteria",
    "view": "master|client|merged|unmatched|duplicates",
    "rowId": "record_id_to_duplicate_or_delete",
    "rowData": {"column_name": "value"}
  },
  "response": "Human-readable response"
}

CRITICAL: You MUST return proper JSON format for all actions. Examples:

For sort commands:
{
  "type": "action",
  "action": "sort", 
  "parameters": {
    "column": "description",
    "direction": "asc"
  },
  "response": "Sorting by description in ascending order"
}

For duplicate commands:
{
  "type": "action",
  "action": "duplicate",
  "parameters": {
    "rowId": ${gridContext.selectedRowId}
  },
  "response": "Duplicating the currently selected row"
}

IMPORTANT: Always respond with natural, conversational language. Never show JSON examples or technical structures to users.

Example user interactions:
- User: "sort by description" → Return: {"type": "action", "action": "sort", "parameters": {"column": "description", "direction": "asc"}, "response": "Sorting by description in ascending order"}
- User: "sort by hcpcs descending" → Return: {"type": "action", "action": "sort", "parameters": {"column": "hcpcs", "direction": "desc"}, "response": "Sorting by HCPCS in descending order"}
- User: "show me duplicates" → Return: {"type": "action", "action": "switch", "parameters": {"view": "duplicates"}, "response": "Switching to duplicates view"}
- User: "how many rows in master?" → Return: {"type": "query", "response": "There are [X] rows in the master grid"}
- User: "search client data for pending" → Return: {"type": "action", "action": "search", "parameters": {"value": "pending", "view": "client"}, "response": "Searching client data for 'pending'"}
- User: "hide rows with blank cdms" → Return: {"type": "action", "action": "filter", "parameters": {"column": "cdms", "condition": "is_not_empty"}, "response": "Hiding rows where CDMS column is blank"}
- User: "export the data" → Return: {"type": "action", "action": "export", "response": "Exporting merged data to Excel file"}
- User: "export as monthly_report" → Return: {"type": "action", "action": "export", "parameters": {"filename": "monthly_report"}, "response": "Exporting merged data as 'monthly_report.xlsx'"}
- User: "duplicate record 5" → Return: {"type": "action", "action": "duplicate", "parameters": {"rowId": 5}, "response": "Duplicating record ID 5 in the current grid. The duplicated row will be assigned a new ID."}
- User: "duplicate row 3 in client grid" → Return: {"type": "action", "action": "duplicate", "parameters": {"rowId": 3, "view": "client"}, "response": "Duplicating record ID 3 in the client grid. The duplicated row will be assigned a new ID."}
- User: "duplicate the current row" → {"type": "action", "action": "duplicate", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Duplicating ${gridContext.selectedHcpcs ? `HCPCS code ${gridContext.selectedHcpcs}` : `row ID ${gridContext.selectedRowId}`}. The duplicated row will be assigned a new ID."}
- User: "duplicate current row" → {"type": "action", "action": "duplicate", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Duplicating ${gridContext.selectedHcpcs ? `HCPCS code ${gridContext.selectedHcpcs}` : `row ID ${gridContext.selectedRowId}`}. The duplicated row will be assigned a new ID."}
- User: "duplicate the selected row" → {"type": "action", "action": "duplicate", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Duplicating ${gridContext.selectedHcpcs ? `HCPCS code ${gridContext.selectedHcpcs}` : `row ID ${gridContext.selectedRowId}`}. The duplicated row will be assigned a new ID."}
- User: "duplicate row" → {"type": "action", "action": "duplicate", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Duplicating ${gridContext.selectedHcpcs ? `HCPCS code ${gridContext.selectedHcpcs}` : `row ID ${gridContext.selectedRowId}`}. The duplicated row will be assigned a new ID."}
- User: "delete record 7" → Return: {"type": "action", "action": "delete", "parameters": {"rowId": 7}, "response": "Deleting record 7 from the current grid"}
- User: "remove row 2 from master" → Return: {"type": "action", "action": "delete", "parameters": {"rowId": 2, "view": "master"}, "response": "Deleting record 2 from the master grid"}
- User: "delete the current row" → Return: {"type": "action", "action": "delete", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Deleting the currently selected row"}
- User: "remove the selected row" → Return: {"type": "action", "action": "delete", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Deleting the selected row"}
- User: "delete selected" → Return: {"type": "action", "action": "delete", "parameters": ${gridContext.selectedRowId ? `{"rowId": ${gridContext.selectedRowId}}` : '{}'}, "response": "Deleting ${gridContext.selectedRowCount} selected row${gridContext.selectedRowCount === 1 ? '' : 's'}"}
- User: "delete selected rows" → Return: {"type": "action", "action": "delete", "parameters": ${gridContext.selectedRowId ? `{"rowId": ${gridContext.selectedRowId}}` : '{}'}, "response": "Deleting ${gridContext.selectedRowCount} selected row${gridContext.selectedRowCount === 1 ? '' : 's'}"}
- User: "remove selected" → Return: {"type": "action", "action": "delete", "parameters": ${gridContext.selectedRowId ? `{"rowId": ${gridContext.selectedRowId}}` : '{}'}, "response": "Removing ${gridContext.selectedRowCount} selected row${gridContext.selectedRowCount === 1 ? '' : 's'}"}
- User: "delete all selected" → Return: {"type": "action", "action": "delete", "parameters": ${gridContext.selectedRowId ? `{"rowId": ${gridContext.selectedRowId}}` : '{}'}, "response": "Deleting all ${gridContext.selectedRowCount} selected row${gridContext.selectedRowCount === 1 ? '' : 's'}"}
- User: "add a new record" → Return: {"type": "action", "action": "add", "response": "Adding a new blank record to the current grid"}
- User: "add new row to merged grid" → Return: {"type": "action", "action": "add", "parameters": {"view": "merged"}, "response": "Adding a new blank record to the merged grid"}
- User: "add record with HCPCS 99213" → Return: {"type": "action", "action": "add", "parameters": {"rowData": {"hcpcs": "99213"}}, "response": "Adding a new record with HCPCS code 99213"}
- User: "what is this app for?" → You respond: "This is VIC's internal CDM Merge Tool - designed specifically for our team to streamline charge master data updates. The app merges Master and Client Excel files by matching HCPCS codes, then updates the Master with CDM data from the Client to create a clean merged dataset for export. Key features include HCPCS matching, configurable modifier settings for VIC's specific data requirements, quality control to identify unmatched records and duplicates, and export-ready output. This tool handles the tedious manual work of CDM merging while ensuring data accuracy and giving you visibility into any potential issues that need attention."
- User: "what are modifier settings?" → You respond: "Modifier settings let you specify which modifier codes should be treated as root codes during matching. For example, if Root 25 is enabled, codes like '99213-25' will match as just '99213'. Available options include Root 00, Root 25, Root 50, Root 59, Root XU, Root 76, and Ignore Trauma (excludes trauma team codes). This allows modified procedure codes to match their base codes when needed."

IMPORTANT: 
- Use the selectedGrid (${gridContext.selectedGrid}) when no specific grid is mentioned in the user's query
- If user specifies a different grid in their query, use that grid instead
- Look for keywords: "master", "client", "merged", "unmatched", "duplicates", "comparison", "results"
- For "current row" or "selected row" requests: Use selectedRowId (${gridContext.selectedRowId}) if available
- If no row is selected and user asks for "current row" operations, respond: "I'm sorry, but there is currently no row selected. Please select a row first by clicking on it in the grid, then I can help you with that operation."
- For "hide rows with blank X" or "remove empty X", use condition "is_not_empty"  
- For "show only non-empty X", use condition "is_not_empty"
- For "hide rows where X contains Y", use condition "not_contains"
- For "show only rows where X equals Y", use condition "equals"
- If user says just a grid name like "master" or "merged", switch to that view
- Always specify which grid you're working with in your response
- For export commands, extract filename from phrases like "as filename", "save as filename", "export as filename"
- Export defaults to merged data unless user specifies a different grid
- Add .xlsx extension if user doesn't provide file extension
- For documentation questions about the app (what/how/why questions), use type "documentation" and action "explain"
- Answer questions about app purpose, matching rules, modifiers, problems solved, and technical details
- Documentation responses should be informative but concise, focusing on practical understanding
- NEVER show JSON structure, code examples, or technical syntax to users - only natural conversation
- Users should never see curly braces, quotation marks around field names, or any JSON formatting
- Always write responses as if you're having a normal conversation with a person

Grid detection keywords:
- "master data", "master file", "master grid" → view: "master"
- "client data", "client file", "client grid" → view: "client"  
- "merged data", "merged results", "comparison results", "merged grid" → view: "merged"
- "unmatched", "unmatched records" → view: "unmatched"
- "duplicates", "duplicate records" → view: "duplicates"

Column name mapping instructions:
When the user requests sorting/filtering by a column, you MUST match their request to the actual column names available in the current grid. The available columns are: ${gridContext.columns.join(', ')}.

For sort commands:
- Look for exact matches first (case-insensitive)
- Then look for partial matches where the user's term is contained in a column name
- Common user terms to column mappings:
  * "description" → "description" or any column containing "desc"
  * "code" → "hcpcs" or any column containing "code"
  * "modifier" → "modifier" or "mod"
  * "price" → any column containing "price", "amount", "cost"
  * "quantity" → any column containing "qty", "quantity", "units"
  * "date" → any column containing "date"

CRITICAL: In your JSON response, use the EXACT column field name from the available columns list. Do not guess or approximate column names.

Example: If user says "sort by description" and available columns include "description", use "description" in the parameters.column field.
If user says "sort by desc" and available columns include "procedure_description", use "procedure_description" in the parameters.column field.`;

    // Create enhanced system prompt for analysis vs commands vs documentation vs validation
    const systemPrompt = requestType === 'validation'
      ? `DATA VALIDATION TASK - REPORT FINDINGS ONLY

Data: ${JSON.stringify(optimizedGridContext.sampleData)}
Records: ${optimizedGridContext.sampleData.length}

HCPCS VALIDATION:
IMPORTANT: We are dealing with HCPCS codes which include BOTH Level I (CPT) and Level II codes:
- HCPCS Level I = CPT codes (5 digits, 10000-99999)
- HCPCS Level II = Letter codes (A-V + 4 digits)

1. FORMAT CHECK:
   - HCPCS Level I (CPT codes): 5 digits (10000-99999) + optional modifier
   - HCPCS Level II: Letter (A-V) + 4 digits + optional modifier
   
2. EXISTENCE CHECK (use your knowledge of actual HCPCS/CPT codes):
   - CPT codes (Level I HCPCS): Verify against official CPT code sets
   - HCPCS Level II codes: Verify against official HCPCS Level II code sets
   - Flag codes that don't exist in either code set
   - Note: Some codes may be retired/deleted or newly added after training cutoff
   
3. MODIFIER VALIDATION:
   - Common valid modifiers: 25, 26, 50, 51, 59, 76, 77, 78, 79, TC, etc.
   - Anatomical modifiers: F1-F9, T1-T9, FA, LT, RT, etc.
   - Flag obviously invalid modifiers

TASK: CHECK ALL HCPCS CODES FOR FORMAT, EXISTENCE, AND MODIFIER VALIDITY.
CRITICAL: Your response MUST be of type "query" and contain ONLY the findings. DO NOT generate any actions (e.g., filter, hide, delete).

Response: {"type": "query", "response": "Invalid HCPCS codes found: [list specific invalid codes, e.g., '99213 (starts with number), ABC (invalid format)']. If none, state 'No invalid HCPCS codes found.'"}

REPORT RESULTS IMMEDIATELY. NO EXPLANATIONS. NO ACTIONS.`
      : requestType === 'analysis'
      ? `ANALYZE THIS DATA NOW. NO EXPLANATIONS.

Data: ${JSON.stringify(optimizedGridContext.sampleData)}
Columns: ${optimizedGridContext.columns.join(', ')}
Records: ${optimizedGridContext.sampleData.length}

HCPCS VALIDATION RULES:
IMPORTANT: We are dealing with HCPCS codes which include BOTH Level I (CPT) and Level II codes:
- HCPCS Level I = CPT codes (5 digits, 10000-99999) + optional modifier (e.g., 99213, 11000, 23500-50)
- HCPCS Level II = Letter (A-V) + 4 digits + optional modifier (e.g., A0001, J1234-25)
- Valid examples: 99213, 11000, 23500-50, A0001, B4034, J1234-25

TASK: ANALYZE DATA FOR INSIGHTS AND REPORT FINDINGS.
CRITICAL: Your response MUST be of type "query" and contain ONLY the findings. DO NOT generate any actions (e.g., filter, hide, delete).

Response: {"type": "query", "response": "RESULTS: [Detailed analysis findings with specific examples]."}

REPORT RESULTS IMMEDIATELY. NO EXPLANATIONS. NO ACTIONS.`
      : requestType === 'documentation'
      ? `You are an AI assistant for the CDM Merge Tool, a specialized Excel data comparison application for healthcare data management.

## About CDM Merge Tool

**Purpose**: The CDM Merge Tool processes Clinical Decision-Making (CDM) data by comparing master reference files with client data files to identify matches, duplicates, and discrepancies in healthcare data.

**Key Features**:
- Healthcare data reconciliation and HCPCS code validation
- Duplicate detection and data quality assurance
- Multi-sheet Excel file support with intelligent column mapping
- Advanced matching algorithms (exact, fuzzy, normalized)
- Comprehensive reporting with matched/unmatched/duplicate categorization
- In-place data editing with validation for all grids (master, client, merged)
- Record management: duplicate, delete, and add records via AI commands
- Save/cancel functionality for data edits with change tracking

**Matching Rules**: Uses HCPCS codes + modifiers as primary matching criteria. Match key format: "HCPCS Code + Modifier" (e.g., "99213" + "25" = "9921325").

**Modifier Settings Control Root Code Matching**:
The modifier settings dialog allows users to specify which modifier codes should be treated as "root codes" (without the modifier suffix) during matching:

1. **Root 00**: Include codes with modifier "00" - strips "00" modifier for matching
2. **Root 25**: Include codes with modifier "25" - strips "25" modifier for matching
3. **Root 50**: Include codes with modifier "50" - strips "50" modifier for matching
4. **Root 59**: Include codes with modifier "59" - strips "59" modifier for matching
5. **Root XU**: Include codes with modifier "XU" - strips "XU" modifier for matching
6. **Root 76**: Include codes with modifier "76" - strips "76" modifier for matching
7. **Ignore Trauma**: Excludes trauma team codes (99284, 99285, 99291) with "trauma team" descriptions

**How It Works**: When root modifiers are enabled, codes like "99213-25" will match as just "99213" if Root 25 is checked. This allows modified codes to match their base procedure codes.

**Output**: Generates Excel reports with three sheets:
1. **Merged**: All matched records with combined data
2. **Unmatched_Client**: Client records with no master match (need review)
3. **Duplicate_Client**: Client records with duplicate keys (need deduplication)

**Use Cases**: Healthcare billing validation, compliance auditing, data migration, and quality control for medical procedure codes and billing data.

**Documentation Questions**: Answer questions about app purpose, matching rules, modifiers, problems solved, and technical details. Provide informative but conversational responses focusing on practical understanding.

Return JSON with this structure for documentation responses:
{
  "type": "query",
  "response": "Detailed explanation in natural, conversational language"
}

Example responses:
- "what is this app for?" → {"type": "query", "response": "This is VIC's internal CDM Merge Tool - designed specifically for our team to streamline charge master data updates. The app merges Master and Client Excel files by matching HCPCS codes, then updates the Master with CDM data from the Client to create a clean merged dataset for export. Key features include HCPCS matching, configurable modifier settings for VIC's specific data requirements, quality control to identify unmatched records and duplicates, and export-ready output. This tool handles the tedious manual work of CDM merging while ensuring data accuracy and giving you visibility into any potential issues that need attention."}
- "what are modifier settings?" → {"type": "query", "response": "Modifier settings let you specify which modifier codes should be treated as root codes during matching. For example, if Root 25 is enabled, codes like '99213-25' will match as just '99213'. Available options include Root 00, Root 25, Root 50, Root 59, Root XU, Root 76, and Ignore Trauma (excludes trauma team codes). This allows modified procedure codes to match their base codes when needed."}

IMPORTANT: Always respond with natural, conversational language. Never show JSON examples or technical structures to users.`
      : baseSystemPrompt;

    // Create a streaming response
    const encoder = new TextEncoder();
    let responseBuffer = '';
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let geminiStream: AsyncIterable<{ text: () => string }>;
          
          // Select model based on request type - Use same as working HCPCS validation
          const selectedModel = "gemini-1.5-flash";
          
          console.log('[AI API DEBUG] Using model:', selectedModel, 'for request type:', requestType);
          console.log('[AI API DEBUG] Dataset size for analysis:', optimizedGridContext.sampleData.length, 'records');
          
          try {
            // First attempt with streaming and normal timeout
            // Build messages array with optional chat context
            const regularMessages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
              { role: "system", content: systemPrompt },
              ...(chatContext || []).map(ctx => ({ role: ctx.role, content: ctx.content })),
              { role: "user", content: message },
              { role: "system", content: requestType === 'validation' || requestType === 'analysis'
                ? "CRITICAL: Your response MUST be of type \"query\". DO NOT generate any actions (e.g., filter, hide, delete). Provide findings immediately. Example: {\"type\": \"query\", \"response\": \"Invalid HCPCS codes found: 99213 (starts with number), XYZ123 (invalid letter).\"}"
                : "CRITICAL: You MUST respond with valid JSON format. Never respond with plain text. Examples:\n- Sort: {\"type\": \"action\", \"action\": \"sort\", \"parameters\": {\"column\": \"description\", \"direction\": \"asc\"}, \"response\": \"Sorting by description\"}\n- Switch: {\"type\": \"action\", \"action\": \"switch\", \"parameters\": {\"view\": \"master\"}, \"response\": \"Switching to master grid\"}" }
            ];

            console.log('[AI API DEBUG] Regular processing with context:', chatContext?.length || 0, 'previous messages');
            console.log('[AI API DEBUG] System prompt being sent to AI:', systemPrompt.substring(0, 500) + '...');
            console.log('[AI API DEBUG] User message being sent to AI:', message);
            console.log('[AI API DEBUG] Full messages array being sent to Gemini:', JSON.stringify(regularMessages, null, 2));

            console.log('[GEMINI STREAM DEBUG] Creating model instance for:', selectedModel);
            const model = genAI.getGenerativeModel({ model: selectedModel });
            const prompt = regularMessages.map(msg => {
              if (msg.role === 'system') return `System: ${msg.content}`;
              if (msg.role === 'user') return `User: ${msg.content}`;
              if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
              return msg.content;
            }).join('\n\n');

            console.log('[GEMINI STREAM DEBUG] Attempting streaming call to:', selectedModel, 'prompt length:', prompt.length);
            geminiStream = await Promise.race([
              model.generateContentStream(prompt),
              // Additional timeout safety net
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout (10min limit)')), 600000)
              )
            ]) as AsyncIterable<{ text: () => string }>;
            console.log('[GEMINI STREAM DEBUG] Successfully initiated stream from:', selectedModel);
          } catch (firstAttemptError) {
            // If first attempt fails, implement intelligent fallback
            console.log('[AI API DEBUG] First attempt failed:', firstAttemptError);
            
            // For any requests that failed, fallback to stable Gemini 1.5 model
            const fallbackModel = "gemini-1.5-flash";
            
            // Create fallback context with appropriate data for request type
            const fallbackGridContext = {
              ...gridContext,
              sampleData: requestType === 'analysis' || requestType === 'validation'
                ? gridContext.sampleData.slice(0, 100) // Use 100 rows for analysis/validation fallback
                : gridContext.sampleData.slice(0, 2), // Use minimal sample for other fallbacks
            };
            
            console.log('[AI API DEBUG] Falling back to:', fallbackModel, 'with reduced dataset');
            
            const simplifiedPrompt = requestType === 'documentation'
              ? `You are an AI assistant for the CDM Merge Tool - a healthcare data comparison application.

The CDM Merge Tool processes Clinical Decision-Making (CDM) data by comparing master reference files with client data files to identify matches, duplicates, and discrepancies in healthcare data.

Key features: HCPCS code matching, modifier settings, duplicate detection, data quality assurance, Excel export.

For documentation questions, respond with JSON:
{"type": "query", "response": "Detailed explanation"}

Examples:
- "what is this app for?" → {"type": "query", "response": "This is VIC's internal CDM Merge Tool - designed specifically for our team to streamline charge master data updates. The app merges Master and Client Excel files by matching HCPCS codes, then updates the Master with CDM data from the Client to create a clean merged dataset for export. Key features include HCPCS matching, configurable modifier settings for VIC's specific data requirements, quality control to identify unmatched records and duplicates, and export-ready output. This tool handles the tedious manual work of CDM merging while ensuring data accuracy and giving you visibility into any potential issues that need attention."}
- "what are modifier settings?" → {"type": "query", "response": "Modifier settings let you specify which modifier codes should be treated as root codes during matching. For example, if Root 25 is enabled, codes like '99213-25' will match as just '99213'. Available options include Root 00, Root 25, Root 50, Root 59, Root XU, Root 76, and Ignore Trauma (excludes trauma team codes). This allows modified procedure codes to match their base codes when needed."}`
              : `You are an AI assistant for the CDM Merge Tool.

Current context: ${fallbackGridContext.selectedGrid} grid with ${fallbackGridContext.rowCount} rows.
Available columns: ${fallbackGridContext.columns.join(', ')}
Available grids: ${Object.entries(fallbackGridContext.availableGrids).filter(([, grid]) => grid.hasData).map(([name, grid]) => `${name}(${grid.rowCount})`).join(', ')}
Sample data: ${JSON.stringify(fallbackGridContext.sampleData)}

For user commands, respond with JSON:
- Sort: {"type": "action", "action": "sort", "parameters": {"column": "exact_column_name", "direction": "asc|desc"}, "response": "Sorting by X"}
- Filter: {"type": "action", "action": "filter", "parameters": {"column": "exact_column_name", "condition": "is_empty|equals|contains", "value": "search_value"}, "response": "Filtering..."}
- Switch grid: {"type": "action", "action": "switch", "parameters": {"view": "master|client|merged|unmatched|duplicates"}, "response": "Switching to X grid"}
- Questions: {"type": "query", "response": "Answer text"}

${requestType === 'analysis' || requestType === 'validation' ? `For ${requestType} requests, examine all provided data thoroughly and provide specific findings with concrete examples. Do not mention sampling limitations.` : ''}

Examples:
- "sort by description" → {"type": "action", "action": "sort", "parameters": {"column": "description", "direction": "asc"}, "response": "Sorting by description"}
- "sort master by description" → {"type": "action", "action": "sort", "parameters": {"column": "description", "direction": "asc", "view": "master"}, "response": "Sorting master grid by description"}
- "show master" → {"type": "action", "action": "switch", "parameters": {"view": "master"}, "response": "Switching to master grid"}`;
            
            const retryMessages = [
              { role: "system", content: simplifiedPrompt },
              { role: "user", content: message }
            ];
            
            const fallbackModelInstance = genAI.getGenerativeModel({ model: fallbackModel });
            const fallbackPrompt = retryMessages.map(msg => {
              if (msg.role === 'system') return `System: ${msg.content}`;
              if (msg.role === 'user') return `User: ${msg.content}`;
              if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
              return msg.content;
            }).join('\n\n');

            geminiStream = await Promise.race([
              fallbackModelInstance.generateContentStream(fallbackPrompt),
              // Longer timeout for retry
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout (5min limit on retry)')), 300000)
              )
            ]) as AsyncIterable<{ text: () => string }>;
          }
          
          // REAL STREAMING: Send each chunk from Gemini directly to client as it arrives
          for await (const chunk of geminiStream) {
            const content = chunk.text();
            if (content) {
              responseBuffer += content;
              
              // Send chunk immediately to client (real streaming)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: content })}\n\n`));
            }
          }
          
          // Send complete signal with full response for action parsing
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ complete: true, fullResponse: responseBuffer })}\n\n`));
          controller.close();
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('AI Chat API Error:', error);
    console.error('Processing time before error:', processingTime + 'ms');
    
    // Provide more specific error messages for non-streaming errors
    let errorMessage = 'Failed to process AI request';
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('Request timeout')) {
        errorMessage = 'Request timed out - this prompt may be too complex for the deployment environment. Try a simpler command.';
      } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
        errorMessage = 'OpenAI rate limit exceeded. Please wait a moment and try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error connecting to OpenAI. Please check your connection and try again.';
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
