import fs from 'fs';
import path from 'path';

export interface ValidationCacheEntry {
  isValid: boolean;
  reason?: string;
  timestamp: number;
  validatedBy?: string;
  model?: string;
  invalidReason?: string;
}

export interface CacheConfig {
  cacheFile?: string;
  cacheTTL?: number;
  legacyCacheTTL?: number;
  treatLegacyAsStale?: boolean;
  cacheReloadInterval?: number;
}

export class ValidationCacheService {
  private readonly cacheFile: string;
  private readonly cacheTTL: number;
  private readonly legacyCacheTTL: number;
  private readonly treatLegacyAsStale: boolean;
  private readonly cacheReloadInterval: number;
  
  private memoryCache: Map<string, ValidationCacheEntry> | null = null;
  private cacheLastLoaded = 0;
  private cacheLock = false;

  constructor(config: CacheConfig = {}) {
    this.cacheFile = config.cacheFile || path.join(process.cwd(), 'temp-cache.json');
    this.cacheTTL = config.cacheTTL || 4 * 30 * 24 * 60 * 60 * 1000; // 4 months
    this.legacyCacheTTL = config.legacyCacheTTL || 7 * 24 * 60 * 60 * 1000; // 7 days
    this.treatLegacyAsStale = config.treatLegacyAsStale ?? (process.env.TREAT_LEGACY_CACHE_AS_STALE === 'true');
    this.cacheReloadInterval = config.cacheReloadInterval || 5 * 60 * 1000; // 5 minutes
  }

  private async acquireLock(): Promise<void> {
    while (this.cacheLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.cacheLock = true;
  }

  private releaseLock(): void {
    this.cacheLock = false;
  }

  private loadCacheFromFile(): Map<string, ValidationCacheEntry> {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf8');
        const parsed = JSON.parse(data) as Record<string, ValidationCacheEntry>;
        const cacheMap = new Map<string, ValidationCacheEntry>();
        
        let legacyCount = 0;
        let modernCount = 0;
        
        Object.entries(parsed).forEach(([code, entry]) => {
          if (!entry.validatedBy || !entry.model) {
            cacheMap.set(code, {
              ...entry,
              validatedBy: 'unknown',
              model: 'legacy-unknown'
            });
            legacyCount++;
          } else {
            cacheMap.set(code, entry);
            modernCount++;
          }
        });
        
        console.log(`[ValidationCache] Loaded ${cacheMap.size} entries (${modernCount} modern, ${legacyCount} legacy)`);
        
        if (legacyCount > 0) {
          console.log(`[ValidationCache] Migrating ${legacyCount} legacy entries`);
          this.saveCacheToFile(cacheMap);
        }
        
        return cacheMap;
      }
    } catch (error) {
      console.warn('[ValidationCache] Error loading cache file:', error);
    }
    return new Map();
  }

  private saveCacheToFile(cache: Map<string, ValidationCacheEntry>): void {
    try {
      const data = Object.fromEntries(cache);
      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('[ValidationCache] Error saving cache file:', error);
    }
  }

  private async getOrLoadCache(): Promise<Map<string, ValidationCacheEntry>> {
    const now = Date.now();
    
    if (!this.memoryCache || (now - this.cacheLastLoaded) > this.cacheReloadInterval) {
      await this.acquireLock();
      try {
        if (!this.memoryCache || (now - this.cacheLastLoaded) > this.cacheReloadInterval) {
          console.log('[ValidationCache] Loading cache from file');
          this.memoryCache = this.loadCacheFromFile();
          this.cacheLastLoaded = now;
        }
      } finally {
        this.releaseLock();
      }
    }
    
    return this.memoryCache!;
  }

  async get(code: string): Promise<ValidationCacheEntry | null> {
    const cache = await this.getOrLoadCache();
    const entry = cache.get(code);
    
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    const isLegacy = entry.model === 'legacy-unknown';
    let isExpired = age >= this.cacheTTL;
    
    if (isLegacy) {
      if (this.treatLegacyAsStale) {
        isExpired = true;
        console.log(`[ValidationCache] Legacy entry for ${code} treated as stale`);
      } else {
        isExpired = age >= this.legacyCacheTTL;
      }
    }

    if (isExpired) {
      return null;
    }

    const cacheType = isLegacy ? 'legacy' : entry.model || 'unknown';
    console.log(`[ValidationCache] Cache hit for ${code} (${cacheType})`);
    
    return entry;
  }

  async set(code: string, entry: Omit<ValidationCacheEntry, 'timestamp'>): Promise<void> {
    await this.acquireLock();
    try {
      const cache = await this.getOrLoadCache();
      cache.set(code, {
        ...entry,
        timestamp: Date.now()
      });
      
      console.log(`[ValidationCache] Stored ${code} (${entry.validatedBy} using ${entry.model})`);
      this.saveCacheToFile(cache);
    } finally {
      this.releaseLock();
    }
  }

  async getBulk(codes: string[]): Promise<{
    cached: Map<string, ValidationCacheEntry>;
    missing: string[];
  }> {
    const cached = new Map<string, ValidationCacheEntry>();
    const missing: string[] = [];

    for (const code of codes) {
      const entry = await this.get(code);
      if (entry) {
        cached.set(code, entry);
      } else {
        missing.push(code);
      }
    }

    return { cached, missing };
  }

  async setBulk(entries: Array<{ code: string; entry: Omit<ValidationCacheEntry, 'timestamp'> }>): Promise<void> {
    await this.acquireLock();
    try {
      const cache = await this.getOrLoadCache();
      const now = Date.now();
      
      for (const { code, entry } of entries) {
        cache.set(code, {
          ...entry,
          timestamp: now
        });
      }
      
      console.log(`[ValidationCache] Stored ${entries.length} entries in bulk`);
      this.saveCacheToFile(cache);
    } finally {
      this.releaseLock();
    }
  }

  async getStats(): Promise<{
    totalEntries: number;
    modernEntries: number;
    legacyEntries: number;
    validEntries: number;
    invalidEntries: number;
  }> {
    const cache = await this.getOrLoadCache();
    let modernEntries = 0;
    let legacyEntries = 0;
    let validEntries = 0;
    let invalidEntries = 0;

    for (const [, entry] of cache) {
      if (entry.model === 'legacy-unknown') {
        legacyEntries++;
      } else {
        modernEntries++;
      }
      
      if (entry.isValid) {
        validEntries++;
      } else {
        invalidEntries++;
      }
    }

    return {
      totalEntries: cache.size,
      modernEntries,
      legacyEntries,
      validEntries,
      invalidEntries
    };
  }

  async clear(): Promise<void> {
    await this.acquireLock();
    try {
      this.memoryCache = new Map();
      this.saveCacheToFile(this.memoryCache);
      console.log('[ValidationCache] Cache cleared');
    } finally {
      this.releaseLock();
    }
  }

  async clearStale(): Promise<number> {
    await this.acquireLock();
    try {
      const cache = await this.getOrLoadCache();
      const now = Date.now();
      let removed = 0;

      for (const [code, entry] of cache) {
        const age = now - entry.timestamp;
        const isLegacy = entry.model === 'legacy-unknown';
        let isExpired = age >= this.cacheTTL;
        
        if (isLegacy && !this.treatLegacyAsStale) {
          isExpired = age >= this.legacyCacheTTL;
        }

        if (isExpired) {
          cache.delete(code);
          removed++;
        }
      }

      if (removed > 0) {
        this.saveCacheToFile(cache);
        console.log(`[ValidationCache] Removed ${removed} stale entries`);
      }

      return removed;
    } finally {
      this.releaseLock();
    }
  }
}

export const validationCacheService = new ValidationCacheService();