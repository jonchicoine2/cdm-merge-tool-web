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

interface ValidationResponse {
  invalidCodes: string[];
  validationResults: { [code: string]: { isValid: boolean; reason?: string } };
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

    const prompt = `Validate these HCPCS/CPT codes. Return JSON with only invalid codes:

CODES: ${uniqueCodes.join(', ')}

Response format:
{"invalidCodes": ["CODE1", "CODE2"]}

Rules:
- Only list codes that are definitively invalid
- If unsure, don't include the code
- Use exact code format from input`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const result = response.choices[0]?.message?.content || '';
    console.log('[BULK HCPCS VALIDATION] GPT-4o full response:', result);

    try {
      // Clean up the response to extract JSON
      let jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('[BULK HCPCS VALIDATION] No JSON block found, trying alternative parsing...');
        // Try to find JSON starting with "invalidCodes"
        const altMatch = result.match(/\{[\s\S]*"invalidCodes"[\s\S]*\}/);
        if (altMatch) {
          jsonMatch = altMatch;
        } else {
          console.log('[BULK HCPCS VALIDATION] Raw response for debugging:', result);
          throw new Error('No JSON found in response');
        }
      }

      console.log('[BULK HCPCS VALIDATION] Attempting to parse JSON:', jsonMatch[0]);
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      // Extract invalid codes from response
      const invalidCodes = parsedResponse.invalidCodes || [];
      
      if (!Array.isArray(invalidCodes)) {
        console.error('[BULK HCPCS VALIDATION] Invalid response format - invalidCodes is not an array');
        return NextResponse.json({
          invalidCodes: [],
          validationResults: {},
          error: 'Invalid response format from validation service'
        });
      }

      const validationData: ValidationResponse = {
        invalidCodes,
        validationResults: {}
      };

      console.log(`[BULK HCPCS VALIDATION] Found ${invalidCodes.length} invalid codes:`, invalidCodes);

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