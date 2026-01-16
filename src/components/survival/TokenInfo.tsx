'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TokenInfoProps {
  contractAddress?: string;
  tokenSymbol?: string;
  twitterUrl?: string;
  telegramUrl?: string;
}

export function TokenInfo({
  contractAddress = 'DEPLOYING...',
  tokenSymbol = '$CLAUDE',
  twitterUrl = '#',
  telegramUrl = '#',
}: TokenInfoProps) {
  const [copied, setCopied] = useState(false);

  const isLaunched = contractAddress !== 'DEPLOYING...' &&
                     contractAddress !== 'YOUR_CONTRACT_ADDRESS_HERE' &&
                     contractAddress.length > 20;

  const handleCopy = () => {
    if (!isLaunched) return;
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl border-4 border-white/50 shadow-2xl shadow-emerald-500/20 overflow-hidden"
    >
      {/* Header with token name */}
      <div className="px-5 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-2xl"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              🌲
            </motion.div>
            <div>
              <h3 className="font-black text-xl text-white">{tokenSymbol}</h3>
              <p className="text-emerald-100 text-sm font-semibold">Claude Survival Game</p>
            </div>
          </div>
          <motion.div
            className={`px-4 py-2 rounded-xl font-black text-lg ${
              isLaunched
                ? 'bg-emerald-400/30 text-white'
                : 'bg-amber-400/30 text-white'
            }`}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {isLaunched ? '🟢 LIVE' : '🟡 SOON'}
          </motion.div>
        </div>
      </div>

      {/* Contract Address */}
      <div className="p-4">
        <div className="bg-gray-100 rounded-2xl p-4 border-2 border-gray-200">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">Contract Address (CA)</p>
          <div className="flex items-center gap-2">
            <code className={`flex-1 text-sm font-mono truncate bg-white px-3 py-2 rounded-xl ${
              isLaunched ? 'text-gray-700' : 'text-gray-400 italic'
            }`}>
              {isLaunched ? contractAddress : 'Deploying on Pump.fun...'}
            </code>
            {isLaunched && (
              <motion.button
                onClick={handleCopy}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-xl font-bold text-sm shadow-lg"
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.span
                      key="copied"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      ✓ Copied!
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      Copy
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Buy Button or Coming Soon */}
      <div className="px-4 pb-4">
        {isLaunched ? (
          <motion.a
            href={`https://pump.fun/coin/${contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="block w-full py-4 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white font-black text-xl rounded-2xl shadow-2xl shadow-emerald-500/50 hover:shadow-emerald-400/70 text-center transition-all relative overflow-hidden group"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 opacity-0 group-hover:opacity-100"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 0.6 }}
            />
            <span className="relative flex items-center justify-center gap-3">
              <span className="text-2xl">🚀</span>
              BUY ON PUMP.FUN
              <span className="text-2xl">🚀</span>
            </span>
          </motion.a>
        ) : (
          <div className="w-full py-4 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600 font-black text-xl rounded-2xl text-center">
            <span className="flex items-center justify-center gap-3">
              <motion.span
                className="text-2xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                ⏳
              </motion.span>
              LAUNCHING SOON
              <motion.span
                className="text-2xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                ⏳
              </motion.span>
            </span>
          </div>
        )}
      </div>

      {/* Social Links */}
      <div className="px-4 pb-5">
        <div className="flex gap-3">
          <motion.a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={`flex-1 py-3 text-white font-bold rounded-xl text-center shadow-lg flex items-center justify-center gap-2 ${
              twitterUrl !== '#'
                ? 'bg-gradient-to-r from-gray-800 to-black shadow-gray-500/30'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <span className="text-xl">𝕏</span>
            Twitter
          </motion.a>
          <motion.a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={`flex-1 py-3 text-white font-bold rounded-xl text-center shadow-lg flex items-center justify-center gap-2 ${
              telegramUrl !== '#'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-cyan-500/30'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <span className="text-xl">✈️</span>
            Telegram
          </motion.a>
        </div>
      </div>

      {/* Pump.fun branding */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-lime-100 to-emerald-100 rounded-xl">
          <span className="text-xl">⛽</span>
          <span className="font-bold text-emerald-700">
            {isLaunched ? 'Live on Pump.fun' : 'Launching on Pump.fun'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
