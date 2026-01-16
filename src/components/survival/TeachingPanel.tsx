'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';

const QUICK_TIPS = [
  { label: '🏠 Build shelter', advice: 'You should prioritize building a shelter to protect from weather and predators.' },
  { label: '💧 Find water', advice: 'Look for a water source - survival depends on staying hydrated.' },
  { label: '🍎 Gather food', advice: 'Collect berries and try to catch fish before your hunger gets too low.' },
  { label: '🔧 Make tools', advice: 'Craft basic tools from sticks and stones to improve your efficiency.' },
  { label: '🔥 Start fire', advice: 'Fire provides warmth, light, and a way to cook food. Make it a priority.' },
  { label: '🏃 Run away', advice: 'If you see predators, retreat and hide rather than fight unprepared.' },
  { label: '😴 Rest at night', advice: 'Rest during the night when predators are most active.' },
  { label: '🗺️ Explore', advice: 'Scout new areas during the day and always mark your path.' },
];

interface SentAdvice {
  id: string;
  advice: string;
  timestamp: number;
}

export function TeachingPanel() {
  const { isPlaying } = useSurvivalStore();
  const [customAdvice, setCustomAdvice] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [sentAdvice, setSentAdvice] = useState<SentAdvice[]>([]);

  const handleSubmitAdvice = (advice: string) => {
    if (!advice.trim() || !isPlaying) return;

    // Add to local sent advice list (display only for now)
    const newAdvice: SentAdvice = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      advice,
      timestamp: Date.now(),
    };
    setSentAdvice(prev => [...prev.slice(-2), newAdvice]);

    setCustomAdvice('');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl border-4 border-white/50 shadow-2xl shadow-amber-500/10 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 border-b-2 border-gray-100">
        <div className="flex items-center gap-3">
          <motion.span
            className="text-3xl"
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🎓
          </motion.span>
          <div>
            <h3 className="font-black text-lg bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              SURVIVAL TIPS
            </h3>
            <p className="text-xs font-semibold text-gray-500">Help Claude survive!</p>
          </div>
          <span className="ml-auto px-3 py-1 bg-gradient-to-r from-amber-100 to-orange-100 rounded-full text-xs font-bold text-amber-700">
            Viewer Support
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Quick tips */}
        <div>
          <h4 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
            <span>⚡</span> Quick Tips
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_TIPS.map((tip, i) => (
              <motion.button
                key={i}
                onClick={() => handleSubmitAdvice(tip.advice)}
                disabled={!isPlaying}
                whileHover={{ scale: isPlaying ? 1.03 : 1, y: isPlaying ? -2 : 0 }}
                whileTap={{ scale: isPlaying ? 0.97 : 1 }}
                className={`text-left px-3 py-2.5 rounded-xl text-sm transition-all font-semibold ${
                  isPlaying
                    ? 'bg-gradient-to-r from-gray-50 to-gray-100 hover:from-amber-50 hover:to-orange-50 text-gray-700 border-2 border-gray-200 hover:border-amber-300 shadow-sm'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-100'
                }`}
              >
                {tip.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Custom advice */}
        <div>
          <h4 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
            <span>✏️</span> Custom Advice
          </h4>
          <div className="relative">
            <textarea
              value={customAdvice}
              onChange={(e) => setCustomAdvice(e.target.value)}
              placeholder={isPlaying ? "Type survival advice for Claude..." : "Waiting for game to connect..."}
              disabled={!isPlaying}
              className={`w-full px-4 py-3 rounded-xl text-sm resize-none h-24 transition-all font-medium ${
                isPlaying
                  ? 'bg-gray-50 text-gray-800 border-2 border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 placeholder-gray-400'
                  : 'bg-gray-100 text-gray-400 border-2 border-gray-100 cursor-not-allowed placeholder-gray-300'
              }`}
              maxLength={200}
            />
            <div className="absolute bottom-3 right-3 text-xs font-medium text-gray-400">
              {customAdvice.length}/200
            </div>
          </div>
          <motion.button
            onClick={() => handleSubmitAdvice(customAdvice)}
            disabled={!isPlaying || !customAdvice.trim()}
            whileHover={{ scale: isPlaying && customAdvice.trim() ? 1.02 : 1 }}
            whileTap={{ scale: isPlaying && customAdvice.trim() ? 0.98 : 1 }}
            className={`w-full mt-3 py-3 rounded-xl font-bold text-sm transition-all ${
              isPlaying && customAdvice.trim()
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            🚀 Send Tip to Chat
          </motion.button>
        </div>

        {/* Recent advice sent */}
        {sentAdvice.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
              <span>📝</span> Your Tips
            </h4>
            <div className="space-y-2">
              {sentAdvice.map((advice) => (
                <motion.div
                  key={advice.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs px-4 py-3 rounded-xl border-2 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-700"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">💡</span>
                    <span className="font-medium">{advice.advice.slice(0, 70)}{advice.advice.length > 70 ? '...' : ''}</span>
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
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl px-4 py-3 text-center shadow-lg"
            >
              <span className="text-white font-bold flex items-center justify-center gap-2">
                <span className="text-xl">✅</span>
                Tip submitted!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
