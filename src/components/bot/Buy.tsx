'use client';

import { useState } from 'react';
import { useBotStore } from '@/store/bot-store';
import { shortenAddress, isValidPublicKey } from '@/lib/helpers';

export function Buy() {
  const {
    wallets,
    currentTokenInfo,
    isLoading,
    loadingMessage,
    lookupToken,
    executeBuy,
    addLog,
    setActiveTab,
  } = useBotStore();

  const [tokenAddress, setTokenAddress] = useState('');
  const [totalAmount, setTotalAmount] = useState('0.5');
  const [walletCount, setWalletCount] = useState('5');
  const [progress, setProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  const fundedWallets = wallets.filter(w => w.funded).length;

  const handleLookup = async () => {
    if (!tokenAddress || !isValidPublicKey(tokenAddress)) {
      addLog('error', 'Invalid token address');
      return;
    }
    await lookupToken(tokenAddress);
  };

  const handleBuy = async () => {
    if (!currentTokenInfo) {
      addLog('error', 'Please lookup a token first');
      return;
    }

    const amount = parseFloat(totalAmount);
    const count = parseInt(walletCount);

    if (isNaN(amount) || amount <= 0) {
      addLog('error', 'Invalid amount');
      return;
    }

    if (isNaN(count) || count <= 0) {
      addLog('error', 'Invalid wallet count');
      return;
    }

    if (count > fundedWallets) {
      addLog('error', `Not enough funded wallets. Have ${fundedWallets}, need ${count}`);
      return;
    }

    setProgress({ current: 0, total: count, status: 'starting' });

    await executeBuy(currentTokenInfo.mint, amount, count, (current, total, wallet, status) => {
      setProgress({ current, total, status: `${status} - ${shortenAddress(wallet, 4)}` });
    });

    setProgress(null);
    setActiveTab('sell');
  };

  const perWallet = currentTokenInfo && parseFloat(totalAmount) > 0 && parseInt(walletCount) > 0
    ? (parseFloat(totalAmount) / parseInt(walletCount)).toFixed(4)
    : '0';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400">Buy Tokens</h2>

      {/* Token Lookup */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Token Address</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg font-mono text-sm"
            placeholder="Enter token mint address (CA)"
          />
          <button
            onClick={handleLookup}
            disabled={isLoading || !tokenAddress}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            Lookup
          </button>
        </div>
      </div>

      {/* Token Info */}
      {currentTokenInfo && (
        <div className="bg-gray-800 rounded-lg p-4 border border-green-600">
          <h3 className="text-lg font-semibold text-white mb-3">Token Found</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Name:</span>
              <span className="text-white font-semibold">
                {currentTokenInfo.name} ({currentTokenInfo.symbol})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Mint:</span>
              <span className="text-green-400 font-mono text-sm">
                {shortenAddress(currentTokenInfo.mint, 6)}
              </span>
            </div>
            {currentTokenInfo.market_cap && (
              <div className="flex justify-between">
                <span className="text-gray-400">Market Cap:</span>
                <span className="text-white">
                  ${(currentTokenInfo.usd_market_cap || 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Buy Configuration */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Buy Configuration</h3>

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">Total SOL Amount</label>
            <input
              type="number"
              step="0.1"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              placeholder="0.5"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">
              Number of Wallets ({fundedWallets} available)
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setWalletCount(n.toString())}
                  disabled={n > fundedWallets}
                  className={`py-2 rounded-lg font-semibold transition-colors ${
                    walletCount === n.toString()
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  } disabled:bg-gray-800 disabled:text-gray-600`}
                >
                  {n}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={walletCount}
              onChange={(e) => setWalletCount(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              placeholder="5"
            />
          </div>

          {parseFloat(totalAmount) > 0 && parseInt(walletCount) > 0 && (
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-sm">Per Wallet: ~{perWallet} SOL</p>
              <p className="text-gray-400 text-sm mt-1">
                Mode: Spread buy with delays (anti-detection)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="bg-gray-800 rounded-lg p-4 border border-blue-600">
          <h3 className="text-lg font-semibold text-white mb-3">Progress</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className="text-blue-400">{progress.status}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-gray-400 text-sm text-center">
              {progress.current} / {progress.total}
            </p>
          </div>
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={handleBuy}
        disabled={isLoading || !currentTokenInfo || fundedWallets === 0}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-4 rounded-lg font-bold text-lg transition-colors"
      >
        {isLoading ? loadingMessage || 'Processing...' : 'Execute Spread Buy'}
      </button>

      {fundedWallets === 0 && (
        <p className="text-yellow-400 text-center">
          No funded wallets. Go to Wallets tab to generate and fund wallets first.
        </p>
      )}
    </div>
  );
}
