'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebateStore } from '@/store/debate';
import { SEED_TOPICS } from '@/lib/logging';

export default function TopicInput() {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { setTopic, isDebating } = useDebateStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isDebating) {
      setTopic(input.trim());
      setInput('');
      setShowSuggestions(false);
    }
  };

  const selectTopic = (topic: string) => {
    setTopic(topic);
    setInput('');
    setShowSuggestions(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto relative">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-violet-500/20 rounded-2xl blur-xl" />

          <div className="relative flex gap-2 p-2 bg-gray-900/80 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Ask the oracles a question..."
              disabled={isDebating}
              className="flex-1 px-4 py-3 bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none text-lg"
            />
            <motion.button
              type="submit"
              disabled={!input.trim() || isDebating}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-violet-500 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isDebating ? (
                <span className="flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    ◎
                  </motion.span>
                  Debating...
                </span>
              ) : (
                'Consult'
              )}
            </motion.button>
          </div>
        </div>
      </form>

      {/* Topic suggestions */}
      <AnimatePresence>
        {showSuggestions && !isDebating && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 p-4 bg-gray-900/95 rounded-xl border border-gray-700/50 backdrop-blur-sm z-10"
          >
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-gray-400">Suggested topics:</p>
              <button
                onClick={() => setShowSuggestions(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SEED_TOPICS.slice(0, 6).map((topic, i) => (
                <motion.button
                  key={i}
                  onClick={() => selectTopic(topic)}
                  className="px-3 py-1.5 text-sm bg-gray-800/50 text-gray-300 rounded-lg border border-gray-700/50 hover:border-purple-500/50 hover:text-purple-300 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {topic.length > 40 ? topic.slice(0, 40) + '...' : topic}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
