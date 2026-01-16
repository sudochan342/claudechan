// Server-Sent Events endpoint for shared game state
// All viewers connect here and watch the same game

import { subscribe, getGameState, GameState } from '@/lib/shared-game';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const initialState = getGameState();
      const initialData = `data: ${JSON.stringify(initialState)}\n\n`;
      controller.enqueue(encoder.encode(initialData));

      // Subscribe to updates
      const unsubscribe = subscribe((state: GameState) => {
        try {
          const data = `data: ${JSON.stringify(state)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (e) {
          // Stream closed
          unsubscribe();
        }
      });

      // Handle client disconnect (this is a bit tricky with ReadableStream)
      // The stream will naturally close when the client disconnects
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
