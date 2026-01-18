import { NextRequest, NextResponse } from 'next/server';
import { holdingsDb, DbHolding } from '@/lib/db';

// GET /api/holdings - Get holdings by token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenMint = searchParams.get('token');
    const walletAddress = searchParams.get('wallet');

    if (tokenMint) {
      const holdings = holdingsDb.getByToken(tokenMint);
      return NextResponse.json({ holdings });
    } else if (walletAddress) {
      const holdings = holdingsDb.getByWallet(walletAddress);
      return NextResponse.json({ holdings });
    } else {
      return NextResponse.json({ error: 'Specify token or wallet parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to get holdings:', error);
    return NextResponse.json({ error: 'Failed to get holdings' }, { status: 500 });
  }
}

// POST /api/holdings - Save holdings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { holdings } = body as { holdings: DbHolding[] };

    if (!holdings || !Array.isArray(holdings)) {
      return NextResponse.json({ error: 'Invalid holdings data' }, { status: 400 });
    }

    holdingsDb.upsertMany(holdings);
    return NextResponse.json({ success: true, count: holdings.length });
  } catch (error) {
    console.error('Failed to save holdings:', error);
    return NextResponse.json({ error: 'Failed to save holdings' }, { status: 500 });
  }
}

// DELETE /api/holdings - Delete holdings
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenMint = searchParams.get('token');
    const walletAddress = searchParams.get('wallet');
    const all = searchParams.get('all');

    if (all === 'true') {
      holdingsDb.deleteAll();
    } else if (tokenMint) {
      holdingsDb.deleteByToken(tokenMint);
    } else if (walletAddress) {
      holdingsDb.deleteByWallet(walletAddress);
    } else {
      return NextResponse.json({ error: 'Specify token, wallet, or all parameter' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete holdings:', error);
    return NextResponse.json({ error: 'Failed to delete holdings' }, { status: 500 });
  }
}
