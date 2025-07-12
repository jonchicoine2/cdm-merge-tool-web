import { NextRequest, NextResponse } from 'next/server';
import { cptCacheService, CPTCacheEntry } from '@/utils/cptCacheService';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ValidationRequest {
  codes: string[];
}

interface LocalValidationResult {
  code: string;
  isValid: boolean;
  reason?: string;
  codeInfo?: {
    code: string;
    shortDescription: string;
    longDescription: string;
    category: string;
    effectiveDate: string;
    terminationDate?: string;
  };
  modifierInfo?: {
    modifier: string;
    description: string;
    effectiveDate: string;
    terminationDate?: string;
  };
}

interface ValidationResponse {
  validationMethod: 'local';
  invalidCodes: string[];
  validationResults: { [code: string]: { isValid: boolean; reason?: string } };
  detailedResults: LocalValidationResult[];
  totalProcessed: number;
  processingTime: number;
  cacheInfo: {
    version: string | null;
    lastUpdated: string | null;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { codes }: ValidationRequest = await request.json();

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: 'Invalid codes array' }, { status: 400 });
    }

    console.log(`[LOCAL HCPCS VALIDATION] Validating ${codes.length} codes locally`);

    // Remove duplicates and clean codes
    const uniqueCodes = [...new Set(codes.map(code => String(code).trim().toUpperCase()))].filter(code => code.length > 0);

    if (uniqueCodes.length === 0) {
      return NextResponse.json({ error: 'No valid codes to validate' }, { status: 400 });
    }

    console.log(`[LOCAL HCPCS VALIDATION] Processing ${uniqueCodes.length} unique codes`);

    // Use the CPT Cache Service for local validation
    const { cached, missing, stale } = cptCacheService.getBulkCPTValidations(uniqueCodes);

    const invalidCodes: string[] = [];
    const validationResults: { [code: string]: { isValid: boolean; reason?: string } } = {};
    const detailedResults: any[] = []; // Using any for simplicity, can be typed later

    // Process cached results
    Object.values(cached).forEach((entry: CPTCacheEntry) => {
      validationResults[entry.code] = {
        isValid: entry.isValid,
        reason: entry.reason,
      };
      if (!entry.isValid) {
        invalidCodes.push(entry.code);
      }
      detailedResults.push({
        code: entry.code,
        isValid: entry.isValid,
        reason: entry.reason,
        codeInfo: {
            shortDescription: entry.description,
            category: entry.category,
            effectiveDate: entry.validatedDate
        }
      });
    });
    
    // Mark missing/stale codes as invalid for this 'local only' endpoint
    [...missing, ...stale].forEach(code => {
        const reason = missing.includes(code) 
            ? 'Code not found in local cache' 
            : 'Code is stale and needs AI re-validation';
        
        validationResults[code] = { isValid: false, reason };
        invalidCodes.push(code);
        detailedResults.push({ code, isValid: false, reason });
    });

    const processingTime = Date.now() - startTime;

    console.log(`[LOCAL HCPCS VALIDATION] Completed validation in ${processingTime}ms. Found ${invalidCodes.length} invalid codes out of ${uniqueCodes.length} total`);

    const response: ValidationResponse = {
      validationMethod: 'local',
      invalidCodes,
      validationResults,
      detailedResults,
      totalProcessed: uniqueCodes.length,
      processingTime,
      cacheInfo: {
        version: '1.0', // Static version for cache
        lastUpdated: new Date().toISOString()
      }
    };

    return NextResponse.json(response);

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('[LOCAL HCPCS VALIDATION] Error:', error);
    
    return NextResponse.json({
      error: 'Local validation failed',
      details: error.message,
      processingTime
    }, { status: 500 });
  }
} 