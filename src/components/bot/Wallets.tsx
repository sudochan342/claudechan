'use client';

import { useState } from 'react';
import { useBotStore } from '@/store/bot-store';
import { shortenAddress, lamportsToSol } from '@/lib/helpers';

export function Wallets() {
  const {
    wallets,
    isLoading,
    loadingMessage,
    generateWallets,
    refreshBalances,
    deleteAllWallets,
    importWallets,
    exportWallets,
    quickFundWallets,
    stealthFundWallets,
    collectAllFunds,
    getMasterKeypair,
    addLog,
    clearLogs,
    updateSettings,
  } = useBotStore();

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [fundAmount, setFundAmount] = useState('0.05');
  const [showFundModal, setShowFundModal] = useState(false);
  const [showStealthFundModal, setShowStealthFundModal] = useState(false);
  const [stealthFundAmount, setStealthFundAmount] = useState('0.05');
  const [intermediateCount, setIntermediateCount] = useState('3');
  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<{ publicKey: string; privateKey: string } | null>(null);

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

  const handleStealthFund = async () => {
    const amount = parseFloat(stealthFundAmount);
    const intCount = parseInt(intermediateCount);
    if (isNaN(amount) || amount <= 0) {
      addLog('error', 'Invalid amount');
      return;
    }
    if (isNaN(intCount) || intCount < 1 || intCount > 10) {
      addLog('error', 'Intermediate count must be between 1 and 10');
      return;
    }
    setShowStealthFundModal(false);
    await stealthFundWallets(amount, intCount);
  };

  const handleResetAllData = () => {
    // Clear wallets
    deleteAllWallets();
    // Clear logs
    clearLogs();
    // Reset settings to default (except keep RPC URL)
    updateSettings({
      masterPrivateKey: '',
      slippageBps: 500,
      buyDelayMinMs: 3000,
      buyDelayMaxMs: 10000,
    });
    // Clear localStorage completely
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pumpfun_bot_wallets');
      localStorage.removeItem('pumpfun-bot-storage');
    }
    setShowConfirmReset(false);
    addLog('warning', 'All data has been reset');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addLog('info', `${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400">Wallets</h2>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-blue-400">{loadingMessage || 'Processing...'}</span>
        </div>
      )}

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
        {wallets.length > 0 && totalBalance === 0 && !isLoading && (
          <p className="text-yellow-400 text-sm text-center mt-3">
            Click &quot;Refresh&quot; to fetch balances from blockchain
          </p>
        )}
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
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => setShowFundModal(true)}
              disabled={isLoading || fundedCount === wallets.length}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
            >
              Direct Fund
            </button>
            <button
              onClick={() => setShowStealthFundModal(true)}
              disabled={isLoading || fundedCount === wallets.length}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
            >
              Stealth Fund
            </button>
          </div>
          <button
            onClick={collectAllFunds}
            disabled={isLoading || fundedCount === 0}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
          >
            Collect All Funds
          </button>
          <p className="text-gray-400 text-xs mt-2">
            Stealth Fund uses intermediate wallets to hide the master-to-sub connection on Bubblemaps.
          </p>
        </div>
      )}

      {/* Wallet List */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 max-h-96 overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-3">Wallet List</h3>
        <p className="text-gray-500 text-xs mb-2">Click a wallet to view private key</p>
        {wallets.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No wallets yet. Generate some!</p>
        ) : (
          <div className="space-y-2">
            {wallets.map((wallet, index) => (
              <div
                key={wallet.publicKey}
                onClick={() => setSelectedWallet({ publicKey: wallet.publicKey, privateKey: wallet.privateKey })}
                className="flex items-center justify-between bg-gray-700 hover:bg-gray-600 rounded px-3 py-2 cursor-pointer transition-colors"
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

      {/* Reset All Data Button */}
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
        <p className="text-gray-400 text-sm mb-3">
          Reset all data including wallets, settings, and logs. This cannot be undone!
        </p>
        <button
          onClick={() => setShowConfirmReset(true)}
          className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
        >
          Reset All Data
        </button>
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

      {/* Stealth Fund Modal */}
      {showStealthFundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-2">Stealth Fund</h3>
            <p className="text-gray-400 text-sm mb-4">
              Uses intermediate wallets to break the direct master-to-sub chain visible on Bubblemaps.
            </p>
            <div className="space-y-4 mb-4">
              <div>
                <label className="text-gray-300 text-sm block mb-1">
                  SOL per wallet ({wallets.length - fundedCount} unfunded):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={stealthFundAmount}
                  onChange={(e) => setStealthFundAmount(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="0.05"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm block mb-1">
                  Intermediate wallets (1-10):
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={intermediateCount}
                  onChange={(e) => setIntermediateCount(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="3"
                />
                <p className="text-gray-500 text-xs mt-1">
                  More intermediates = better distribution but more tx fees
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStealthFundModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleStealthFund}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-semibold"
              >
                Stealth Fund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Details Modal */}
      {selectedWallet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Wallet Details</h3>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Public Key</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-700 text-green-400 px-3 py-2 rounded text-sm font-mono break-all">
                    {selectedWallet.publicKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(selectedWallet.publicKey, 'Public key')}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Private Key (Keep Secret!)</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-700 text-yellow-400 px-3 py-2 rounded text-sm font-mono break-all">
                    {selectedWallet.privateKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(selectedWallet.privateKey, 'Private key')}
                    className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-2 rounded text-sm"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-red-400 text-xs mt-2">
                  Never share your private key! Anyone with this key can access your funds.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setSelectedWallet(null)}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset All Data Confirmation Modal */}
      {showConfirmReset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 border border-red-600">
            <h3 className="text-xl font-bold text-red-400 mb-4">Reset All Data?</h3>
            <p className="text-gray-300 mb-2">
              This will permanently delete:
            </p>
            <ul className="text-gray-400 text-sm mb-4 list-disc list-inside">
              <li>All generated wallets and private keys</li>
              <li>Master wallet configuration</li>
              <li>All logs and history</li>
              <li>Buy/sell settings</li>
            </ul>
            <p className="text-yellow-400 text-sm mb-6">
              Make sure you have exported your wallets if you need them!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAllData}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold"
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
