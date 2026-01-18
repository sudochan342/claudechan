'use client';

import { useState, useMemo } from 'react';
import { useBotStore } from '@/store/bot-store';
import { shortenAddress, lamportsToSol } from '@/lib/helpers';

export function Sell() {
  const {
    holdings,
    currentTokenInfo,
    isLoading,
    loadingMessage,
    executeSellAll,
    clearHoldings,
    setActiveTab,
  } = useBotStore();

  const [progress, setProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  // Calculate current token price and PnL
  const pnlData = useMemo(() => {
    if (!currentTokenInfo || !holdings.token) {
      return null;
    }

    const virtualSolReserves = currentTokenInfo.virtual_sol_reserves ?? 30_000_000_000;
    const virtualTokenReserves = currentTokenInfo.virtual_token_reserves ?? 1_073_000_000_000_000;

    // Current price per token in SOL (from bonding curve)
    const currentPricePerToken = virtualSolReserves / virtualTokenReserves;

    // Calculate PnL for each holding
    const holdingsPnl = holdings.holdings.map(h => {
      const tokenBalance = BigInt(h.tokenBalance);
      const currentValue = Number(tokenBalance) * currentPricePerToken / 1e9; // Convert lamports to SOL
      const pnl = currentValue - h.solSpent;
      const pnlPercent = h.solSpent > 0 ? ((currentValue / h.solSpent) - 1) * 100 : 0;

      return {
        ...h,
        currentValue,
        pnl,
        pnlPercent,
      };
    });

    // Calculate totals
    const totalCurrentValue = holdingsPnl.reduce((sum, h) => sum + h.currentValue, 0);
    const totalPnl = totalCurrentValue - holdings.totalSolSpent;
    const totalPnlPercent = holdings.totalSolSpent > 0 ? ((totalCurrentValue / holdings.totalSolSpent) - 1) * 100 : 0;

    return {
      currentPricePerToken,
      holdingsPnl,
      totalCurrentValue,
      totalPnl,
      totalPnlPercent,
    };
  }, [holdings, currentTokenInfo]);

  const handleSellAll = async () => {
    if (!holdings.token) return;

    setProgress({ current: 0, total: holdings.totalWallets, status: 'starting' });

    await executeSellAll((current, total, wallet, status) => {
      setProgress({ current, total, status: `${status} - ${shortenAddress(wallet, 4)}` });
    });

    setProgress(null);
  };

  const formatPnl = (value: number, percent: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(4)} SOL (${sign}${percent.toFixed(1)}%)`;
  };

  if (!holdings.token) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-green-400">Sell</h2>
        <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
          <p className="text-gray-400 text-lg mb-4">No current holdings to sell.</p>
          <button
            onClick={() => setActiveTab('buy')}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            Go to Buy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400">Sell</h2>

      {/* Current Holdings Summary */}
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
            <span className="text-white font-bold">{holdings.totalSolSpent.toFixed(4)} SOL</span>
          </div>
        </div>
      </div>

      {/* PnL Summary */}
      {pnlData && (
        <div className={`bg-gray-800 rounded-lg p-4 border ${pnlData.totalPnl >= 0 ? 'border-green-500' : 'border-red-500'}`}>
          <h3 className="text-lg font-semibold text-white mb-3">P&L Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Current Value:</span>
              <span className="text-white font-bold">{pnlData.totalCurrentValue.toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Unrealized P&L:</span>
              <span className={`font-bold ${pnlData.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPnl(pnlData.totalPnl, pnlData.totalPnlPercent)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Holdings List with PnL */}
      {pnlData && pnlData.holdingsPnl.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 max-h-72 overflow-y-auto">
          <h3 className="text-lg font-semibold text-white mb-3">Position Details</h3>
          <div className="space-y-2">
            {pnlData.holdingsPnl.map((h, index) => (
              <div
                key={h.walletAddress}
                className="bg-gray-700 rounded px-3 py-2"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">{index + 1}.</span>
                    <span className="text-green-400 font-mono text-sm">
                      {shortenAddress(h.walletAddress, 4)}
                    </span>
                  </div>
                  <span className={`font-mono text-sm font-bold ${h.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {h.pnl >= 0 ? '+' : ''}{h.pnlPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Invested: {h.solSpent.toFixed(4)} SOL</span>
                  <span>Value: {h.currentValue.toFixed(4)} SOL</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-gray-400 text-sm text-center">
              {progress.current} / {progress.total}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleSellAll}
          disabled={isLoading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white py-4 rounded-lg font-bold text-lg transition-colors"
        >
          {isLoading ? loadingMessage || 'Processing...' : 'SELL ALL'}
        </button>

        <button
          onClick={clearHoldings}
          disabled={isLoading}
          className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 text-white py-2 rounded-lg font-semibold transition-colors"
        >
          Clear Holdings (without selling)
        </button>
      </div>

      <p className="text-gray-400 text-sm text-center">
        Sell all will execute individual sell transactions from each wallet.
      </p>
    </div>
  );
}
