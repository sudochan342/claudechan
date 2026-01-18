import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');
  const slippageBps = searchParams.get('slippageBps') || '500';

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: 'Missing required parameters: inputMint, outputMint, amount' },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps,
    });

    // Use the new Jupiter Swap API v1 endpoint (v6 was deprecated Oct 2025)
    const url = `https://lite-api.jup.ag/swap/v1/quote?${params}`;
    console.log('Fetching Jupiter quote:', url);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('Jupiter quote response status:', response.status);

    if (!response.ok) {
      console.error('Jupiter quote error:', response.status, responseText);
      return NextResponse.json(
        { error: `Jupiter API error ${response.status}: ${responseText}` },
        { status: response.status }
      );
    }

    const data = JSON.parse(responseText);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Jupiter quote proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}
