import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 120;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90000,
  maxRetries: 2,
});

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
}

export async function POST(request: NextRequest) {
  try {
    const { codes }: ValidationRequest = await request.json();

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: 'Invalid codes array' }, { status: 400 });
    }

    console.log(`[BULK HCPCS VALIDATION] Validating ${codes.length} codes:`, codes.slice(0, 10), codes.length > 10 ? '...' : '');

    // Remove duplicates and clean codes
    const uniqueCodes = [...new Set(codes.map(code => String(code).trim().toUpperCase()))].filter(code => code.length > 0);

    if (uniqueCodes.length === 0) {
      return NextResponse.json({ error: 'No valid codes to validate' }, { status: 400 });
    }

    // Limit to prevent token overflow - GPT-4o has ~128k tokens, be conservative
    const maxCodesPerBatch = 200;
    if (uniqueCodes.length > maxCodesPerBatch) {
      console.log(`[BULK HCPCS VALIDATION] Too many codes (${uniqueCodes.length}), limiting to first ${maxCodesPerBatch}`);
      uniqueCodes.splice(maxCodesPerBatch);
    }

    const prompt = `Validate these HCPCS/CPT codes. IMPORTANT: Be extremely conservative - only flag codes that are definitively invalid. Return ONLY the JSON, no other text.

CODES: ${uniqueCodes.join(', ')}

VALIDATION RULES:
1. BASE CODE: Only invalid if it clearly doesn't exist in any HCPCS/CPT system
2. MODIFIERS: Accept almost ALL modifiers as potentially valid, including:
   - LT/RT/50 for most procedures
   - FA/F1-F9/TA/T1-T9 (finger/toe modifiers) for extremity procedures
   - 25/59/76/77/78/79/XE/XS/XP/XU for various circumstances
   - E1-E4 (eyelid modifiers) for eye procedures
   - Many other specialized modifiers

ONLY flag as invalid in these VERY SPECIFIC cases:
- Base code is clearly fake (FAKE1, ZZZZZ, TEST123)
- Office visit codes (99201-99215) with anatomical modifiers (LT/RT/50)
- Truly nonsensical combinations

CRITICAL: Medical coding has MANY exceptions and special cases. When unsure, assume VALID.

Return this format:
{
  "invalidCodes": ["CODE1", "CODE2"],
  "reasons": {
    "CODE1": "Invalid base code - does not exist",
    "CODE2": "Invalid modifier - E&M codes cannot be lateralized"
  }
}

BE EXTREMELY CONSERVATIVE - err on the side of marking codes as VALID.

RESPOND WITH ONLY THE JSON, NO OTHER TEXT.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const result = response.choices[0]?.message?.content || '';
    console.log('[BULK HCPCS VALIDATION] GPT-4o full response:', result);

    try {
      // Clean up the response to extract JSON - look for different possible formats
      let jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('[BULK HCPCS VALIDATION] No JSON block found, trying alternative parsing...');
        // Try to find JSON starting with "results" (new format)
        const altMatch = result.match(/\{[\s\S]*"results"[\s\S]*\}/);
        if (altMatch) {
          jsonMatch = altMatch;
        } else {
          console.log('[BULK HCPCS VALIDATION] Raw response for debugging:', result);
          throw new Error('No JSON found in response');
        }
      }

      console.log('[BULK HCPCS VALIDATION] Attempting to parse JSON:', jsonMatch[0]);
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      // Handle both old and new response formats
      let invalidCodes: string[] = [];
      let validationResults: { [code: string]: { isValid: boolean; reason?: string } } = {};
      let detailedResults: any[] = [];

      if (parsedResponse.results && Array.isArray(parsedResponse.results)) {
        // New structured format
        detailedResults = parsedResponse.results;
        
        detailedResults.forEach((result: any) => {
          const inputCode = result.inputCode;
          const isValid = result.baseCptValid && (result.modifierValid !== false);
          
          validationResults[inputCode] = {
            isValid,
            reason: result.notes || ''
          };

          if (!isValid) {
            invalidCodes.push(inputCode);
          }
        });
        
      } else if (parsedResponse.invalidCodes && Array.isArray(parsedResponse.invalidCodes)) {
        // Enhanced format with reasons
        invalidCodes = parsedResponse.invalidCodes;
        const reasons = parsedResponse.reasons || {};
        
        // Create validation results with reasons
        uniqueCodes.forEach(code => {
          const isInvalid = invalidCodes.includes(code);
          validationResults[code] = {
            isValid: !isInvalid,
            reason: isInvalid ? (reasons[code] || 'Code flagged as invalid') : ''
          };
        });
        
      } else {
        console.error('[BULK HCPCS VALIDATION] Invalid response format - no recognized structure');
        console.error('[BULK HCPCS VALIDATION] Response structure:', Object.keys(parsedResponse));
        return NextResponse.json({
          invalidCodes: [],
          validationResults: {},
          error: 'Invalid response format from validation service'
        });
      }

      const validationData: ValidationResponse = {
        invalidCodes,
        validationResults,
        detailedResults: detailedResults.length > 0 ? detailedResults : undefined
      };

      console.log(`[BULK HCPCS VALIDATION] Found ${invalidCodes.length} invalid codes:`, invalidCodes);
      console.log(`[BULK HCPCS VALIDATION] Detailed validation results:`, detailedResults.slice(0, 5));

      return NextResponse.json(validationData);

    } catch (parseError) {
      console.error('[BULK HCPCS VALIDATION] Failed to parse GPT-4o response:', parseError);
      console.error('[BULK HCPCS VALIDATION] Raw response:', result);
      
      // Fallback: return empty validation results
      return NextResponse.json({
        invalidCodes: [],
        validationResults: {},
        error: 'Failed to parse validation results'
      });
    }

  } catch (error) {
    console.error('[BULK HCPCS VALIDATION] Error:', error);
    return NextResponse.json(
      { error: 'Failed to validate HCPCS codes' },
      { status: 500 }
    );
  }
}