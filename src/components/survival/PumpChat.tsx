'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';

interface PumpChatProps {
  contractAddress?: string;
  usePumpEmbed?: boolean;
}

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
  { trigger: 'danger', messages: ['RUN CLAUDE RUN!!! 😱', 'oh no oh no oh no', 'F in chat', 'HES COOKED 💀', 'NGMI', 'bro is done 😭', 'SELL SELL SELL jk 💎🙌'] },
  { trigger: 'success', messages: ['LETS GOOOO 🚀', 'WAGMI', 'based claude', 'chad move', 'absolute unit', 'W', 'MOON SOON 🌙', 'aping in more!!'] },
  { trigger: 'food', messages: ['eat up king 👑', 'monch monch', 'hungry boi fed', 'FOOD ARC', 'bullish on food'] },
  { trigger: 'fight', messages: ['FIGHT FIGHT FIGHT', 'Violence!! 🔥', 'claude chose violence today', 'bonk time', 'pvp mode activated'] },
  { trigger: 'rest', messages: ['sleepy boi', 'zzz', 'rest arc best arc', 'self care king', 'consolidation phase'] },
  { trigger: 'pump', messages: ['PUMP IT 🚀', 'LFG!!!', 'TO THE MOON', 'we early frfr', 'generational wealth incoming', 'this is the one', 'buy the dip', '100x incoming', 'never selling 💎', 'claude gonna make it'] },
  { trigger: 'general', messages: ['lol', 'kek', 'interesting...', 'nice', 'this is peak content', 'i love this', 'claude gaming', 'based', 'lets see how this goes', 'omg', '👀', '🔥', '💀', 'wen moon', 'claude is HIM', 'best token ever', 'aped in'] },
];

function getRandomUser() {
  return FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)];
}

function getRandomMessage(trigger: string = 'general') {
  const category = REACTION_MESSAGES.find(r => r.trigger === trigger) || REACTION_MESSAGES.find(r => r.trigger === 'general')!;
  return category.messages[Math.floor(Math.random() * category.messages.length)];
}

export function PumpChat({ contractAddress = 'YOUR_CONTRACT_ADDRESS_HERE', usePumpEmbed = true }: PumpChatProps) {
  const { chatMessages, addChatMessage, viewerCount, setViewerCount, isPlaying, gameEvents } = useSurvivalStore();
  const [userMessage, setUserMessage] = useState('');
  const [showEmbed, setShowEmbed] = useState(usePumpEmbed);
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
    if (!isPlaying || showEmbed) return;

    const interval = setInterval(() => {
      const lastEvent = gameEvents[gameEvents.length - 1];
      let trigger = Math.random() > 0.7 ? 'pump' : 'general'; // More pump talk

      if (lastEvent) {
        if (lastEvent.type === 'danger') trigger = 'danger';
        else if (lastEvent.type === 'success') trigger = Math.random() > 0.5 ? 'success' : 'pump';
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
  }, [isPlaying, gameEvents, addChatMessage, showEmbed]);

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
      className="bg-white/95 backdrop-blur-xl rounded-3xl border-4 border-white/50 shadow-2xl shadow-lime-500/10 flex flex-col"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b-2 border-gray-100 bg-gradient-to-r from-lime-50 via-emerald-50 to-teal-50 rounded-t-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-500 flex items-center justify-center text-xl"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ⛽
            </motion.div>
            <div>
              <span className="font-black text-lg bg-gradient-to-r from-lime-600 to-emerald-600 bg-clip-text text-transparent">PUMP.FUN</span>
              <p className="text-xs font-semibold text-gray-500">Live Token Chat</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setShowEmbed(!showEmbed)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                showEmbed
                  ? 'bg-lime-500 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {showEmbed ? '🔴 Live' : '💬 Demo'}
            </motion.button>
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
      </div>

      {showEmbed ? (
        /* Pump.fun Embed */
        <div className="flex-1 p-4" style={{ minHeight: '400px' }}>
          <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-lime-200">
            {contractAddress !== 'YOUR_CONTRACT_ADDRESS_HERE' ? (
              <iframe
                src={`https://pump.fun/coin/${contractAddress}?embed=chat`}
                className="w-full h-full"
                style={{ minHeight: '380px' }}
                title="Pump.fun Chat"
                allow="clipboard-write"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-lime-50 to-emerald-50 p-8">
                <motion.span
                  className="text-6xl mb-4"
                  animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ⛽
                </motion.span>
                <p className="text-xl font-black text-gray-700 text-center mb-2">Pump.fun Chat</p>
                <p className="text-gray-500 text-center text-sm max-w-xs">
                  Add your contract address to enable live Pump.fun chat integration!
                </p>
                <motion.a
                  href="https://pump.fun"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-4 px-6 py-3 bg-gradient-to-r from-lime-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg"
                >
                  Launch on Pump.fun
                </motion.a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Demo Chat Messages */}
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
                className="flex-1 bg-gray-100 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-200 font-medium transition-all"
              />
              <motion.button
                onClick={handleSend}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-lime-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-lime-500/30 hover:shadow-lime-500/50 transition-all"
              >
                Send
              </motion.button>
            </div>

            {/* Quick reactions */}
            <div className="flex flex-wrap gap-2 mt-3">
              {['🚀', '💎', '🔥', 'WAGMI', 'LFG', '🌙', '📈', '❤️'].map((emoji) => (
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
                  className="px-3 py-2 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-lime-100 hover:to-emerald-100 rounded-xl text-sm font-bold transition-all shadow-sm"
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
