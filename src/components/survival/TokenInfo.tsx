'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createBuyTransaction, sendAndConfirmTransactionWithRetry, createJupiterSwapTransaction } from '@/lib/solana-utils';

interface TokenInfoProps {
  contractAddress?: string;
  tokenSymbol?: string;
}

export function TokenInfo({
  contractAddress = 'YOUR_CONTRACT_ADDRESS_HERE',
  tokenSymbol = '$CLAUDE'
}: TokenInfoProps) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [copied, setCopied] = useState(false);
  const [priceChange, setPriceChange] = useState(0);
  const [marketCap, setMarketCap] = useState(0);
  const [holders, setHolders] = useState(0);
  const [volume24h, setVolume24h] = useState(0);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState<string | null>(null);
  const [useJupiter, setUseJupiter] = useState(false);

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

  const handleBuy = async (solAmount: number) => {
    if (!connected || !publicKey) {
      setBuyError('Please connect your wallet first');
      return;
    }

    if (contractAddress === 'YOUR_CONTRACT_ADDRESS_HERE' || contractAddress === 'DEPLOYING...') {
      setBuyError('Invalid contract address');
      return;
    }

    setBuying(true);
    setBuyError(null);
    setBuySuccess(null);

    try {
      const tokenMint = new PublicKey(contractAddress);
      let transaction;

      if (useJupiter) {
        // Use Jupiter for swap
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        transaction = await createJupiterSwapTransaction(
          publicKey,
          SOL_MINT,
          contractAddress,
          Math.floor(solAmount * LAMPORTS_PER_SOL),
          500 // 5% slippage
        );
      } else {
        // Use Pump.fun for buy
        transaction = await createBuyTransaction(
          connection,
          publicKey,
          tokenMint,
          solAmount,
          500 // 5% slippage
        );
      }

      // Send transaction
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      setBuySuccess(`Success! Transaction: ${signature.slice(0, 8)}...`);
      console.log('Buy successful:', signature);

    } catch (error: any) {
      console.error('Buy error:', error);

      if (error.message?.includes('IncorrectProgramId')) {
        setBuyError('Transaction failed: Incorrect Program ID detected. This has been fixed - please try again.');
      } else if (error.message?.includes('User rejected')) {
        setBuyError('Transaction cancelled by user');
      } else {
        setBuyError(error.message || 'Transaction failed. Please try again.');
      }
    } finally {
      setBuying(false);
    }
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

      {/* Wallet Connection */}
      <div className="px-4 pb-3">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-3 border-2 border-purple-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-purple-600 text-xs font-bold uppercase tracking-wide mb-1">Wallet</p>
              <div className="wallet-adapter-button-trigger">
                <WalletMultiButton />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUseJupiter(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !useJupiter
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Pump.fun
              </button>
              <button
                onClick={() => setUseJupiter(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  useJupiter
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Jupiter
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {(buyError || buySuccess) && (
        <div className="px-4 pb-3">
          <AnimatePresence mode="wait">
            {buyError && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-100 border-2 border-red-300 rounded-xl p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-lg">⚠️</span>
                  <div className="flex-1">
                    <p className="text-red-800 text-sm font-bold">Transaction Failed</p>
                    <p className="text-red-600 text-xs mt-1">{buyError}</p>
                  </div>
                  <button
                    onClick={() => setBuyError(null)}
                    className="text-red-500 hover:text-red-700 font-bold"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}
            {buySuccess && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-100 border-2 border-emerald-300 rounded-xl p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 text-lg">✅</span>
                  <div className="flex-1">
                    <p className="text-emerald-800 text-sm font-bold">Transaction Successful!</p>
                    <p className="text-emerald-600 text-xs mt-1">{buySuccess}</p>
                  </div>
                  <button
                    onClick={() => setBuySuccess(null)}
                    className="text-emerald-500 hover:text-emerald-700 font-bold"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Quick Buy Buttons */}
      <div className="px-4 pb-4">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-3 text-center">Quick Buy</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[0.1, 0.5, 1.0].map((amount) => (
            <motion.button
              key={amount}
              onClick={() => handleBuy(amount)}
              disabled={buying || !connected}
              whileHover={{ scale: connected ? 1.05 : 1, y: connected ? -2 : 0 }}
              whileTap={{ scale: connected ? 0.95 : 1 }}
              className={`py-3 rounded-xl font-bold text-sm shadow-lg transition-all ${
                buying || !connected
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white hover:from-emerald-500 hover:to-teal-500'
              }`}
            >
              {amount} SOL
            </motion.button>
          ))}
        </div>
        <motion.button
          onClick={() => handleBuy(5.0)}
          disabled={buying || !connected}
          whileHover={{ scale: connected ? 1.02 : 1, y: connected ? -2 : 0 }}
          whileTap={{ scale: connected ? 0.98 : 1 }}
          className={`block w-full py-4 rounded-2xl font-black text-xl shadow-2xl text-center transition-all relative overflow-hidden group ${
            buying || !connected
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white shadow-emerald-500/50 hover:shadow-emerald-400/70'
          }`}
        >
          {buying ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ⌛
              </motion.span>
              Processing...
            </span>
          ) : !connected ? (
            <span>Connect Wallet to Buy</span>
          ) : (
            <>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 opacity-0 group-hover:opacity-100"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.6 }}
              />
              <span className="relative flex items-center justify-center gap-3">
                <span className="text-2xl">🚀</span>
                BUY 5 SOL
                <span className="text-2xl">🚀</span>
              </span>
            </>
          )}
        </motion.button>
        <p className="text-gray-400 text-xs text-center mt-2">
          Using {useJupiter ? 'Jupiter Aggregator' : 'Pump.fun'} • 5% slippage
        </p>
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
