'use client';

import { useEffect, useState } from 'react';
import DebateChamber from '@/components/DebateChamber';
import LiveFeed from '@/components/LiveFeed';
import { TOKEN_INFO } from '@/lib/agents';

// Generate stars deterministically
const stars = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  left: ((i * 37) % 100),
  top: ((i * 53) % 100),
  size: (i % 3) + 1,
  delay: (i % 5) * 0.5,
  duration: 2 + (i % 3),
}));

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Deep space background */}
      <div className="fixed inset-0">
        {/* Base gradient - deep space */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, #0a0a1a 0%, #000000 100%)',
          }}
        />

        {/* Nebula effect - gold side */}
        <div
          className="absolute top-0 left-0 w-full h-full opacity-40"
          style={{
            background: 'radial-gradient(ellipse at 20% 30%, rgba(251,191,36,0.15) 0%, transparent 50%)',
          }}
        />

        {/* Nebula effect - purple side */}
        <div
          className="absolute top-0 right-0 w-full h-full opacity-40"
          style={{
            background: 'radial-gradient(ellipse at 80% 30%, rgba(139,92,246,0.15) 0%, transparent 50%)',
          }}
        />

        {/* Central convergence glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]"
          style={{
            background: 'radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Animated aurora waves */}
        {mounted && (
          <>
            <div
              className="absolute top-0 left-0 w-full h-1/2 opacity-20 animate-pulse"
              style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(251,191,36,0.1) 50%, transparent 100%)',
                animationDuration: '4s',
              }}
            />
            <div
              className="absolute bottom-0 right-0 w-full h-1/2 opacity-20 animate-pulse"
              style={{
                background: 'linear-gradient(0deg, transparent 0%, rgba(139,92,246,0.1) 50%, transparent 100%)',
                animationDuration: '5s',
                animationDelay: '1s',
              }}
            />
          </>
        )}

        {/* Star field */}
        <div className="absolute inset-0">
          {stars.map((star) => (
            <div
              key={star.id}
              className="absolute rounded-full bg-white animate-pulse"
              style={{
                left: `${star.left}%`,
                top: `${star.top}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: 0.3 + (star.size * 0.2),
                animationDelay: `${star.delay}s`,
                animationDuration: `${star.duration}s`,
                boxShadow: star.size > 2 ? '0 0 4px rgba(255,255,255,0.5)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Floating dust particles */}
        {mounted && (
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={`dust-${i}`}
                className="absolute w-1 h-1 rounded-full animate-float"
                style={{
                  left: `${(i * 5) % 100}%`,
                  top: `${(i * 7) % 100}%`,
                  backgroundColor: i % 2 === 0 ? 'rgba(251,191,36,0.3)' : 'rgba(139,92,246,0.3)',
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: `${10 + (i % 5)}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 100%)',
          }}
        />
      </div>

      {/* Live Feed Sidebar */}
      <LiveFeed />

      {/* Main Content */}
      <main className="relative z-10">
        <DebateChamber />
      </main>

      {/* Footer with Token Branding */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="flex items-center justify-center gap-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">☀</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-violet-400 bg-clip-text text-transparent tracking-wider">
              {TOKEN_INFO.ticker}
            </span>
            <span className="text-violet-400">☾</span>
          </div>
        </div>
        <p className="text-center text-xs text-gray-600 pb-2 tracking-widest">
          {TOKEN_INFO.tagline}
        </p>
      </footer>
    </div>
  );
}
