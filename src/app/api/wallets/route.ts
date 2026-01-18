import { NextRequest, NextResponse } from 'next/server';
import { walletDb, DbWallet } from '@/lib/db';

// GET /api/wallets - Get all wallets
export async function GET() {
  try {
    const wallets = walletDb.getAll();
    return NextResponse.json({ wallets });
  } catch (error) {
    console.error('Failed to get wallets:', error);
    return NextResponse.json({ error: 'Failed to get wallets' }, { status: 500 });
  }
}

// POST /api/wallets - Create new wallets
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallets } = body as { wallets: DbWallet[] };

    if (!wallets || !Array.isArray(wallets)) {
      return NextResponse.json({ error: 'Invalid wallets data' }, { status: 400 });
    }

    walletDb.insertMany(wallets);
    return NextResponse.json({ success: true, count: wallets.length });
  } catch (error) {
    console.error('Failed to create wallets:', error);
    return NextResponse.json({ error: 'Failed to create wallets' }, { status: 500 });
  }
}

// PATCH /api/wallets - Update wallet(s)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body as { updates: { publicKey: string; funded?: number; balance?: number }[] };

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Invalid update data' }, { status: 400 });
    }

    walletDb.updateMany(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update wallets:', error);
    return NextResponse.json({ error: 'Failed to update wallets' }, { status: 500 });
  }
}

// DELETE /api/wallets - Delete all wallets or specific wallet
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const publicKey = searchParams.get('publicKey');

    if (publicKey) {
      const deleted = walletDb.delete(publicKey);
      return NextResponse.json({ success: deleted });
    } else {
      walletDb.deleteAll();
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Failed to delete wallets:', error);
    return NextResponse.json({ error: 'Failed to delete wallets' }, { status: 500 });
  }
}
