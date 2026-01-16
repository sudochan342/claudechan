import { NextRequest } from 'next/server';
import { addAdvice, getRecentAdvice } from '@/lib/shared-game';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST - Submit advice to Claude
export async function POST(request: NextRequest) {
  try {
    const { advice } = await request.json();

    if (!advice || typeof advice !== 'string' || advice.trim().length === 0) {
      return Response.json({ error: 'Advice is required' }, { status: 400 });
    }

    if (advice.length > 200) {
      return Response.json({ error: 'Advice too long (max 200 chars)' }, { status: 400 });
    }

    addAdvice(advice.trim());

    return Response.json({
      success: true,
      message: 'Advice sent to Claude!'
    });
  } catch (error) {
    console.error('Advice API error:', error);
    return Response.json({ error: 'Failed to submit advice' }, { status: 500 });
  }
}

// GET - Get recent advice (for display)
export async function GET() {
  const advice = getRecentAdvice();
  return Response.json({ advice });
}
