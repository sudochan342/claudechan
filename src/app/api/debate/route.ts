import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { LUMIS, UMBRA, SYNTHESIS_PROMPT } from '@/lib/agents';
import { saveDebateLog } from '@/lib/logging.server';

// Use OpenRouter API (compatible with OpenAI SDK)
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': 'The Duality Oracle',
  },
});

// For demo mode when no API key
const DEMO_RESPONSES = {
  lumis: [
    "I see threads of potential weaving through this question. Every challenge contains within it the seeds of transformation.",
    "The patterns here speak of evolution, not stagnation. What appears as conflict often catalyzes growth.",
    "There is architecture in this chaos - a structure waiting to be recognized and built upon.",
  ],
  umbra: [
    "But have we examined what we sacrifice in this pursuit? Every path forward casts shadows we must acknowledge.",
    "The comfortable answer rarely survives scrutiny. What assumptions hide beneath this optimism?",
    "Truth does not bend to our preferences. We must ask what this vision costs those who cannot share it.",
  ],
  synthesis: [
    "Together we see: The path forward requires both the courage to build and the wisdom to question. In the dance of light and shadow, we find not compromise, but completeness.",
    "Together we see: Neither hope nor caution alone serves truth. The answer lies in holding both - building with clear eyes, questioning with open hearts.",
  ],
};

function getRandomDemo(type: 'lumis' | 'umbra' | 'synthesis'): string {
  const responses = DEMO_RESPONSES[type];
  return responses[Math.floor(Math.random() * responses.length)];
}

export async function POST(request: NextRequest) {
  const { topic, conversationHistory = [] } = await request.json();

  if (!topic) {
    return new Response('Topic is required', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const debateId = `debate_${Date.now()}`;
        const messages: Array<{ agent: string; content: string }> = [];

        // Determine how many rounds based on history
        const rounds = conversationHistory.length === 0 ? 2 : 1;
        const generateSynthesis = conversationHistory.length >= 2 || rounds === 2;

        for (let round = 0; round < rounds; round++) {
          // LUMIS speaks
          sendEvent({ type: 'agent_start', agent: 'lumis' });

          const lumisContent = await generateAgentResponse(
            LUMIS.systemPrompt,
            topic,
            [...conversationHistory, ...messages],
            'lumis'
          );

          messages.push({ agent: 'lumis', content: lumisContent });
          sendEvent({ type: 'agent_message', agent: 'lumis', content: lumisContent });

          // Small pause for dramatic effect
          await new Promise(r => setTimeout(r, 500));

          // UMBRA responds
          sendEvent({ type: 'agent_start', agent: 'umbra' });

          const umbraContent = await generateAgentResponse(
            UMBRA.systemPrompt,
            topic,
            [...conversationHistory, ...messages],
            'umbra'
          );

          messages.push({ agent: 'umbra', content: umbraContent });
          sendEvent({ type: 'agent_message', agent: 'umbra', content: umbraContent });

          await new Promise(r => setTimeout(r, 500));
        }

        // Generate synthesis
        if (generateSynthesis) {
          sendEvent({ type: 'agent_start', agent: 'synthesis' });

          const synthesisContent = await generateSynthesis_(
            topic,
            [...conversationHistory, ...messages]
          );

          sendEvent({ type: 'synthesis', content: synthesisContent });

          // Log the complete debate
          await saveDebateLog({
            id: debateId,
            topic,
            messages: [...conversationHistory, ...messages].map((m, i) => ({
              id: `msg_${i}`,
              agent: m.agent as 'lumis' | 'umbra',
              content: m.content,
              timestamp: Date.now(),
            })),
            synthesis: synthesisContent,
            createdAt: Date.now(),
            userReactions: { agree: 0, disagree: 0, mindblown: 0 },
          });
        }

        sendEvent({ type: 'complete' });
        controller.close();

      } catch (error) {
        console.error('Debate error:', error);
        sendEvent({ type: 'error', message: 'The oracles are momentarily silent. Please try again.' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function generateAgentResponse(
  systemPrompt: string,
  topic: string,
  history: Array<{ agent: string; content: string }>,
  currentAgent: 'lumis' | 'umbra'
): Promise<string> {
  // Demo mode if no API key
  if (!process.env.OPENROUTER_API_KEY) {
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
    return getRandomDemo(currentAgent);
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `The topic for contemplation: "${topic}"` },
  ];

  // Add conversation history
  for (const msg of history) {
    const role = msg.agent === currentAgent ? 'assistant' : 'user';
    const prefix = msg.agent === 'lumis' ? '[LUMIS]: ' : '[UMBRA]: ';
    messages.push({ role, content: prefix + msg.content });
  }

  if (history.length > 0) {
    messages.push({
      role: 'user',
      content: `Continue the dialogue. Respond to what ${history[history.length - 1].agent === 'lumis' ? 'LUMIS' : 'UMBRA'} said. Be concise.`
    });
  }

  const response = await openrouter.chat.completions.create({
    model: 'openai/gpt-4o-mini', // OpenRouter model format
    messages,
    max_tokens: 150,
    temperature: 0.8,
  });

  return response.choices[0]?.message?.content || 'The oracle is silent...';
}

async function generateSynthesis_(
  topic: string,
  history: Array<{ agent: string; content: string }>
): Promise<string> {
  // Demo mode if no API key
  if (!process.env.OPENROUTER_API_KEY) {
    await new Promise(r => setTimeout(r, 1500));
    return getRandomDemo('synthesis');
  }

  const conversationText = history
    .map(m => `${m.agent.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const response = await openrouter.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [
      { role: 'system', content: SYNTHESIS_PROMPT },
      { role: 'user', content: `Topic: "${topic}"\n\nDebate:\n${conversationText}\n\nProvide the synthesis.` },
    ],
    max_tokens: 150,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || 'The synthesis remains hidden in the mist...';
}
