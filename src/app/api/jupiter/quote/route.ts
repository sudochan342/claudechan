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

    // Use the public Jupiter API from server-side (no CORS issues)
    const response = await fetch(`https://quote-api.jup.ag/v6/quote?${params}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Jupiter quote error:', response.status, data);
      return NextResponse.json(
        { error: data.error || `Jupiter API error: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Jupiter quote proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}
