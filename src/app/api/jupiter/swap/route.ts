import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.quoteResponse || !body.userPublicKey) {
      return NextResponse.json(
        { error: 'Missing required fields: quoteResponse, userPublicKey' },
        { status: 400 }
      );
    }

    // Use the public Jupiter API from server-side
    const response = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse: body.quoteResponse,
        userPublicKey: body.userPublicKey,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: body.prioritizationFeeLamports || 'auto',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Jupiter swap error:', response.status, data);
      return NextResponse.json(
        { error: data.error || `Jupiter API error: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Jupiter swap proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build swap' },
      { status: 500 }
    );
  }
}
