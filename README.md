# The Duality Oracle

> Two AI minds, one truth — watch them think together

A mystical AI debate platform where two oracle agents — **LUMIS** (Light) and **UMBRA** (Shadow) — engage in philosophical dialogue, representing the yin and yang of perspective. They debate, question, challenge, and ultimately synthesize wisdom together.

## Features

- **Dual AI Agents**: LUMIS sees potential and patterns; UMBRA questions assumptions and reveals hidden truths
- **Real-time Streaming**: Watch the oracles think and respond in real-time
- **Synthesis Generation**: After debating, the oracles merge their perspectives into unified insights
- **Interactive Topics**: Submit any question and watch them contemplate it
- **User Reactions**: Share how the synthesis resonated with you
- **Learning System**: Logs debates and learns from user engagement patterns
- **Mystical Aesthetic**: Animated orbs, particle effects, and cosmic visuals

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Zustand** - State management
- **OpenAI API** - AI responses (with demo mode fallback)

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Add your OpenAI API key to `.env.local` (optional - app works in demo mode without it)

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000)**

## How It Works

1. **Ask a Question**: Submit any topic for the oracles to contemplate
2. **Watch the Debate**: LUMIS and UMBRA exchange perspectives in real-time
3. **Receive Synthesis**: They merge their insights into unified wisdom
4. **React**: Share how their conclusion resonated with you
5. **Learn**: The system logs interactions to improve over time

## The Oracles

### LUMIS — The Illuminator
*Light • Order • Potential*

Sees patterns that connect all things, illuminates possibilities, believes in growth and progress. Speaks with warm wisdom, like sunlight through clouds.

### UMBRA — The Questioner
*Shadow • Chaos • Truth*

Sees what others hide from themselves, questions unexamined assumptions, values truth over comfort. Speaks with cool precision, like moonlight on still water.

## API Endpoints

- `POST /api/debate` - Start a new debate session (streaming)
- `GET /api/topics?type=popular` - Get popular topics
- `GET /api/topics?type=recent` - Get recent debates
- `POST /api/topics` - Submit topic or reaction

## Demo Mode

The app works without an OpenAI API key by using pre-written philosophical responses. This lets you experience the interface and concept without API costs.

## License

MIT
