import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 120;

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

    const prompt = `You are a HCPCS/CPT validation expert. Review the following list of codes. Your task is to identify codes that are invalid.

A code is only invalid if the base code does not exist in the CPT/HCPCS system.

CRITICAL RULE: If you are in any way unsure about a code's validity, you MUST assume it is VALID. Err on the side of caution and do not flag it.

Return a JSON object with the key "invalidCodes" containing a list of the codes you have identified as invalid.

CODES: ${uniqueCodes.join(', ')}`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const response = await model.generateContent(prompt);

    //Log the request and response for debugging  
    console.log('[BULK HCPCS REQUEST] Gemini request:', {
      model: "gemini-1.5-flash",
      prompt: prompt.substring(0, 200) + '...'
    });

    const result = response.response.text() || '';
    console.log('[BULK HCPCS VALIDATION] Gemini full response:', result);

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
      const validationResults: { [code: string]: { isValid: boolean; reason?: string } } = {};
      let detailedResults: ValidationResult[] = [];

      if (parsedResponse.results && Array.isArray(parsedResponse.results)) {
        // New structured format
        detailedResults = parsedResponse.results;
        
        detailedResults.forEach((result: ValidationResult) => {
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

      // Double-check any codes that were flagged as invalid
      let finalInvalidCodes = invalidCodes;
      if (invalidCodes.length > 0) {
        console.log(`[DOUBLE CHECK] Verifying ${invalidCodes.length} flagged codes:`, invalidCodes);
        
        const verificationPromises = invalidCodes.map(async (code) => {
          try {
            const verifyPrompt = `Is "${code}" a valid HCPCS/CPT code? Answer only "yes" or "no".`;
            const verifyModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const verifyResponse = await verifyModel.generateContent(verifyPrompt);
            
            const verifyResult = verifyResponse.response.text()?.toLowerCase().trim() || '';
            console.log(`[DOUBLE CHECK] ${code}: ${verifyResult}`);
            
            // If the double-check says it's valid, remove it from invalid list
            return verifyResult.includes('yes') ? null : code;
          } catch (error) {
            console.error(`[DOUBLE CHECK] Error verifying ${code}:`, error);
            // If verification fails, assume the code is valid (conservative approach)
            return null;
          }
        });
        
        const verificationResults = await Promise.all(verificationPromises);
        finalInvalidCodes = verificationResults.filter(code => code !== null) as string[];
        
        console.log(`[DOUBLE CHECK] After verification: ${finalInvalidCodes.length} codes remain invalid:`, finalInvalidCodes);
        
        // Update validation results for codes that were cleared by double-check
        invalidCodes.forEach(code => {
          if (!finalInvalidCodes.includes(code)) {
            validationResults[code] = {
              isValid: true,
              reason: 'Cleared by double-check verification'
            };
          }
        });
      }

      const validationData: ValidationResponse = {
        invalidCodes: finalInvalidCodes,
        validationResults,
        detailedResults: detailedResults.length > 0 ? detailedResults : undefined
      };

      console.log(`[BULK HCPCS VALIDATION] Final result: ${finalInvalidCodes.length} invalid codes:`, finalInvalidCodes);

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