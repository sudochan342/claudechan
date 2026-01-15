'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';

const QUICK_TIPS = [
  { label: 'Build shelter', advice: 'You should prioritize building a shelter to protect from weather and predators.' },
  { label: 'Find water', advice: 'Look for a water source - survival depends on staying hydrated.' },
  { label: 'Gather food', advice: 'Collect berries and try to catch fish before your hunger gets too low.' },
  { label: 'Make tools', advice: 'Craft basic tools from sticks and stones to improve your efficiency.' },
  { label: 'Start fire', advice: 'Fire provides warmth, light, and a way to cook food. Make it a priority.' },
  { label: 'Avoid threats', advice: 'If you see predators, retreat and hide rather than fight unprepared.' },
  { label: 'Rest wisely', advice: 'Rest during the night when predators are most active.' },
  { label: 'Explore carefully', advice: 'Scout new areas during the day and always mark your path.' },
];

export function TeachingPanel() {
  const { isPlaying, userAdvice, addUserAdvice, addChatMessage, addGameEvent } = useSurvivalStore();
  const [customAdvice, setCustomAdvice] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmitAdvice = (advice: string) => {
    if (!advice.trim() || !isPlaying) return;

    addUserAdvice(advice);

    // Add to chat
    addChatMessage({
      username: 'Viewer',
      message: `💡 TIP: ${advice.slice(0, 50)}${advice.length > 50 ? '...' : ''}`,
      color: '#60a5fa',
    });

    // Add game event
    addGameEvent({
      source: 'system',
      type: 'resource',
      content: `Viewer advice received: "${advice.slice(0, 80)}${advice.length > 80 ? '...' : ''}"`,
      emoji: '💡',
    });

    setCustomAdvice('');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const recentAdvice = userAdvice.slice(-3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <h3 className="font-bold text-white">Teach Claude</h3>
          <span className="ml-auto text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
            AI Learning
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Give Claude survival advice and watch it learn!
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick tips */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Quick Tips</h4>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_TIPS.map((tip, i) => (
              <motion.button
                key={i}
                onClick={() => handleSubmitAdvice(tip.advice)}
                disabled={!isPlaying}
                whileHover={{ scale: isPlaying ? 1.02 : 1 }}
                whileTap={{ scale: isPlaying ? 0.98 : 1 }}
                className={`text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  isPlaying
                    ? 'bg-gray-800/80 hover:bg-gray-700/80 text-gray-300 hover:text-white border border-gray-700/50 hover:border-blue-500/30'
                    : 'bg-gray-800/40 text-gray-500 cursor-not-allowed border border-gray-800/50'
                }`}
              >
                <span className="block font-medium">{tip.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Custom advice */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Custom Advice</h4>
          <div className="relative">
            <textarea
              value={customAdvice}
              onChange={(e) => setCustomAdvice(e.target.value)}
              placeholder={isPlaying ? "Type survival advice for Claude..." : "Start the game to send advice"}
              disabled={!isPlaying}
              className={`w-full px-3 py-2 rounded-lg text-sm resize-none h-20 transition-all ${
                isPlaying
                  ? 'bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 placeholder-gray-500'
                  : 'bg-gray-800/50 text-gray-500 border border-gray-800 cursor-not-allowed placeholder-gray-600'
              }`}
              maxLength={200}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500">
              {customAdvice.length}/200
            </div>
          </div>
          <motion.button
            onClick={() => handleSubmitAdvice(customAdvice)}
            disabled={!isPlaying || !customAdvice.trim()}
            whileHover={{ scale: isPlaying && customAdvice.trim() ? 1.02 : 1 }}
            whileTap={{ scale: isPlaying && customAdvice.trim() ? 0.98 : 1 }}
            className={`w-full mt-2 py-2 rounded-lg font-medium text-sm transition-all ${
              isPlaying && customAdvice.trim()
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-500/20'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            Send Advice to Claude
          </motion.button>
        </div>

        {/* Recent advice */}
        {recentAdvice.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Recent Advice Sent</h4>
            <div className="space-y-2">
              {recentAdvice.map((advice) => (
                <motion.div
                  key={advice.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`text-xs px-3 py-2 rounded-lg border ${
                    advice.applied
                      ? 'bg-green-900/20 border-green-500/30 text-green-300'
                      : 'bg-gray-800/50 border-gray-700/50 text-gray-400'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span>{advice.applied ? '✅' : '⏳'}</span>
                    <span className="flex-1">{advice.advice.slice(0, 80)}{advice.advice.length > 80 ? '...' : ''}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Success notification */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-2 text-center"
            >
              <span className="text-green-400 text-sm font-medium">
                ✅ Advice sent to Claude!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
