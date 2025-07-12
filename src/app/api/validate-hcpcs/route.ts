import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { openaiValidationService } from '@/utils/openaiValidationService';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 120;

// File-based cache for persistence across requests
const CACHE_FILE = path.join(process.cwd(), 'temp-cache.json');
const CACHE_TTL = 4 * 30 * 24 * 60 * 60 * 1000; // 4 months in milliseconds

// Configuration for legacy cache handling
const TREAT_LEGACY_AS_STALE = process.env.TREAT_LEGACY_CACHE_AS_STALE === 'true';
const LEGACY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for legacy entries if not treating as stale

// Module-level cache that persists across requests
let serverCache: Map<string, { isValid: boolean; reason?: string; timestamp: number; validatedBy?: string; model?: string; invalidReason?: string }> | null = null;
let cacheLastLoaded = 0;
const CACHE_RELOAD_INTERVAL = 5 * 60 * 1000; // Reload cache from disk every 5 minutes

// Helper functions for file-based cache
function loadCache(): Map<string, { isValid: boolean; reason?: string; timestamp: number; validatedBy?: string; model?: string; invalidReason?: string }> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      const parsed = JSON.parse(data) as Record<string, { isValid: boolean; reason?: string; timestamp: number; validatedBy?: string; model?: string; invalidReason?: string }>;
      const cacheMap = new Map();
      
      let legacyCount = 0;
      let modernCount = 0;
      
      // Process each entry and mark legacy entries
      Object.entries(parsed).forEach(([code, entry]) => {
        if (!entry.validatedBy || !entry.model) {
          // Legacy entry - mark it with unknown model info
          cacheMap.set(code, {
            ...entry,
            validatedBy: 'unknown',
            model: 'legacy-unknown'
          });
          legacyCount++;
        } else {
          // Modern entry with model info
          cacheMap.set(code, entry);
          modernCount++;
        }
      });
      
      console.log(`[CACHE] Loaded ${cacheMap.size} entries from cache file (${modernCount} with model info, ${legacyCount} legacy entries)`);
      
      // If we have legacy entries, save the migrated cache
      if (legacyCount > 0) {
        console.log(`[CACHE] Migrating ${legacyCount} legacy entries to include model info`);
        saveCache(cacheMap);
      }
      
      return cacheMap;
    }
  } catch (error) {
    console.warn('[CACHE] Error loading cache file:', error);
  }
  return new Map();
}

function saveCache(cache: Map<string, { isValid: boolean; reason?: string; timestamp: number; validatedBy?: string; model?: string; invalidReason?: string }>) {
  try {
    const data = Object.fromEntries(cache);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn('[CACHE] Error saving cache file:', error);
  }
}

// Get or initialize the cache
function getCache(): Map<string, { isValid: boolean; reason?: string; timestamp: number; validatedBy?: string; model?: string; invalidReason?: string }> {
  const now = Date.now();
  
  // Initialize cache or reload if stale
  if (!serverCache || (now - cacheLastLoaded) > CACHE_RELOAD_INTERVAL) {
    console.log('[CACHE] Loading cache from file (first load or refresh interval reached)');
    serverCache = loadCache();
    cacheLastLoaded = now;
  }
  
  return serverCache;
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

interface ValidationRequest {
  codes: string[];
}

interface ValidationResult {
  inputCode: string;
  baseCptValid: boolean;
  modifierPresent: boolean;
  modifierValid: boolean | null; // null for N/A
  notes: string;
}

interface ValidationResponse {
  invalidCodes: string[];
  validationResults: { [code: string]: { isValid: boolean; reason?: string } };
  detailedResults?: ValidationResult[];
  quotaWarning?: string;
  manualReviewWarning?: string;
  cacheStats?: {
    cacheHits: number;
    aiValidations: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get cache (from memory if available, otherwise load from file)
    const serverCache = getCache();
    console.log(`[CACHE DEBUG] Cache size: ${serverCache.size} entries`);
    if (serverCache.size > 0) {
      console.log(`[CACHE DEBUG] Sample cached codes:`, Array.from(serverCache.keys()).slice(0, 5));
    }

    const { codes }: ValidationRequest = await request.json();

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: 'Invalid codes array' }, { status: 400 });
    }

    console.log(`[BULK HCPCS VALIDATION] Validating ${codes.length} codes:`, codes.slice(0, 10), codes.length > 10 ? '...' : '');

    // Remove duplicates and clean codes
    let uniqueCodes = [...new Set(codes.map(code => String(code).trim().toUpperCase()))].filter(code => code.length > 0);

    console.log(`[INPUT DEBUG] First 10 raw codes:`, codes.slice(0, 10));
    console.log(`[INPUT DEBUG] First 10 unique codes:`, uniqueCodes.slice(0, 10));

    if (uniqueCodes.length === 0) {
      return NextResponse.json({ error: 'No valid codes to validate' }, { status: 400 });
    }

    // Ensure consistent ordering for reproducible results
    uniqueCodes.sort();
    
    console.log(`[BULK HCPCS VALIDATION] Processing ${uniqueCodes.length} unique codes`);
    console.log(`[BULK HCPCS VALIDATION] Sample codes:`, uniqueCodes.slice(0, 20));

    // Debug: Check if first few codes are in cache
    if (serverCache.size > 0) {
      console.log(`[CACHE DEBUG] First 5 codes to process:`, uniqueCodes.slice(0, 5));
      console.log(`[CACHE DEBUG] Sample cached keys:`, Array.from(serverCache.keys()).slice(0, 5));

      uniqueCodes.slice(0, 5).forEach(code => {
        const cached = serverCache.get(code);
        console.log(`[CACHE DEBUG] Looking for "${code}", found: ${!!cached}`);
        if (!cached) {
          // Check if it's a case/formatting issue
          const allKeys = Array.from(serverCache.keys());
          const similarKeys = allKeys.filter(key => key.toLowerCase() === code.toLowerCase() || key.includes(code) || code.includes(key));
          if (similarKeys.length > 0) {
            console.log(`[CACHE DEBUG] Similar keys found for "${code}":`, similarKeys.slice(0, 3));
          }
        }
      });
    }

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Process codes with parallel batching for reliability
          const invalidCodes: string[] = [];
          const validationResults: { [code: string]: { isValid: boolean; reason?: string } } = {};
          let processedCount = 0;
          let cacheHits = 0; // Track cache hits
          let geminiQuotaExceeded = false; // Track if Gemini quota is exceeded

          // Track if controller is closed globally
          let globalControllerClosed = false;

          // Helper function to safely send progress updates
          const safeEnqueue = (data: string) => {
            if (!globalControllerClosed) {
              try {
                controller.enqueue(encoder.encode(data));
              } catch (error) {
                globalControllerClosed = true;
                console.warn('[VALIDATION] Controller closed, stopping progress updates');
              }
            }
          };

          // Send initial progress
          safeEnqueue(`data: ${JSON.stringify({ type: 'progress', processed: 0, total: uniqueCodes.length })}\n\n`);

          // Helper function to sleep
          const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

          // Helper function to validate a single code with AI
          const validateCodeWithAI = async (code: string, forceOpenAI: boolean = false): Promise<{ isValid: boolean; reason?: string; description?: string; invalidReason?: string }> => {
            try {
              // Parse code into base and modifier
              let baseCode = code;
              let modifier = '';
              const hyphenIndex = code.indexOf('-');

              if (hyphenIndex !== -1) {
                baseCode = code.substring(0, hyphenIndex);
                modifier = code.substring(hyphenIndex + 1);
              } else if (code.length > 5 && /^[A-Z0-9]{5}[A-Z0-9]{1,2}$/.test(code)) {
                // Handle codes like "94640ED" where modifier is appended
                baseCode = code.substring(0, 5);
                modifier = code.substring(5);
              }

              // Check if we should use OpenAI (either forced or Gemini quota exceeded)
              if ((forceOpenAI || geminiQuotaExceeded) && openaiValidationService.isAvailable()) {
                // Use OpenAI for single code validation
                console.log(`[VALIDATION] Using OpenAI for ${code}`);
                const openaiResult = await openaiValidationService.validateCPTCodes([code]);
                const result = openaiResult.validationResults[code];
                return {
                  isValid: result?.isValid || false,
                  reason: result?.reason,
                  description: result?.description,
                  invalidReason: result?.invalidReason
                };
              } else if (!geminiQuotaExceeded) {
                // Use Gemini for single code validation (only if quota not exceeded)
                const hasModifier = code.includes('-') || (code.length > 5 && /^[A-Z0-9]{5}[A-Z0-9]{1,2}$/.test(code));
                const prompt = hasModifier ? 
                  `Validate this CPT code with modifier. Return your response in this exact format:

STATUS: [BASE_INVALID|MOD_INVALID|VALID]
REASON: [One sentence explaining why invalid, or confirmation if valid]

BASE_INVALID if the CPT base code is invalid or does not exist.
MOD_INVALID if the base code is valid but the modifier is invalid or inappropriate for that code.
VALID if both the base code and modifier are valid and appropriate.

Known valid modifiers include standard CPT modifiers like:
-50, -LT, -RT, -25, -59, -26, -TC
and finger-specific modifiers:
-F1, -F2, -F3, -F4, -F5, -F6, -F7, -F8, -F9

Consider the finger-specific modifiers valid only if applied to codes related to hand or finger procedures.

Code to validate: ${code}` :
                  `Validate this CPT code. Return your response in this exact format:

STATUS: [BASE_INVALID|VALID]
REASON: [One sentence explaining why invalid, or confirmation if valid]

BASE_INVALID if the CPT code is invalid or does not exist.
VALID if the CPT code is valid.

Code to validate: ${code}`;

                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                const response = await model.generateContent(prompt);
                const result = response.response.text()?.trim().toUpperCase() || '';

                console.log(`[VALIDATION] Gemini ${code}: ${result}`);

                // Parse the structured response
                const statusMatch = result.match(/STATUS:\s*(BASE_INVALID|MOD_INVALID|VALID)/);
                const reasonMatch = result.match(/REASON:\s*(.+?)(?:\n|$)/);
                
                const status = statusMatch ? statusMatch[1] : '';
                const aiReason = reasonMatch ? reasonMatch[1].trim() : '';

                // Determine validation result
                let isValid = true;
                let reason = '';
                let invalidReason: string | undefined;

                if (status === 'BASE_INVALID') {
                  isValid = false;
                  reason = hasModifier ? 'Invalid base CPT code' : 'Invalid CPT code';
                  invalidReason = aiReason || 'CPT code does not exist or is invalid.';
                } else if (status === 'MOD_INVALID') {
                  isValid = false;
                  reason = 'Invalid or inappropriate modifier for this code';
                  invalidReason = aiReason || 'Modifier is invalid or inappropriate for this code.';
                } else if (status === 'VALID') {
                  isValid = true;
                  reason = hasModifier ? 'Valid CPT code with appropriate modifier' : 'Valid CPT code';
                  invalidReason = undefined;
                } else {
                  // If response is unclear, log it and assume valid to avoid false positives
                  console.warn(`[VALIDATION] Unexpected Gemini response for ${code}: "${result}"`);
                  isValid = true;
                  reason = 'Unclear response - assumed valid';
                  invalidReason = undefined;
                }

                return { isValid, reason, invalidReason };
              } else {
                // Gemini quota exceeded and OpenAI not available
                throw new Error('quota_exceeded');
              }
            } catch (error) {
              const errorMessage = (error as Error)?.message || String(error);
              console.error(`[VALIDATION ERROR] ${code}:`, errorMessage);

              // Check if it's a quota error
              if (errorMessage.includes('429') || errorMessage.includes('quota')) {
                throw new Error('quota_exceeded');
              }

              // For other errors, throw to handle upstream
              throw error;
            }
          };

          // Helper function to validate a single code (with cache check)
          const validateCode = async (code: string): Promise<void> => {

            try {
              // First check server-side cache
              const cachedResult = serverCache.get(code);
              if (cachedResult) {
                const age = Date.now() - cachedResult.timestamp;
                const isLegacy = cachedResult.model === 'legacy-unknown';
                let isExpired = age >= CACHE_TTL;
                
                // Handle legacy entries differently
                if (isLegacy) {
                  if (TREAT_LEGACY_AS_STALE) {
                    isExpired = true;
                    console.log(`[CACHE DEBUG] Legacy entry for ${code} treated as stale (TREAT_LEGACY_AS_STALE=true)`);
                  } else {
                    isExpired = age >= LEGACY_CACHE_TTL;
                    console.log(`[CACHE DEBUG] Legacy entry for ${code}, age: ${Math.round(age / 1000)}s, using legacy TTL, expired: ${isExpired}`);
                  }
                } else {
                  console.log(`[CACHE DEBUG] Modern entry for ${code} (${cachedResult.model}), age: ${Math.round(age / 1000)}s, expired: ${isExpired}`);
                }

                if (!isExpired) {
                  const cacheType = isLegacy ? 'legacy cache' : `${cachedResult.model} cache`;
                  console.log(`[VALIDATION] Cache hit for ${code} (${cacheType})`);
                  cacheHits++; // Increment cache hit counter
                  validationResults[code] = {
                    isValid: cachedResult.isValid,
                    reason: cachedResult.reason
                  };

                  if (!cachedResult.isValid) {
                    invalidCodes.push(code);
                  }

                  processedCount++;
                  safeEnqueue(`data: ${JSON.stringify({ type: 'progress', processed: processedCount, total: uniqueCodes.length })}\n\n`);
                  return;
                }
              } else {
                console.log(`[CACHE DEBUG] No cached entry found for ${code}`);
              }

              // Not in cache, validate with AI
              let aiResult;
              let validatedBy: string;
              let modelUsed: string;

              // Determine which service to use
              if (geminiQuotaExceeded) {
                // Skip straight to OpenAI if Gemini quota already exceeded
                try {
                  aiResult = await validateCodeWithAI(code, true);
                  validatedBy = 'openai';
                  modelUsed = 'gpt-4o-mini';
                } catch (openaiError) {
                  console.error(`[VALIDATION] OpenAI failed for ${code}:`, openaiError);
                  // Mark as needing manual review
                  aiResult = {
                    isValid: true,
                    reason: 'OpenAI failed - needs manual review'
                  };
                  validatedBy = 'failed';
                  modelUsed = 'unknown';
                }
              } else {
                // Try Gemini first
                try {
                  aiResult = await validateCodeWithAI(code, false);
                  validatedBy = 'gemini';
                  modelUsed = 'gemini-2.5-flash';
                } catch (geminiError) {
                  if ((geminiError as Error).message === 'quota_exceeded') {
                    console.log(`[VALIDATION] Gemini quota exceeded for ${code}, trying OpenAI`);
                    geminiQuotaExceeded = true; // Set the flag to skip Gemini for remaining codes

                    // Try OpenAI fallback
                    if (openaiValidationService.isAvailable()) {
                      try {
                        aiResult = await validateCodeWithAI(code, true);
                        validatedBy = 'openai';
                        modelUsed = 'gpt-4o-mini';
                      } catch (openaiError) {
                        console.error(`[VALIDATION] OpenAI also failed for ${code}:`, openaiError);
                        // Mark as needing manual review
                        aiResult = {
                          isValid: true,
                          reason: 'Both AI services failed - needs manual review'
                        };
                        validatedBy = 'failed';
                        modelUsed = 'unknown';
                      }
                    } else {
                      // No OpenAI fallback available
                      aiResult = {
                        isValid: true,
                        reason: 'Gemini quota exceeded, OpenAI not available - needs manual review'
                      };
                      validatedBy = 'failed';
                      modelUsed = 'unknown';
                    }
                  } else {
                    // Other error - assume valid to avoid false positives
                    aiResult = {
                      isValid: true,
                      reason: 'Validation error - assumed valid'
                    };
                    validatedBy = 'failed';
                    modelUsed = 'unknown';
                  }
                }
              }

              // Store in cache if successfully validated by AI
              if (aiResult && !aiResult.reason?.includes('manual review') && !aiResult.reason?.includes('error')) {
                serverCache.set(code, {
                  isValid: aiResult.isValid,
                  reason: aiResult.reason,
                  timestamp: Date.now(),
                  validatedBy,
                  model: modelUsed,
                  invalidReason: aiResult.invalidReason
                });
                console.log(`[VALIDATION] Stored ${code} in cache (validated by ${validatedBy} using ${modelUsed}). Cache size now: ${serverCache.size}`);

                // Save cache to file immediately (for persistence)
                saveCache(serverCache);
              }

              // Update results
              validationResults[code] = {
                isValid: aiResult.isValid,
                reason: aiResult.reason
              };

              if (!aiResult.isValid) {
                invalidCodes.push(code);
              }

              // Increment and send progress
              processedCount++;
              safeEnqueue(`data: ${JSON.stringify({ type: 'progress', processed: processedCount, total: uniqueCodes.length })}\n\n`);

            } catch (error) {
              console.error(`[VALIDATION] Unexpected error for ${code}:`, error);

              // Assume valid to avoid false positives
              validationResults[code] = {
                isValid: true,
                reason: 'Unexpected error - assumed valid'
              };

              // Still increment progress
              processedCount++;
              safeEnqueue(`data: ${JSON.stringify({ type: 'progress', processed: processedCount, total: uniqueCodes.length })}\n\n`);
            }
          };

          // Process codes in parallel batches for efficiency
          // Each validation is still single-code, but we can run many in parallel
          const BATCH_SIZE = 50; // Process 50 codes concurrently
          const BATCH_DELAY = 200; // 200ms between batches

          for (let i = 0; i < uniqueCodes.length; i += BATCH_SIZE) {
            const batch = uniqueCodes.slice(i, Math.min(i + BATCH_SIZE, uniqueCodes.length));
            console.log(`[BULK HCPCS VALIDATION] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(uniqueCodes.length / BATCH_SIZE)} (${batch.length} codes)`);

            // Process all codes in this batch in parallel
            const batchPromises = batch.map(code => validateCode(code));

            // Wait for all in this batch to complete
            await Promise.all(batchPromises);

            // Delay between batches to respect rate limits
            if (i + BATCH_SIZE < uniqueCodes.length) {
              await sleep(BATCH_DELAY);
            }
          }

          console.log(`[BULK HCPCS VALIDATION] Validation complete. Found ${invalidCodes.length} invalid codes out of ${uniqueCodes.length} total`);

          // Check validation statistics
          const quotaErrorCount = Object.values(validationResults).filter(r => r.reason?.includes('quota')).length;
          const manualReviewCount = Object.values(validationResults).filter(r => r.reason?.includes('manual review')).length;
          const aiValidations = processedCount - cacheHits;

          if (quotaErrorCount > 0) {
            console.warn(`[BULK HCPCS VALIDATION] WARNING: ${quotaErrorCount} codes hit API quota limits`);
          }

          if (manualReviewCount > 0) {
            console.warn(`[BULK HCPCS VALIDATION] WARNING: ${manualReviewCount} codes need manual review`);
          }

          console.log(`[BULK HCPCS VALIDATION] Cache hits: ${cacheHits}, AI validations: ${aiValidations}`)

          // Sanity check for unusually high invalid rate
          const invalidRate = invalidCodes.length / uniqueCodes.length;
          if (invalidRate > 0.3 && uniqueCodes.length > 10) {
            console.warn(`[BULK HCPCS VALIDATION] WARNING: ${(invalidRate * 100).toFixed(1)}% of codes marked invalid. This may indicate false positives.`);
            console.warn(`[BULK HCPCS VALIDATION] Invalid codes sample: ${invalidCodes.slice(0, 10).join(', ')}${invalidCodes.length > 10 ? '...' : ''}`);
          }

          const validationData: ValidationResponse = {
            invalidCodes,
            validationResults,
            // Add quota warning if needed
            ...(quotaErrorCount > 0 ? { quotaWarning: `${quotaErrorCount} codes hit API quota limits` } : {}),
            // Add manual review warning if needed
            ...(manualReviewCount > 0 ? { manualReviewWarning: `${manualReviewCount} codes need manual review` } : {}),
            // Add cache statistics
            cacheStats: {
              cacheHits: cacheHits,
              aiValidations: aiValidations
            }
          };

          // Send final result
          if (!globalControllerClosed) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', data: validationData })}\n\n`));
              controller.close();
            } catch (error) {
              console.warn('[VALIDATION] Could not send final result, controller already closed');
            }
          }

        } catch (error) {
          console.error('[BULK HCPCS VALIDATION] Stream error:', error);
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Validation failed' })}\n\n`));
            controller.close();
          } catch (closeError) {
            console.warn('[VALIDATION] Could not send error result, controller already closed');
          }
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
    console.error('[BULK HCPCS VALIDATION] Error:', error);
    return NextResponse.json(
      { error: 'Failed to validate HCPCS codes' },
      { status: 500 }
    );
  }
}