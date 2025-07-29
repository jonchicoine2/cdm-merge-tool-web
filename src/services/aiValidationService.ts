import { GoogleGenerativeAI } from '@google/generative-ai';
import { openaiValidationService } from '@/utils/openaiValidationService';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  description?: string;
  invalidReason?: string;
  validatedBy: string;
  model: string;
}

export interface ValidationProvider {
  name: string;
  validateCode(code: string): Promise<ValidationResult>;
  isAvailable(): boolean;
}

class GeminiProvider implements ValidationProvider {
  name = 'gemini';
  private genAI: GoogleGenerativeAI;
  private quotaExceeded = false;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
  }

  async validateCode(code: string): Promise<ValidationResult> {
    if (this.quotaExceeded) {
      throw new Error('quota_exceeded');
    }

    try {
      const { hasModifier } = this.parseCode(code);
      
      const prompt = this.buildPrompt(code, hasModifier);
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const response = await model.generateContent(prompt);
      const result = response.response.text()?.trim().toUpperCase() || '';

      console.log(`[Gemini] Validating ${code}: ${result}`);

      return this.parseResponse(result, code, hasModifier);
    } catch (error) {
      const errorMessage = (error as Error)?.message || String(error);
      
      if (errorMessage.includes('429') || errorMessage.includes('quota')) {
        this.quotaExceeded = true;
        throw new Error('quota_exceeded');
      }
      
      throw error;
    }
  }

  private parseCode(code: string): { baseCode: string; modifier: string; hasModifier: boolean } {
    let baseCode = code;
    let modifier = '';
    const hyphenIndex = code.indexOf('-');

    if (hyphenIndex !== -1) {
      baseCode = code.substring(0, hyphenIndex);
      modifier = code.substring(hyphenIndex + 1);
    } else if (code.length > 5 && /^[A-Z0-9]{5}[A-Z0-9]{1,2}$/.test(code)) {
      baseCode = code.substring(0, 5);
      modifier = code.substring(5);
    }

    return { baseCode, modifier, hasModifier: !!modifier };
  }

  private buildPrompt(code: string, hasModifier: boolean): string {
    if (hasModifier) {
      return `Validate this CPT code with modifier. Return your response in this exact format:

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

Code to validate: ${code}`;
    }

    return `Validate this CPT code. Return your response in this exact format:

STATUS: [BASE_INVALID|VALID]
REASON: [One sentence explaining why invalid, or confirmation if valid]

BASE_INVALID if the CPT code is invalid or does not exist.
VALID if the CPT code is valid.

Code to validate: ${code}`;
  }

  private parseResponse(result: string, code: string, hasModifier: boolean): ValidationResult {
    const statusMatch = result.match(/STATUS:\s*(BASE_INVALID|MOD_INVALID|VALID)/);
    const reasonMatch = result.match(/REASON:\s*(.+?)(?:\n|$)/);
    
    const status = statusMatch ? statusMatch[1] : '';
    const aiReason = reasonMatch ? reasonMatch[1].trim() : '';

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
      console.warn(`[Gemini] Unexpected response for ${code}: "${result}"`);
      isValid = true;
      reason = 'Unclear response - assumed valid';
      invalidReason = undefined;
    }

    return {
      isValid,
      reason,
      invalidReason,
      validatedBy: 'gemini',
      model: 'gemini-2.5-flash'
    };
  }

  isAvailable(): boolean {
    return !!process.env.GOOGLE_AI_API_KEY && !this.quotaExceeded;
  }

  resetQuota(): void {
    this.quotaExceeded = false;
  }
}

class OpenAIProvider implements ValidationProvider {
  name = 'openai';

  async validateCode(code: string): Promise<ValidationResult> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI not available');
    }

    try {
      console.log(`[OpenAI] Validating ${code}`);
      const result = await openaiValidationService.validateCPTCodes([code]);
      const validation = result.validationResults[code];

      return {
        isValid: validation?.isValid || false,
        reason: validation?.reason,
        description: validation?.description,
        invalidReason: validation?.invalidReason,
        validatedBy: 'openai',
        model: 'gpt-4o-mini'
      };
    } catch (error) {
      console.error(`[OpenAI] Error validating ${code}:`, error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return openaiValidationService.isAvailable();
  }
}

export class AIValidationService {
  private providers: ValidationProvider[] = [];
  private currentProviderIndex = 0;

  constructor() {
    this.providers = [
      new GeminiProvider(),
      new OpenAIProvider()
    ];
  }

  async validateCode(code: string): Promise<ValidationResult> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.providers.length; i++) {
      const providerIndex = (this.currentProviderIndex + i) % this.providers.length;
      const provider = this.providers[providerIndex];

      if (!provider.isAvailable()) {
        console.log(`[AIValidation] ${provider.name} not available, skipping`);
        continue;
      }

      try {
        const result = await provider.validateCode(code);
        return result;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message;

        if (errorMessage === 'quota_exceeded') {
          console.log(`[AIValidation] ${provider.name} quota exceeded, trying next provider`);
          this.currentProviderIndex = (providerIndex + 1) % this.providers.length;
          continue;
        }

        console.error(`[AIValidation] ${provider.name} error:`, error);
      }
    }

    console.error('[AIValidation] All providers failed');
    
    return {
      isValid: true,
      reason: 'All AI services failed - needs manual review',
      validatedBy: 'failed',
      model: 'unknown'
    };
  }

  async validateBatch(codes: string[], onProgress?: (processed: number) => void): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();
    let processed = 0;

    for (const code of codes) {
      try {
        const result = await this.validateCode(code);
        results.set(code, result);
      } catch (error) {
        console.error(`[AIValidation] Failed to validate ${code}:`, error);
        results.set(code, {
          isValid: true,
          reason: 'Validation error - assumed valid',
          validatedBy: 'error',
          model: 'unknown'
        });
      }

      processed++;
      if (onProgress) {
        onProgress(processed);
      }
    }

    return results;
  }

  getAvailableProviders(): string[] {
    return this.providers
      .filter(p => p.isAvailable())
      .map(p => p.name);
  }
}

export const aiValidationService = new AIValidationService();