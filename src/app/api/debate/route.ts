import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { LUMIS_PROMPT, UMBRA_PROMPT, SYNTHESIS_PROMPT } from '@/lib/agents';

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': 'DUAL - AI Debate Agents',
  },
});

// Demo responses when no API key
const DEMO = {
  lumis: [
    "We're literally so early on this. The people fading now will be the same ones fomo'ing at 10x.",
    "Chart looks exactly like ETH in 2020. Few will understand until it's too late.",
    "Everyone's bearish which means we're about to rip. This is the accumulation zone.",
  ],
  umbra: [
    "Ah yes, the classic 'we're early' cope. You know who else was early? Luna buyers.",
    "That chart copium is crazy. You can make any chart look like anything if you squint hard enough.",
    "The only thing ripping is your portfolio. Smart money already exited while you were posting rocket emojis.",
  ],
  synthesis: [
    "The play: Both sides coping hard. Size your position like you might be wrong, because you probably are.",
    "Real talk: The narrative has legs but the valuation doesn't. Trade the narrative, don't marry it.",
  ],
};

function getDemo(type: 'lumis' | 'umbra' | 'synthesis'): string {
  const arr = DEMO[type];
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(request: NextRequest) {
  const { topic, conversationHistory = [] } = await request.json();

  if (!topic) {
    return new Response('Topic required', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const messages: Array<{ agent: string; content: string }> = [];

        // 2 rounds of debate
        for (let round = 0; round < 2; round++) {
          // LUMIS
          send({ type: 'start', agent: 'lumis' });
          const lumis = await generate(LUMIS_PROMPT, topic, [...conversationHistory, ...messages], 'lumis');
          messages.push({ agent: 'lumis', content: lumis });
          send({ type: 'message', agent: 'lumis', content: lumis });
          await delay(300);

          // UMBRA
          send({ type: 'start', agent: 'umbra' });
          const umbra = await generate(UMBRA_PROMPT, topic, [...conversationHistory, ...messages], 'umbra');
          messages.push({ agent: 'umbra', content: umbra });
          send({ type: 'message', agent: 'umbra', content: umbra });
          await delay(300);
        }

        // Synthesis
        send({ type: 'start', agent: 'synthesis' });
        const synthesis = await generateSynthesis(topic, messages);
        send({ type: 'synthesis', content: synthesis });

        send({ type: 'done' });
        controller.close();
      } catch (err) {
        console.error('Debate error:', err);
        send({ type: 'error', message: 'Agents are offline. Try again.' });
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

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function generate(
  systemPrompt: string,
  topic: string,
  history: Array<{ agent: string; content: string }>,
  currentAgent: 'lumis' | 'umbra'
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    await delay(800 + Math.random() * 800);
    return getDemo(currentAgent);
  }

  const msgs: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Topic: "${topic}"` },
  ];

  for (const m of history) {
    const role = m.agent === currentAgent ? 'assistant' : 'user';
    const prefix = m.agent === 'lumis' ? 'LUMIS: ' : 'UMBRA: ';
    msgs.push({ role, content: prefix + m.content });
  }

  if (history.length > 0) {
    msgs.push({
      role: 'user',
      content: `Respond to ${history[history.length - 1].agent === 'lumis' ? 'LUMIS' : 'UMBRA'}. Keep it short and punchy.`
    });
  }

  const res = await openrouter.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: msgs,
    max_tokens: 100,
    temperature: 0.9,
  });

  return res.choices[0]?.message?.content || '...';
}

async function generateSynthesis(
  topic: string,
  history: Array<{ agent: string; content: string }>
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    await delay(1000);
    return getDemo('synthesis');
  }

  const conv = history.map(m => `${m.agent.toUpperCase()}: ${m.content}`).join('\n');

  const res = await openrouter.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [
      { role: 'system', content: SYNTHESIS_PROMPT },
      { role: 'user', content: `Topic: "${topic}"\n\nDebate:\n${conv}\n\nSynthesize.` },
    ],
    max_tokens: 80,
    temperature: 0.7,
  });

  return res.choices[0]?.message?.content || 'No alpha found.';
}
