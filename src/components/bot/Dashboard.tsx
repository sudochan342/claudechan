'use client';

import { useEffect } from 'react';
import { useBotStore } from '@/store/bot-store';
import { shortenAddress, lamportsToSol } from '@/lib/helpers';

export function Dashboard() {
  const {
    settings,
    wallets,
    masterBalance,
    holdings,
    currentTokenInfo,
    initServices,
    refreshMasterBalance,
    refreshBalances,
    getMasterKeypair,
    setActiveTab,
  } = useBotStore();

  useEffect(() => {
    initServices();
    refreshMasterBalance();
    refreshBalances();
  }, []);

  const masterKeypair = getMasterKeypair();
  const walletCount = wallets.length;
  const fundedWallets = wallets.filter(w => w.funded).length;
  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

  const isPublicRpc = settings.rpcUrl.includes('api.mainnet-beta.solana.com');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400">Dashboard</h2>

      {/* RPC Warning */}
      {isPublicRpc && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold mb-2">RPC Configuration Required</h3>
          <p className="text-gray-300 text-sm mb-3">
            The public Solana RPC blocks browser requests. You need a private RPC to use this app.
          </p>
          <button
            onClick={() => setActiveTab('settings')}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Go to Settings
          </button>
        </div>
      )}

      {/* Master Wallet */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Master Wallet</h3>
        {masterKeypair ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Address:</span>
              <span className="text-green-400 font-mono">
                {shortenAddress(masterKeypair.publicKey.toBase58(), 6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Balance:</span>
              <span className="text-white font-bold">{masterBalance.toFixed(4)} SOL</span>
            </div>
          </div>
        ) : (
          <p className="text-yellow-400">
            Master wallet not configured. Go to Settings to add your private key.
          </p>
        )}
      </div>

      {/* Sub Wallets */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Sub Wallets</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400">Total Wallets</p>
            <p className="text-2xl font-bold text-white">{walletCount}</p>
          </div>
          <div>
            <p className="text-gray-400">Funded</p>
            <p className="text-2xl font-bold text-green-400">{fundedWallets}</p>
          </div>
          <div>
            <p className="text-gray-400">Unfunded</p>
            <p className="text-2xl font-bold text-yellow-400">{walletCount - fundedWallets}</p>
          </div>
          <div>
            <p className="text-gray-400">Total Balance</p>
            <p className="text-2xl font-bold text-white">{lamportsToSol(totalBalance).toFixed(4)} SOL</p>
          </div>
        </div>
      </div>

      {/* Current Holdings */}
      {holdings.token && (
        <div className="bg-gray-800 rounded-lg p-4 border border-green-600">
          <h3 className="text-lg font-semibold text-white mb-3">Current Holdings</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Token:</span>
              <span className="text-green-400 font-mono">{shortenAddress(holdings.token, 6)}</span>
            </div>
            {currentTokenInfo && (
              <div className="flex justify-between">
                <span className="text-gray-400">Name:</span>
                <span className="text-white">{currentTokenInfo.name} ({currentTokenInfo.symbol})</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Wallets Holding:</span>
              <span className="text-white">{holdings.totalWallets}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Invested:</span>
              <span className="text-white">{holdings.totalSolSpent.toFixed(4)} SOL</span>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('sell')}
            className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors"
          >
            Go to Sell
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setActiveTab('wallets')}
          className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
        >
          Manage Wallets
        </button>
        <button
          onClick={() => setActiveTab('buy')}
          className="bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
        >
          Buy Tokens
        </button>
      </div>
    </div>
  );
}
