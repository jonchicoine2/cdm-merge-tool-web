// OpenAI Validation Service - Fallback for when Gemini quota is exceeded
interface OpenAIValidationResult {
  code: string;
  isValid: boolean;
  reason?: string;
  description?: string;
  category?: string;
  confidence: number;
  model?: string;
  invalidReason?: string;
}

interface OpenAIValidationResponse {
  results: OpenAIValidationResult[];
  totalProcessed: number;
  invalidCodes: string[];
  validationResults: { [code: string]: OpenAIValidationResult };
}

class OpenAIValidationService {
  private readonly apiKey: string;
  private readonly model: string = 'gpt-4o-mini'; // Using GPT-4o Mini for cost efficiency
  private readonly baseUrl: string = 'https://api.openai.com/v1/chat/completions';
  private readonly BATCH_SIZE = 50; // Process 50 codes at a time
  private readonly BATCH_DELAY = 1000; // 1 second delay between batches

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[OpenAI] API key not found. OpenAI fallback will not be available.');
    }
  }

  async validateCPTCodes(codes: string[]): Promise<OpenAIValidationResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (codes.length === 1) {
      console.log(`[OpenAI] Validating single CPT code: ${codes[0]}`);
    } else {
      console.log(`[OpenAI] Starting validation for ${codes.length} CPT codes in batches of ${this.BATCH_SIZE}`);
    }

    const allResults: OpenAIValidationResult[] = [];
    
    for (let i = 0; i < codes.length; i += this.BATCH_SIZE) {
        const batch = codes.slice(i, i + this.BATCH_SIZE);
        if (codes.length > 1) {
          console.log(`[OpenAI] Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(codes.length / this.BATCH_SIZE)} (${batch.length} codes)`);
        }
        
        try {
            const prompt = this.buildValidationPrompt(batch);
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: 'You are a medical coding expert specializing in CPT (Current Procedural Terminology) codes. Provide accurate validation of CPT codes with detailed explanations.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 4000,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[OpenAI] Batch failed: ${response.status} - ${errorText}`);
                // Mark batch as failed and continue
                batch.forEach(code => allResults.push({ code, isValid: false, reason: 'OpenAI API error', confidence: 0.1, model: this.model, invalidReason: 'API request failed.' }));
                continue;
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content;

            if (content) {
                const parsedBatch = this.parseAndCombine(content, batch);
                allResults.push(...parsedBatch);
            } else {
                batch.forEach(code => allResults.push({ code, isValid: false, reason: 'No response from OpenAI', confidence: 0.1, model: this.model, invalidReason: 'No response received from AI service.' }));
            }
        } catch (error) {
            console.error('[OpenAI] Error processing batch:', error);
            batch.forEach(code => allResults.push({ code, isValid: false, reason: 'Exception during processing', confidence: 0.1, model: this.model, invalidReason: 'Processing error occurred.' }));
        }

        // Delay between batches
        if (i + this.BATCH_SIZE < codes.length) {
            await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
        }
    }

    return this.formatFinalResponse(allResults, codes);
  }

  // New method to parse a single batch response
  private parseAndCombine(content: string, batchCodes: string[]): OpenAIValidationResult[] {
      try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON found');
          const parsed = JSON.parse(jsonMatch[0]);
          if (!parsed.results || !Array.isArray(parsed.results)) throw new Error('Invalid JSON structure');

          const batchResults: OpenAIValidationResult[] = parsed.results.map((item: any) => ({
              code: String(item.code).trim().toUpperCase(),
              isValid: Boolean(item.isValid),
              reason: item.reason || '',
              description: item.description || '',
              category: item.category || '',
              confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
              model: this.model,
              invalidReason: item.isValid ? undefined : (item.invalidReason || item.reason || 'No specific reason provided'),
          }));

          const resultCodes = new Set(batchResults.map(r => r.code));
          const missingCodes = batchCodes.filter(code => !resultCodes.has(code.toUpperCase()));
          missingCodes.forEach(code => batchResults.push({ code: code.toUpperCase(), isValid: false, reason: 'Not processed by OpenAI', confidence: 0.1, model: this.model, invalidReason: 'Code was not processed by the AI service.' }));
          
          return batchResults;
      } catch (error) {
          console.error('[OpenAI] Error parsing batch response:', error);
          return batchCodes.map(code => ({ code: code.toUpperCase(), isValid: false, reason: 'Error parsing OpenAI response', confidence: 0.1, model: this.model, invalidReason: 'Failed to parse AI response.' }));
      }
  }

  // New method to format the final aggregated response
  private formatFinalResponse(allResults: OpenAIValidationResult[], originalCodes: string[]): OpenAIValidationResponse {
      const invalidCodes = allResults.filter(r => !r.isValid).map(r => r.code);
      const validationResults: { [code: string]: OpenAIValidationResult } = {};
      allResults.forEach(result => {
          validationResults[result.code] = result;
      });

      return {
          results: allResults,
          totalProcessed: originalCodes.length,
          invalidCodes,
          validationResults,
      };
  }

  private buildValidationPrompt(codes: string[]): string {
    return `Please validate the following CPT codes and return results in JSON format.

CPT Codes to validate: ${codes.join(', ')}

For each code, determine:
1. Is it a valid CPT code?
2. If invalid, what's the specific reason?
3. If valid, provide a brief description
4. Categorize the procedure type if valid
5. Confidence level (0.0-1.0)
6. If invalid, provide a concise one-sentence explanation for invalidReason

Return ONLY a JSON object with this exact structure:
{
  "results": [
    {
      "code": "99213",
      "isValid": true,
      "reason": "Valid established patient office visit code",
      "description": "Office visit for established patient, low complexity",
      "category": "Evaluation and Management",
      "confidence": 0.95,
      "invalidReason": ""
    },
    {
      "code": "INVALID",
      "isValid": false,
      "reason": "Not a valid CPT code format",
      "description": "",
      "category": "",
      "confidence": 0.98,
      "invalidReason": "Code does not follow standard CPT format of 5 digits."
    }
  ]
}

Important guidelines:
- Be accurate about CPT code validity
- Provide specific reasons for invalid codes
- Use standard CPT categories (E&M, Surgery, Radiology, etc.)
- Confidence should reflect your certainty
- For invalid codes, provide invalidReason as one concise sentence explaining why
- For valid codes, leave invalidReason empty
- Return only valid JSON, no additional text`;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

export const openaiValidationService = new OpenAIValidationService(); 