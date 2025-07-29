import { validationCacheService, ValidationCacheEntry } from './validationCacheService';
import { aiValidationService, ValidationResult } from './aiValidationService';
import { streamingResponseService } from './streamingResponseService';

export interface ValidationRequest {
  codes: string[];
}

export interface ValidationResponse {
  invalidCodes: string[];
  validationResults: { [code: string]: { isValid: boolean; reason?: string } };
  quotaWarning?: string;
  manualReviewWarning?: string;
  cacheStats?: {
    cacheHits: number;
    aiValidations: number;
  };
}

export class HCPCSValidationOrchestrator {
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_DELAY = 200; // ms

  async validateCodes(codes: string[]): Promise<ValidationResponse> {
    const uniqueCodes = this.preprocessCodes(codes);
    console.log(`[Orchestrator] Validating ${uniqueCodes.length} unique codes`);

    const invalidCodes: string[] = [];
    const validationResults: { [code: string]: { isValid: boolean; reason?: string } } = {};
    let cacheHits = 0;
    let aiValidations = 0;
    let quotaErrors = 0;
    let manualReviewCount = 0;

    const { cached, missing } = await validationCacheService.getBulk(uniqueCodes);
    
    for (const [code, entry] of cached) {
      cacheHits++;
      validationResults[code] = {
        isValid: entry.isValid,
        reason: entry.reason
      };
      
      if (!entry.isValid) {
        invalidCodes.push(code);
      }
    }

    console.log(`[Orchestrator] Cache hits: ${cacheHits}, Missing: ${missing.length}`);

    if (missing.length > 0) {
      const aiResults = await this.validateWithAI(missing);
      
      const cacheEntries: Array<{ code: string; entry: Omit<ValidationCacheEntry, 'timestamp'> }> = [];
      
      for (const [code, result] of aiResults) {
        aiValidations++;
        
        validationResults[code] = {
          isValid: result.isValid,
          reason: result.reason
        };
        
        if (!result.isValid) {
          invalidCodes.push(code);
        }

        if (result.reason?.includes('quota')) {
          quotaErrors++;
        }
        
        if (result.reason?.includes('manual review')) {
          manualReviewCount++;
        }

        if (!result.reason?.includes('manual review') && !result.reason?.includes('error')) {
          cacheEntries.push({
            code,
            entry: {
              isValid: result.isValid,
              reason: result.reason,
              validatedBy: result.validatedBy,
              model: result.model,
              invalidReason: result.invalidReason
            }
          });
        }
      }

      if (cacheEntries.length > 0) {
        await validationCacheService.setBulk(cacheEntries);
      }
    }

    this.logValidationStats(uniqueCodes.length, invalidCodes.length, cacheHits, aiValidations);

    return {
      invalidCodes,
      validationResults,
      ...(quotaErrors > 0 ? { quotaWarning: `${quotaErrors} codes hit API quota limits` } : {}),
      ...(manualReviewCount > 0 ? { manualReviewWarning: `${manualReviewCount} codes need manual review` } : {}),
      cacheStats: {
        cacheHits,
        aiValidations
      }
    };
  }

  createValidationStream(codes: string[]): ReadableStream {
    return streamingResponseService.createStream(async (sendProgress) => {
      const uniqueCodes = this.preprocessCodes(codes);
      const totalCodes = uniqueCodes.length;
      
      let processedCount = 0;
      const updateProgress = () => {
        sendProgress({
          type: 'progress',
          processed: processedCount,
          total: totalCodes
        });
      };

      updateProgress();

      const invalidCodes: string[] = [];
      const validationResults: { [code: string]: { isValid: boolean; reason?: string } } = {};
      let cacheHits = 0;
      let aiValidations = 0;
      let quotaErrors = 0;
      let manualReviewCount = 0;

      const { cached, missing } = await validationCacheService.getBulk(uniqueCodes);
      
      for (const [code, entry] of cached) {
        cacheHits++;
        processedCount++;
        
        validationResults[code] = {
          isValid: entry.isValid,
          reason: entry.reason
        };
        
        if (!entry.isValid) {
          invalidCodes.push(code);
        }
        
        updateProgress();
      }

      if (missing.length > 0) {
        // Process codes in batches with proper progress updates
        for (let i = 0; i < missing.length; i += this.BATCH_SIZE) {
          const batch = missing.slice(i, Math.min(i + this.BATCH_SIZE, missing.length));
          
          const batchPromises = batch.map(async (code) => {
            try {
              const result = await aiValidationService.validateCode(code);
              aiValidations++;
              
              validationResults[code] = {
                isValid: result.isValid,
                reason: result.reason
              };
              
              if (!result.isValid) {
                invalidCodes.push(code);
              }

              if (result.reason?.includes('quota')) {
                quotaErrors++;
              }
              
              if (result.reason?.includes('manual review')) {
                manualReviewCount++;
              }

              if (!result.reason?.includes('manual review') && !result.reason?.includes('error')) {
                await validationCacheService.set(code, {
                  isValid: result.isValid,
                  reason: result.reason,
                  validatedBy: result.validatedBy,
                  model: result.model,
                  invalidReason: result.invalidReason
                });
              }

              processedCount++;
              updateProgress(); // Send progress update after each code
              return result;
            } catch (error) {
              console.error(`[Orchestrator] Failed to validate ${code}:`, error);
              processedCount++;
              updateProgress();
              return null;
            }
          });
          
          await Promise.all(batchPromises);
          
          // Delay between batches
          if (i + this.BATCH_SIZE < missing.length) {
            await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
          }
        }
      }

      this.logValidationStats(uniqueCodes.length, invalidCodes.length, cacheHits, aiValidations);

      return {
        invalidCodes,
        validationResults,
        ...(quotaErrors > 0 ? { quotaWarning: `${quotaErrors} codes hit API quota limits` } : {}),
        ...(manualReviewCount > 0 ? { manualReviewWarning: `${manualReviewCount} codes need manual review` } : {}),
        cacheStats: {
          cacheHits,
          aiValidations
        }
      };
    });
  }

  private preprocessCodes(codes: string[]): string[] {
    const uniqueCodes = [...new Set(codes.map(code => String(code).trim().toUpperCase()))]
      .filter(code => code.length > 0)
      .sort();
    
    return uniqueCodes;
  }

  private async validateWithAI(codes: string[]): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();
    
    for (let i = 0; i < codes.length; i += this.BATCH_SIZE) {
      const batch = codes.slice(i, Math.min(i + this.BATCH_SIZE, codes.length));
      console.log(`[Orchestrator] Processing AI batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(codes.length / this.BATCH_SIZE)}`);
      
      const batchPromises = batch.map(code => 
        aiValidationService.validateCode(code)
          .then(result => results.set(code, result))
          .catch(error => {
            console.error(`[Orchestrator] Failed to validate ${code}:`, error);
            results.set(code, {
              isValid: true,
              reason: 'Validation error - assumed valid',
              validatedBy: 'error',
              model: 'unknown'
            });
          })
      );
      
      await Promise.all(batchPromises);
      
      if (i + this.BATCH_SIZE < codes.length) {
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
      }
    }
    
    return results;
  }

  private logValidationStats(total: number, invalid: number, cacheHits: number, aiValidations: number): void {
    console.log(`[Orchestrator] Validation complete: ${invalid}/${total} invalid`);
    console.log(`[Orchestrator] Cache hits: ${cacheHits}, AI validations: ${aiValidations}`);
    
    const invalidRate = invalid / total;
    if (invalidRate > 0.3 && total > 10) {
      console.warn(`[Orchestrator] WARNING: ${(invalidRate * 100).toFixed(1)}% invalid rate may indicate false positives`);
    }
  }
}

export const hcpcsValidationOrchestrator = new HCPCSValidationOrchestrator();