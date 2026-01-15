'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore, GameEvent } from '@/store/survival';

const eventStyles: Record<GameEvent['type'], { bg: string; border: string; icon: string }> = {
  action: { bg: 'bg-green-900/30', border: 'border-green-500/30', icon: '🎯' },
  thought: { bg: 'bg-blue-900/30', border: 'border-blue-500/30', icon: '💭' },
  environmental: { bg: 'bg-purple-900/30', border: 'border-purple-500/30', icon: '🌲' },
  danger: { bg: 'bg-red-900/30', border: 'border-red-500/30', icon: '⚠️' },
  success: { bg: 'bg-emerald-900/30', border: 'border-emerald-500/30', icon: '✅' },
  failure: { bg: 'bg-orange-900/30', border: 'border-orange-500/30', icon: '❌' },
  resource: { bg: 'bg-yellow-900/30', border: 'border-yellow-500/30', icon: '📦' },
};

const sourceColors: Record<GameEvent['source'], string> = {
  god: 'text-red-400',
  survivor: 'text-green-400',
  system: 'text-gray-400',
  world: 'text-purple-400',
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function GameLog() {
  const { gameEvents } = useSurvivalStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameEvents]);

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-gray-700/50 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📜</span>
            <h3 className="text-white font-bold">Event Log</h3>
          </div>
          <span className="text-xs text-gray-500">{gameEvents.length} events</span>
        </div>
      </div>

      {/* Events list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        style={{ maxHeight: '400px' }}
      >
        <AnimatePresence initial={false}>
          {gameEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 text-sm italic">Waiting for game to start...</p>
            </div>
          ) : (
            gameEvents.map((event) => {
              const style = eventStyles[event.type];
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className={`${style.bg} ${style.border} border rounded-lg p-2 overflow-hidden`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">{event.emoji || style.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium uppercase ${sourceColors[event.source]}`}>
                          {event.source}
                        </span>
                        <span className="text-xs text-gray-500">{formatTime(event.timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-200 break-words">{event.content}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Typing indicator when game is processing */}
      <AnimatePresence>
        {gameEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-2 border-t border-gray-700/50"
          >
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                ●
              </motion.span>
              <span>Live feed active</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
