// CPT Cache Service - DISABLED (Server-side cache only)
export interface CPTCacheEntry {
  code: string;
  isValid: boolean;
  reason?: string;
  description?: string;
  category?: string;
  validatedDate: string; // ISO date when this was validated by AI
  validatedBy: 'ai' | 'manual'; // Source of validation
  model?: string; // LLM model used for validation (e.g., 'gemini-2.5-flash', 'gpt-4o-mini')
  invalidReason?: string; // AI-generated concise reason why code is invalid (one sentence)
  confidence: number; // 0-1 confidence score
  hitCount: number; // How many times this code has been validated
  lastAccessed: string; // ISO date when last accessed
}

export interface CPTCacheStats {
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  staleEntries: number;
  cacheHitRate: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}

class CPTCacheService {
  /**
   * DISABLED: Browser localStorage cache not used - server-side cache only
   */
  storeCPTResults(results: Array<{
    code: string;
    isValid: boolean;
    reason?: string;
    description?: string;
    category?: string;
    confidence?: number;
    model?: string;
    invalidReason?: string;
  }>): void {
    // DISABLED: No browser-side cache - using server-side cache only
    console.log(`[CPT Cache] DISABLED: Would have stored ${results.length} results`);
  }

  /**
   * DISABLED: Browser localStorage cache not used - server-side cache only
   */
  getCPTValidation(code: string): CPTCacheEntry | null {
    // DISABLED: No browser-side cache - using server-side cache only
    console.log(`[CPT Cache] DISABLED: Would look up ${code}`);
    return null;
  }

  /**
   * DISABLED: Browser localStorage cache not used - server-side cache only
   */
  getBulkCPTValidations(codes: string[]): {
    cached: { [code: string]: CPTCacheEntry };
    missing: string[];
    stale: string[];
  } {
    // DISABLED: No browser-side cache - using server-side cache only
    return {
      cached: {},
      missing: codes,
      stale: []
    };
  }

  /**
   * DISABLED: Browser localStorage cache not used - server-side cache only
   */
  getStaleEntries(): CPTCacheEntry[] {
    // DISABLED: No browser-side cache - using server-side cache only
    return [];
  }

  /**
   * DISABLED: Browser localStorage cache not used - server-side cache only
   */
  updateStaleCodes(codes: string[]): number {
    // DISABLED: No browser-side cache - using server-side cache only
    console.log(`[CPT Cache] DISABLED: Would update ${codes.length} codes`);
    return 0;
  }

  /**
   * DISABLED: Browser localStorage cache not used - server-side cache only
   */
  getCacheStats(): CPTCacheStats {
    // DISABLED: No browser-side cache - using server-side cache only
    return {
      totalEntries: 0,
      validEntries: 0,
      invalidEntries: 0,
      staleEntries: 0,
      cacheHitRate: 0,
      oldestEntry: null,
      newestEntry: null
    };
  }

  /**
   * DISABLED: Browser localStorage cache not used - server-side cache only
   */
  clearStaleEntries(): number {
    // DISABLED: No browser-side cache - using server-side cache only
    return 0;
  }

  /**
   * DISABLED: Browser localStorage cache not used - server-side cache only
   */
  clearCache(): void {
    // DISABLED: No browser-side cache - using server-side cache only
    console.log('[CPT Cache] DISABLED: No browser cache to clear');
  }

  /**
   * DISABLED: Browser localStorage cache not used - server-side cache only
   */
  exportCache(): string {
    // DISABLED: No browser-side cache - using server-side cache only
    return JSON.stringify({ cache: {}, stats: this.getCacheStats() });
  }

  /**
   * DISABLED: Browser localStorage cache not used - server-side cache only
   */
  importCache(jsonData: string): boolean {
    // DISABLED: No browser-side cache - using server-side cache only
    console.log(`[CPT Cache] DISABLED: Cannot import ${jsonData.length} chars to browser cache`);
    return false;
  }
}

// Export singleton instance
export const cptCacheService = new CPTCacheService();