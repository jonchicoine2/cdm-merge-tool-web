// HCPCS Data Service - Fetches and manages local HCPCS code storage
export interface HCPCSCode {
  code: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  effectiveDate: string;
  terminationDate?: string;
  actionCode: string; // A=Add, C=Change, D=Delete
}

export interface HCPCSModifier {
  modifier: string;
  description: string;
  effectiveDate: string;
  terminationDate?: string;
}

export interface HCPCSDataset {
  codes: HCPCSCode[];
  modifiers: HCPCSModifier[];
  lastUpdated: string;
  version: string;
}

class HCPCSDataService {
  private readonly STORAGE_KEY = 'hcpcs_local_data';
  private readonly VERSION_KEY = 'hcpcs_data_version';
  private readonly UPDATE_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  /**
   * Downloads latest HCPCS data using our API endpoint
   */
  async fetchLatestHCPCSData(): Promise<HCPCSDataset> {
    try {
      console.log('[HCPCS Service] Fetching latest HCPCS data from API');

      const response = await fetch('/api/fetch-hcpcs-data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        console.warn('[HCPCS Service] API returned error, using fallback data');
        return result.fallbackData;
      }

      console.log(`[HCPCS Service] Successfully fetched ${result.data.codes.length} codes from API`);
      return result.data;
      
    } catch (error) {
      console.error('[HCPCS Service] Failed to fetch HCPCS data from API:', error);
      throw new Error('Failed to fetch latest HCPCS data');
    }
  }

  /**
   * Forces a refresh of HCPCS data from the API
   */
  async refreshData(): Promise<HCPCSDataset> {
    console.log('[HCPCS Service] Force refreshing HCPCS data');
    
    try {
      const response = await fetch('/api/fetch-hcpcs-data?refresh=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        console.warn('[HCPCS Service] API returned error during refresh, using fallback data');
        return result.fallbackData;
      }

      const freshData = result.data;
      this.cacheData(freshData);
      return freshData;
      
    } catch (error) {
      console.error('[HCPCS Service] Failed to refresh HCPCS data:', error);
      throw new Error('Failed to refresh HCPCS data');
    }
  }

  /**
   * Gets cached HCPCS data from localStorage
   */
  getCachedData(): HCPCSDataset | null {
    try {
      const cached = localStorage.getItem(this.STORAGE_KEY);
      if (!cached) return null;
      
      const data = JSON.parse(cached) as HCPCSDataset;
      
      // Check if data is still fresh
      const lastUpdated = new Date(data.lastUpdated);
      const now = new Date();
      const timeDiff = now.getTime() - lastUpdated.getTime();
      
      if (timeDiff > this.UPDATE_INTERVAL) {
        console.log('[HCPCS Service] Cached data is stale, needs refresh');
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('[HCPCS Service] Error reading cached data:', error);
      return null;
    }
  }

  /**
   * Stores HCPCS data in localStorage
   */
  cacheData(data: HCPCSDataset): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(this.VERSION_KEY, data.version);
      console.log(`[HCPCS Service] Cached ${data.codes.length} codes, version ${data.version}`);
    } catch (error) {
      console.error('[HCPCS Service] Error caching data:', error);
    }
  }

  /**
   * Gets or fetches HCPCS data (cache-first approach)
   */
  async getHCPCSData(): Promise<HCPCSDataset> {
    // Try cache first
    const cached = this.getCachedData();
    if (cached) {
      console.log(`[HCPCS Service] Using cached data version ${cached.version}`);
      return cached;
    }

    // Fetch fresh data
    console.log('[HCPCS Service] Fetching fresh HCPCS data');
    const freshData = await this.fetchLatestHCPCSData();
    
    // Cache the fresh data
    this.cacheData(freshData);
    
    return freshData;
  }

  /**
   * Validates a single HCPCS code against local data
   */
  async validateCode(inputCode: string): Promise<{
    isValid: boolean;
    reason?: string;
    codeInfo?: HCPCSCode;
    modifierInfo?: HCPCSModifier;
  }> {
    const data = await this.getHCPCSData();
    const cleanCode = inputCode.trim().toUpperCase();
    
    // Parse code and modifier
    const { baseCode, modifier } = this.parseCode(cleanCode);
    
    // Check base code
    const codeRecord = data.codes.find(c => c.code === baseCode);
    if (!codeRecord) {
      return {
        isValid: false,
        reason: `HCPCS code '${baseCode}' not found in local database`
      };
    }

    // Check if code is terminated
    if (codeRecord.terminationDate) {
      const termDate = new Date(codeRecord.terminationDate);
      const now = new Date();
      if (termDate < now) {
        return {
          isValid: false,
          reason: `HCPCS code '${baseCode}' was terminated on ${codeRecord.terminationDate}`,
          codeInfo: codeRecord
        };
      }
    }

    // Check modifier if present
    let modifierInfo: HCPCSModifier | undefined;
    if (modifier) {
      modifierInfo = data.modifiers.find(m => m.modifier === modifier);
      if (!modifierInfo) {
        return {
          isValid: false,
          reason: `Modifier '${modifier}' not found in local database`,
          codeInfo: codeRecord
        };
      }

      // Check if modifier is terminated
      if (modifierInfo.terminationDate) {
        const termDate = new Date(modifierInfo.terminationDate);
        const now = new Date();
        if (termDate < now) {
          return {
            isValid: false,
            reason: `Modifier '${modifier}' was terminated on ${modifierInfo.terminationDate}`,
            codeInfo: codeRecord,
            modifierInfo
          };
        }
      }
    }

    return {
      isValid: true,
      codeInfo: codeRecord,
      modifierInfo
    };
  }

  /**
   * Parses a code to separate base code and modifier
   */
  private parseCode(code: string): { baseCode: string; modifier: string } {
    // Handle format: XXXXX-YY
    if (code.includes('-')) {
      const parts = code.split('-');
      return {
        baseCode: parts[0],
        modifier: parts[1] || ''
      };
    }

    // Handle format: XXXXXYY (modifier appended)
    if (code.length > 5) {
      return {
        baseCode: code.substring(0, 5),
        modifier: code.substring(5)
      };
    }

    return {
      baseCode: code,
      modifier: ''
    };
  }

  /**
   * Gets current quarter (1-4) based on date
   */
  private getCurrentQuarter(date: Date): number {
    const month = date.getMonth() + 1; // 0-based to 1-based
    return Math.ceil(month / 3);
  }

  /**
   * Gets previous quarter
   */
  private getPreviousQuarter(quarter: number): number {
    return quarter === 1 ? 4 : quarter - 1;
  }

  /**
   * Converts quarter number to name
   */
  private getQuarterName(quarter: number): string {
    const names = ['', 'January', 'April', 'July', 'October'];
    return names[quarter];
  }

  /**
   * Gets current cached version
   */
  getCachedVersion(): string | null {
    return localStorage.getItem(this.VERSION_KEY);
  }

  /**
   * Clears cached data
   */
  clearCache(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.VERSION_KEY);
    console.log('[HCPCS Service] Cache cleared');
  }
}

// Export singleton instance
export const hcpcsDataService = new HCPCSDataService(); 