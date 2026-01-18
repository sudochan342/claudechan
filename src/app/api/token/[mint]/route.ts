import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  if (!mint) {
    return NextResponse.json({ error: 'Mint address required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://frontend-api.pump.fun/coins/${mint}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; PumpFunBot/1.0)',
      },
    });

    if (!response.ok) {
      // Try alternative API endpoint
      const altResponse = await fetch(`https://client-api-2-74b1891ee9f9.herokuapp.com/coins/${mint}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!altResponse.ok) {
        return NextResponse.json({ error: 'Token not found' }, { status: 404 });
      }

      const data = await altResponse.json();
      return NextResponse.json(data);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Token lookup error:', error);
    return NextResponse.json({ error: 'Failed to fetch token info' }, { status: 500 });
  }
}
