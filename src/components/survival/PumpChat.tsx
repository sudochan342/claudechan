'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';

// Simulated viewer usernames and their colors
const FAKE_USERS = [
  { name: 'degen_andy', color: '#f97316' },
  { name: 'pump_it_up', color: '#22c55e' },
  { name: 'survival_chad', color: '#3b82f6' },
  { name: 'forest_watcher', color: '#a855f7' },
  { name: 'claude_fan_01', color: '#ec4899' },
  { name: 'ape_strong', color: '#eab308' },
  { name: 'moon_boi', color: '#14b8a6' },
  { name: 'diamond_hands', color: '#ef4444' },
  { name: 'paper_trader', color: '#6366f1' },
  { name: 'ai_believer', color: '#f472b6' },
  { name: 'crypto_karen', color: '#84cc16' },
  { name: 'wagmi_wizard', color: '#06b6d4' },
  { name: 'ngmi_ned', color: '#f59e0b' },
  { name: 'based_bob', color: '#8b5cf6' },
  { name: 'anon_whale', color: '#10b981' },
];

const REACTION_MESSAGES = [
  { trigger: 'danger', messages: ['RUN CLAUDE RUN!!! 😱', 'oh no oh no oh no', 'F in chat', 'HES COOKED 💀', 'NGMI', 'bro is done 😭'] },
  { trigger: 'success', messages: ['LETS GOOOO 🚀', 'WAGMI', 'based claude', 'chad move', 'absolute unit', 'W'] },
  { trigger: 'food', messages: ['eat up king 👑', 'monch monch', 'hungry boi fed', 'FOOD ARC'] },
  { trigger: 'fight', messages: ['FIGHT FIGHT FIGHT', 'Violence!! 🔥', 'claude chose violence today', 'bonk time'] },
  { trigger: 'rest', messages: ['sleepy boi', 'zzz', 'rest arc best arc', 'self care king'] },
  { trigger: 'general', messages: ['lol', 'kek', 'interesting...', 'nice', 'this is peak content', 'i love this', 'claude gaming', 'based', 'lets see how this goes', 'omg', '👀', '🔥', '💀', 'wen moon', 'claude is HIM'] },
];

function getRandomUser() {
  return FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)];
}

function getRandomMessage(trigger: string = 'general') {
  const category = REACTION_MESSAGES.find(r => r.trigger === trigger) || REACTION_MESSAGES.find(r => r.trigger === 'general')!;
  return category.messages[Math.floor(Math.random() * category.messages.length)];
}

export function PumpChat() {
  const { chatMessages, addChatMessage, viewerCount, setViewerCount, isPlaying, gameEvents } = useSurvivalStore();
  const [userMessage, setUserMessage] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Simulate viewer count fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(viewerCount + Math.floor(Math.random() * 20) - 10);
    }, 5000);
    return () => clearInterval(interval);
  }, [viewerCount, setViewerCount]);

  // Simulate fake chat messages
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      // Determine message type based on recent events
      const lastEvent = gameEvents[gameEvents.length - 1];
      let trigger = 'general';

      if (lastEvent) {
        if (lastEvent.type === 'danger') trigger = 'danger';
        else if (lastEvent.type === 'success') trigger = 'success';
        else if (lastEvent.content.toLowerCase().includes('food') || lastEvent.content.toLowerCase().includes('eat') || lastEvent.content.toLowerCase().includes('berr')) trigger = 'food';
        else if (lastEvent.content.toLowerCase().includes('fight') || lastEvent.content.toLowerCase().includes('attack')) trigger = 'fight';
        else if (lastEvent.content.toLowerCase().includes('rest') || lastEvent.content.toLowerCase().includes('sleep')) trigger = 'rest';
      }

      const user = getRandomUser();
      addChatMessage({
        username: user.name,
        message: getRandomMessage(trigger),
        color: user.color,
      });
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, [isPlaying, gameEvents, addChatMessage]);

  const handleSend = () => {
    if (!userMessage.trim()) return;

    addChatMessage({
      username: 'you',
      message: userMessage,
      color: '#ffffff',
    });
    setUserMessage('');
  };

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl border border-gray-700/50 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700/50 bg-gradient-to-r from-green-900/30 to-purple-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-white font-bold text-sm">LIVE CHAT</span>
          </div>
          <div className="flex items-center gap-2">
            <motion.span
              className="text-xs text-green-400 font-mono"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              👁 {Math.max(100, viewerCount).toLocaleString()}
            </motion.span>
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        style={{ maxHeight: '300px' }}
      >
        <AnimatePresence initial={false}>
          {chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-1.5 text-sm"
            >
              <span
                className="font-medium flex-shrink-0"
                style={{ color: msg.color }}
              >
                {msg.username}:
              </span>
              <span className="text-gray-300 break-words">{msg.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {chatMessages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">Chat will appear here when the game starts...</p>
          </div>
        )}
      </div>

      {/* Chat input */}
      <div className="p-2 border-t border-gray-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Send a message..."
            className="flex-1 bg-gray-800/80 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50"
          />
          <motion.button
            onClick={handleSend}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-green-500 hover:to-emerald-500 transition-all"
          >
            Send
          </motion.button>
        </div>
      </div>

      {/* Quick reactions */}
      <div className="px-2 pb-2 flex flex-wrap gap-1">
        {['🔥', '💀', '🚀', 'W', 'L', '👀'].map((emoji) => (
          <motion.button
            key={emoji}
            onClick={() => {
              addChatMessage({
                username: 'you',
                message: emoji,
                color: '#ffffff',
              });
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="px-2 py-1 bg-gray-800/60 hover:bg-gray-700/60 rounded text-sm transition-colors"
          >
            {emoji}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
