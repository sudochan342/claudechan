'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';

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

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(viewerCount + Math.floor(Math.random() * 20) - 10);
    }, 5000);
    return () => clearInterval(interval);
  }, [viewerCount, setViewerCount]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
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
      color: '#3b82f6',
    });
    setUserMessage('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl border-4 border-white/50 shadow-2xl shadow-pink-500/10 flex flex-col"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b-2 border-gray-100 bg-gradient-to-r from-pink-50 to-purple-50 rounded-t-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-pink-500"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="font-black text-lg bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">LIVE CHAT</span>
          </div>
          <motion.div
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-full"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-lg">👁</span>
            <span className="font-bold text-emerald-700">{Math.max(100, viewerCount).toLocaleString()}</span>
          </motion.div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
        style={{ maxHeight: '280px' }}
      >
        <AnimatePresence initial={false}>
          {chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl px-3 py-2"
            >
              <span className="font-bold text-sm" style={{ color: msg.color }}>
                {msg.username}:
              </span>
              <span className="text-gray-700 text-sm">{msg.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {chatMessages.length === 0 && (
          <div className="text-center py-12">
            <motion.span
              className="text-5xl"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              💬
            </motion.span>
            <p className="text-gray-400 font-medium mt-2">Chat will appear when the game starts!</p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t-2 border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Say something..."
            className="flex-1 bg-gray-100 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 font-medium transition-all"
          />
          <motion.button
            onClick={handleSend}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 transition-all"
          >
            Send
          </motion.button>
        </div>

        {/* Quick reactions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {['🔥', '💀', '🚀', 'W', 'L', '👀', '😂', '❤️'].map((emoji) => (
            <motion.button
              key={emoji}
              onClick={() => {
                addChatMessage({
                  username: 'you',
                  message: emoji,
                  color: '#3b82f6',
                });
              }}
              whileHover={{ scale: 1.15, y: -2 }}
              whileTap={{ scale: 0.9 }}
              className="px-3 py-2 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-pink-100 hover:to-purple-100 rounded-xl text-lg transition-all shadow-sm"
            >
              {emoji}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
