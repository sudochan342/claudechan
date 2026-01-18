import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  if (!mint) {
    return NextResponse.json({ error: 'Mint address required' }, { status: 400 });
  }

  // List of PumpFun API endpoints to try
  const endpoints = [
    `https://frontend-api.pump.fun/coins/${mint}`,
    `https://client-api-2-74b1891ee9f9.herokuapp.com/coins/${mint}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        next: { revalidate: 0 }, // Don't cache
      });

      if (response.ok) {
        const data = await response.json();
        if (data && (data.mint || data.name)) {
          return NextResponse.json(data);
        }
      }
    } catch (e) {
      console.error(`Failed to fetch from ${endpoint}:`, e);
    }
  }

  // If all endpoints fail, return error with details
  return NextResponse.json(
    { error: 'Token not found on PumpFun. Make sure the token is a PumpFun token (not Raydium).' },
    { status: 404 }
  );
}
