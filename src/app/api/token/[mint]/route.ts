import { NextResponse } from 'next/server';

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  liquidity?: {
    usd: number;
  };
  fdv?: number;
  marketCap?: number;
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  if (!mint) {
    return NextResponse.json({ error: 'Mint address required' }, { status: 400 });
  }

  // Try PumpFun API endpoints first
  const pumpfunEndpoints = [
    `https://frontend-api-v3.pump.fun/coins/${mint}`,
    `https://frontend-api.pump.fun/coins/${mint}`,
  ];

  for (const endpoint of pumpfunEndpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && (data.mint || data.name)) {
          return NextResponse.json(data);
        }
      }
    } catch (e) {
      // Continue to next endpoint
    }
  }

  // Fallback to DexScreener API
  try {
    const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (dexResponse.ok) {
      const dexData: DexScreenerResponse = await dexResponse.json();

      if (dexData.pairs && dexData.pairs.length > 0) {
        // Find the pair (prefer pumpfun/raydium on solana)
        const pair = dexData.pairs.find(p => p.chainId === 'solana') || dexData.pairs[0];

        // Convert to our format
        const tokenInfo = {
          mint: pair.baseToken.address,
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
          market_cap: pair.marketCap || pair.fdv || 0,
          usd_market_cap: pair.marketCap || pair.fdv || 0,
          // Default reserves for calculation (will use slippage)
          virtual_sol_reserves: 30 * 1e9,
          virtual_token_reserves: 1000000000 * 1e6,
        };

        return NextResponse.json(tokenInfo);
      }
    }
  } catch (e) {
    console.error('DexScreener lookup failed:', e);
  }

  return NextResponse.json(
    { error: 'Token not found. Make sure the mint address is correct.' },
    { status: 404 }
  );
}
