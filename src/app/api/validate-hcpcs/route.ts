import { NextRequest, NextResponse } from 'next/server';
import { hcpcsValidationOrchestrator } from '@/services/hcpcsValidationOrchestrator';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface ValidationRequest {
  codes: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { codes }: ValidationRequest = await request.json();

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: 'Invalid codes array' }, { status: 400 });
    }

    console.log(`[HCPCS Route] Validating ${codes.length} codes`);

    // Create streaming response using the orchestrator
    const stream = hcpcsValidationOrchestrator.createValidationStream(codes);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[HCPCS Route] Error:', error);
    return NextResponse.json(
      { error: 'Failed to validate HCPCS codes' },
      { status: 500 }
    );
  }
}