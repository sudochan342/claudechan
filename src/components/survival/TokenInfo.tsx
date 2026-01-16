'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TokenInfoProps {
  contractAddress?: string;
  tokenSymbol?: string;
}

export function TokenInfo({
  contractAddress = 'YOUR_CONTRACT_ADDRESS_HERE',
  tokenSymbol = '$CLAUDE'
}: TokenInfoProps) {
  const [copied, setCopied] = useState(false);
  const [priceChange, setPriceChange] = useState(0);
  const [marketCap, setMarketCap] = useState(0);
  const [holders, setHolders] = useState(0);
  const [volume24h, setVolume24h] = useState(0);

  // Simulated real-time updates (replace with actual API calls)
  useEffect(() => {
    const interval = setInterval(() => {
      setPriceChange(prev => prev + (Math.random() * 4 - 1.5));
      setMarketCap(prev => Math.max(10000, prev + Math.floor(Math.random() * 2000 - 500)));
      setHolders(prev => prev + Math.floor(Math.random() * 3));
      setVolume24h(prev => Math.max(5000, prev + Math.floor(Math.random() * 1000 - 300)));
    }, 3000);

    // Initialize with random values
    setPriceChange(Math.random() * 20 + 5);
    setMarketCap(Math.floor(Math.random() * 50000 + 20000));
    setHolders(Math.floor(Math.random() * 200 + 50));
    setVolume24h(Math.floor(Math.random() * 30000 + 10000));

    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
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
              <p className="text-emerald-100 text-sm font-semibold">Claude Survival Token</p>
            </div>
          </div>
          <motion.div
            className={`px-4 py-2 rounded-xl font-black text-lg ${
              priceChange >= 0
                ? 'bg-emerald-400/30 text-white'
                : 'bg-red-400/30 text-white'
            }`}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {priceChange >= 0 ? '📈' : '📉'} {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)}%
          </motion.div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <motion.div
          className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border-2 border-emerald-100"
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <p className="text-emerald-600 text-xs font-bold uppercase tracking-wide">Market Cap</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{formatNumber(marketCap)}</p>
        </motion.div>
        <motion.div
          className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 border-2 border-cyan-100"
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <p className="text-cyan-600 text-xs font-bold uppercase tracking-wide">24h Volume</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{formatNumber(volume24h)}</p>
        </motion.div>
        <motion.div
          className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-100"
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <p className="text-purple-600 text-xs font-bold uppercase tracking-wide">Holders</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{holders.toLocaleString()}</p>
        </motion.div>
        <motion.div
          className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border-2 border-amber-100"
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <p className="text-amber-600 text-xs font-bold uppercase tracking-wide">Status</p>
          <div className="flex items-center gap-2 mt-1">
            <motion.div
              className="w-3 h-3 bg-emerald-500 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-lg font-black text-gray-800">LIVE</span>
          </div>
        </motion.div>
      </div>

      {/* Contract Address */}
      <div className="px-4 pb-4">
        <div className="bg-gray-100 rounded-2xl p-4 border-2 border-gray-200">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">Contract Address (CA)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono text-gray-700 truncate bg-white px-3 py-2 rounded-xl">
              {contractAddress}
            </code>
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
                    Copied!
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
          </div>
        </div>
      </div>

      {/* Buy Button */}
      <div className="px-4 pb-4">
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
      </div>

      {/* Social Links */}
      <div className="px-4 pb-5">
        <div className="flex gap-3">
          <motion.a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 py-3 bg-gradient-to-r from-blue-400 to-blue-500 text-white font-bold rounded-xl text-center shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
          >
            <span className="text-xl">𝕏</span>
            Twitter
          </motion.a>
          <motion.a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 py-3 bg-gradient-to-r from-cyan-400 to-blue-400 text-white font-bold rounded-xl text-center shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2"
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
          <span className="font-bold text-emerald-700">Launched on Pump.fun</span>
        </div>
      </div>
    </motion.div>
  );
}
