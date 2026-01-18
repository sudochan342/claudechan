'use client';

import { useState } from 'react';
import { useBotStore } from '@/store/bot-store';
import { shortenAddress, lamportsToSol } from '@/lib/helpers';

export function Wallets() {
  const {
    wallets,
    isLoading,
    generateWallets,
    refreshBalances,
    deleteAllWallets,
    importWallets,
    exportWallets,
    quickFundWallets,
    collectAllFunds,
    getMasterKeypair,
    addLog,
  } = useBotStore();

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [fundAmount, setFundAmount] = useState('0.05');
  const [showFundModal, setShowFundModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  const fundedCount = wallets.filter(w => w.funded).length;
  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const masterKeypair = getMasterKeypair();

  const handleExport = () => {
    const data = exportWallets();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wallets.json';
    a.click();
    URL.revokeObjectURL(url);
    addLog('info', 'Wallets exported');
  };

  const handleImport = async () => {
    try {
      const keys = importText
        .split('\n')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (keys.length === 0) {
        addLog('error', 'No valid keys found');
        return;
      }

      const imported = await importWallets(keys);
      setShowImportModal(false);
      setImportText('');
      addLog('success', `Imported ${imported} wallets`);
    } catch (error) {
      addLog('error', `Import failed: ${error}`);
    }
  };

  const handleFund = async () => {
    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      addLog('error', 'Invalid amount');
      return;
    }
    setShowFundModal(false);
    await quickFundWallets(amount);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400">Wallets</h2>

      {/* Summary */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-gray-400 text-sm">Total</p>
            <p className="text-xl font-bold text-white">{wallets.length}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Funded</p>
            <p className="text-xl font-bold text-green-400">{fundedCount}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Balance</p>
            <p className="text-xl font-bold text-white">{lamportsToSol(totalBalance).toFixed(4)} SOL</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => generateWallets(5)}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-3 rounded-lg text-sm font-semibold transition-colors"
        >
          +5
        </button>
        <button
          onClick={() => generateWallets(10)}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-3 rounded-lg text-sm font-semibold transition-colors"
        >
          +10
        </button>
        <button
          onClick={() => generateWallets(20)}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-3 rounded-lg text-sm font-semibold transition-colors"
        >
          +20
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={refreshBalances}
          disabled={isLoading}
          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
        >
          Refresh
        </button>
        <button
          onClick={handleExport}
          disabled={wallets.length === 0}
          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
        >
          Export
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
        >
          Import
        </button>
        <button
          onClick={() => setShowConfirmDelete(true)}
          disabled={wallets.length === 0}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
        >
          Delete All
        </button>
      </div>

      {/* Funding Actions */}
      {masterKeypair && wallets.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">Funding</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowFundModal(true)}
              disabled={isLoading || fundedCount === wallets.length}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
            >
              Fund Wallets
            </button>
            <button
              onClick={collectAllFunds}
              disabled={isLoading || fundedCount === 0}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
            >
              Collect All
            </button>
          </div>
        </div>
      )}

      {/* Wallet List */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 max-h-96 overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-3">Wallet List</h3>
        {wallets.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No wallets yet. Generate some!</p>
        ) : (
          <div className="space-y-2">
            {wallets.map((wallet, index) => (
              <div
                key={wallet.publicKey}
                className="flex items-center justify-between bg-gray-700 rounded px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">{index + 1}.</span>
                  <span className="text-green-400 font-mono text-sm">
                    {shortenAddress(wallet.publicKey, 4)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-sm">
                    {lamportsToSol(wallet.balance).toFixed(4)} SOL
                  </span>
                  {wallet.funded ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="text-gray-500">○</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Delete</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete ALL wallets? This cannot be undone!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteAllWallets();
                  setShowConfirmDelete(false);
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fund Modal */}
      {showFundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Fund Wallets</h3>
            <p className="text-gray-300 mb-4">
              Enter SOL amount per wallet ({wallets.length - fundedCount} unfunded):
            </p>
            <input
              type="number"
              step="0.01"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mb-4"
              placeholder="0.05"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowFundModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleFund}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold"
              >
                Fund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Import Wallets</h3>
            <p className="text-gray-300 mb-4">
              Enter private keys (one per line):
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mb-4 h-32"
              placeholder="Enter base58 private keys..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
