import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const CACHE_FILE = path.join(process.cwd(), 'temp-cache.json');
    
    if (!fs.existsSync(CACHE_FILE)) {
      return NextResponse.json({
        totalEntries: 0,
        modernEntries: 0,
        legacyEntries: 0,
        modelBreakdown: {},
        cacheFile: 'not found'
      });
    }
    
    const data = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(data) as Record<string, { 
      isValid: boolean; 
      reason?: string; 
      timestamp: number; 
      validatedBy?: string; 
      model?: string;
      invalidReason?: string;
    }>;
    
    let modernEntries = 0;
    let legacyEntries = 0;
    let validEntries = 0;
    let invalidEntries = 0;
    const modelBreakdown: Record<string, number> = {};
    const validityBreakdown = { valid: 0, invalid: 0 };
    
    Object.values(parsed).forEach(entry => {
      // Track validity
      if (entry.isValid) {
        validEntries++;
        validityBreakdown.valid++;
      } else {
        invalidEntries++;
        validityBreakdown.invalid++;
      }
      
      // Track model info
      if (entry.validatedBy && entry.model && entry.model !== 'legacy-unknown') {
        modernEntries++;
        modelBreakdown[entry.model] = (modelBreakdown[entry.model] || 0) + 1;
      } else {
        legacyEntries++;
        modelBreakdown['legacy-unknown'] = (modelBreakdown['legacy-unknown'] || 0) + 1;
      }
    });
    
    return NextResponse.json({
      totalEntries: Object.keys(parsed).length,
      modernEntries,
      legacyEntries,
      validEntries,
      invalidEntries,
      modelBreakdown,
      validityBreakdown,
      cacheFile: 'exists'
    });
    
  } catch (error) {
    console.error('[CACHE STATS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache statistics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { clearLegacyOnly = false, clearInvalidOnly = false } = body;

    const CACHE_FILE = path.join(process.cwd(), 'temp-cache.json');
    
    if (clearInvalidOnly) {
      // Clear only invalid entries (keep valid ones)
      if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, 'utf8');
        const parsed = JSON.parse(data) as Record<string, { 
          isValid: boolean; 
          reason?: string; 
          timestamp: number; 
          validatedBy?: string; 
          model?: string;
          invalidReason?: string;
        }>;
        
        let removedCount = 0;
        const filtered: typeof parsed = {};
        
        Object.entries(parsed).forEach(([code, entry]) => {
          if (entry.isValid) {
            // Keep valid entries
            filtered[code] = entry;
          } else {
            // Remove invalid entries
            removedCount++;
          }
        });
        
        fs.writeFileSync(CACHE_FILE, JSON.stringify(filtered, null, 2));
        console.log(`[CLEAR CACHE] Removed ${removedCount} invalid entries, kept ${Object.keys(filtered).length} valid entries`);
        
        return NextResponse.json({ 
          success: true, 
          message: `Cleared ${removedCount} invalid cache entries. Valid entries preserved.`,
          removedCount,
          remainingCount: Object.keys(filtered).length
        });
      } else {
        return NextResponse.json({ 
          success: true, 
          message: 'No cache file found to clean.',
          removedCount: 0,
          remainingCount: 0
        });
      }
    } else if (clearLegacyOnly) {
      // Clear only legacy entries without model information
      if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, 'utf8');
        const parsed = JSON.parse(data) as Record<string, { 
          isValid: boolean; 
          reason?: string; 
          timestamp: number; 
          validatedBy?: string; 
          model?: string;
          invalidReason?: string;
        }>;
        
        let removedCount = 0;
        const filtered: typeof parsed = {};
        
        Object.entries(parsed).forEach(([code, entry]) => {
          if (entry.validatedBy && entry.model && entry.model !== 'legacy-unknown') {
            // Keep modern entries with model info
            filtered[code] = entry;
          } else {
            // Remove legacy entries
            removedCount++;
          }
        });
        
        fs.writeFileSync(CACHE_FILE, JSON.stringify(filtered, null, 2));
        console.log(`[CLEAR CACHE] Removed ${removedCount} legacy entries, kept ${Object.keys(filtered).length} modern entries`);
        
        return NextResponse.json({ 
          success: true, 
          message: `Cleared ${removedCount} legacy cache entries. Modern entries preserved.`,
          removedCount,
          remainingCount: Object.keys(filtered).length
        });
      } else {
        return NextResponse.json({ 
          success: true, 
          message: 'No cache file found to clean.',
          removedCount: 0,
          remainingCount: 0
        });
      }
    } else {
      // Clear entire cache file
      if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
        console.log('[CLEAR CACHE] Deleted temp-cache.json');
      }

      // Reset the module-level cache by restarting (this will happen when dev server reloads)
      console.log('[CLEAR CACHE] Server-side cache will be cleared on next request');

      return NextResponse.json({ 
        success: true, 
        message: 'All server-side caches cleared. Please also clear browser cache (localStorage) manually.' 
      });
    }

  } catch (error) {
    console.error('[CLEAR CACHE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}