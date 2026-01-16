'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore, GameEvent } from '@/store/survival';

const eventStyles: Record<GameEvent['type'], { bg: string; border: string; text: string }> = {
  action: { bg: 'bg-gradient-to-r from-emerald-50 to-green-50', border: 'border-emerald-400', text: 'text-emerald-700' },
  thought: { bg: 'bg-gradient-to-r from-blue-50 to-cyan-50', border: 'border-blue-400', text: 'text-blue-700' },
  environmental: { bg: 'bg-gradient-to-r from-purple-50 to-violet-50', border: 'border-purple-400', text: 'text-purple-700' },
  danger: { bg: 'bg-gradient-to-r from-red-50 to-rose-50', border: 'border-red-400', text: 'text-red-700' },
  success: { bg: 'bg-gradient-to-r from-green-50 to-emerald-50', border: 'border-green-400', text: 'text-green-700' },
  failure: { bg: 'bg-gradient-to-r from-orange-50 to-amber-50', border: 'border-orange-400', text: 'text-orange-700' },
  resource: { bg: 'bg-gradient-to-r from-yellow-50 to-amber-50', border: 'border-yellow-400', text: 'text-yellow-700' },
};

const sourceColors: Record<GameEvent['source'], string> = {
  god: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  survivor: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white',
  system: 'bg-gradient-to-r from-gray-400 to-gray-500 text-white',
  world: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white',
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameEvents]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl border-4 border-white/50 shadow-2xl shadow-blue-500/10 flex flex-col"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b-2 border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.span
              className="text-3xl"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              📜
            </motion.span>
            <h3 className="text-xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Adventure Log
            </h3>
          </div>
          <span className="px-4 py-1.5 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full text-sm font-bold text-blue-700">
            {gameEvents.length} events
          </span>
        </div>
      </div>

      {/* Events */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ maxHeight: '350px' }}
      >
        <AnimatePresence initial={false}>
          {gameEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <motion.span
                className="text-6xl mb-4"
                animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🌲
              </motion.span>
              <p className="text-gray-400 font-semibold">Loading survival adventure...</p>
            </div>
          ) : (
            gameEvents.map((event) => {
              const style = eventStyles[event.type];
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -30, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.3 }}
                  className={`${style.bg} border-l-4 ${style.border} rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start gap-3">
                    <motion.span
                      className="text-2xl flex-shrink-0"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500 }}
                    >
                      {event.emoji}
                    </motion.span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${sourceColors[event.source]}`}>
                          {event.source}
                        </span>
                        <span className="text-xs font-medium text-gray-400">{formatTime(event.timestamp)}</span>
                      </div>
                      <p className={`text-sm font-medium ${style.text}`}>{event.content}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Live indicator */}
      <AnimatePresence>
        {gameEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-5 py-3 border-t-2 border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50"
          >
            <div className="flex items-center gap-2">
              <motion.div
                className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-green-500"
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-sm font-bold text-emerald-700">Live feed active</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
