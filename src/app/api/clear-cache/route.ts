import { NextRequest, NextResponse } from 'next/server';
import { validationCacheService } from '@/services/validationCacheService';

export async function GET() {
  try {
    const stats = await validationCacheService.getStats();
    
    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[Get Cache Stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache stats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { clearStaleOnly = false } = body;

    if (clearStaleOnly) {
      const removedCount = await validationCacheService.clearStale();
      const remainingStats = await validationCacheService.getStats();
      
      return NextResponse.json({
        success: true,
        message: `Cleared ${removedCount} stale cache entries. ${remainingStats.totalEntries} entries remain.`,
        removedCount,
        remainingCount: remainingStats.totalEntries
      });
    } else {
      const stats = await validationCacheService.getStats();
      console.log(`[Clear Cache] Clearing cache with ${stats.totalEntries} entries`);
      
      await validationCacheService.clear();
      
      return NextResponse.json({
        success: true,
        message: `Successfully cleared cache with ${stats.totalEntries} entries`,
        previousStats: stats
      });
    }
  } catch (error) {
    console.error('[Clear Cache] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}