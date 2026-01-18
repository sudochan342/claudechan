'use client';

import { useState, useEffect } from 'react';
import { useBotStore } from '@/store/bot-store';
import { isValidPrivateKey, keypairFromBase58, shortenAddress } from '@/lib/helpers';

export function Settings() {
  const { settings, updateSettings, addLog, initServices, refreshMasterBalance } = useBotStore();

  const [rpcUrl, setRpcUrl] = useState(settings.rpcUrl);
  const [masterKey, setMasterKey] = useState(settings.masterPrivateKey);
  const [slippage, setSlippage] = useState(settings.slippageBps.toString());
  const [minDelay, setMinDelay] = useState(settings.buyDelayMinMs.toString());
  const [maxDelay, setMaxDelay] = useState(settings.buyDelayMaxMs.toString());
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setRpcUrl(settings.rpcUrl);
    setMasterKey(settings.masterPrivateKey);
    setSlippage(settings.slippageBps.toString());
    setMinDelay(settings.buyDelayMinMs.toString());
    setMaxDelay(settings.buyDelayMaxMs.toString());
  }, [settings]);

  const handleSave = () => {
    // Validate master key
    if (masterKey && !isValidPrivateKey(masterKey)) {
      addLog('error', 'Invalid master wallet private key');
      return;
    }

    // Validate slippage
    const slippageNum = parseInt(slippage);
    if (isNaN(slippageNum) || slippageNum < 100 || slippageNum > 5000) {
      addLog('error', 'Slippage must be between 100 (1%) and 5000 (50%)');
      return;
    }

    // Validate delays
    const minDelayNum = parseInt(minDelay);
    const maxDelayNum = parseInt(maxDelay);
    if (isNaN(minDelayNum) || minDelayNum < 1000) {
      addLog('error', 'Minimum delay must be at least 1000ms');
      return;
    }
    if (isNaN(maxDelayNum) || maxDelayNum < minDelayNum) {
      addLog('error', 'Maximum delay must be greater than minimum delay');
      return;
    }

    updateSettings({
      rpcUrl,
      masterPrivateKey: masterKey,
      slippageBps: slippageNum,
      buyDelayMinMs: minDelayNum,
      buyDelayMaxMs: maxDelayNum,
    });

    initServices();
    refreshMasterBalance();
    addLog('success', 'Settings saved');
  };

  const getMasterAddress = () => {
    if (!masterKey) return null;
    try {
      const kp = keypairFromBase58(masterKey);
      return kp.publicKey.toBase58();
    } catch {
      return null;
    }
  };

  const masterAddress = getMasterAddress();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-400">Settings</h2>

      {/* RPC Settings */}
      <div className="bg-gray-800 rounded-lg p-4 border border-yellow-600">
        <h3 className="text-lg font-semibold text-white mb-2">Solana RPC</h3>
        <p className="text-yellow-400 text-sm mb-3">
          Required: You need a private RPC that supports browser requests (CORS)
        </p>
        <input
          type="text"
          value={rpcUrl}
          onChange={(e) => setRpcUrl(e.target.value)}
          className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg font-mono text-sm"
          placeholder="https://your-rpc-url.com"
        />
        <div className="mt-3 space-y-2">
          <p className="text-gray-400 text-sm font-semibold">Free RPC providers (sign up required):</p>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <a
              href="https://www.helius.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Helius - helius.dev (recommended, free tier)
            </a>
            <a
              href="https://www.quicknode.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              QuickNode - quicknode.com (free tier)
            </a>
            <a
              href="https://www.alchemy.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Alchemy - alchemy.com (free tier)
            </a>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            The public Solana RPC blocks browser requests. Get a free private RPC above.
          </p>
        </div>
      </div>

      {/* Master Wallet */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Master Wallet</h3>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={masterKey}
            onChange={(e) => setMasterKey(e.target.value)}
            className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg font-mono text-sm pr-20"
            placeholder="Enter base58 private key"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        {masterAddress && (
          <p className="text-green-400 text-sm mt-2 font-mono">
            Address: {shortenAddress(masterAddress, 8)}
          </p>
        )}
        <p className="text-yellow-400 text-sm mt-2">
          Your private key is stored locally and never sent to any server.
        </p>
      </div>

      {/* Trading Settings */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Trading Settings</h3>

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">
              Slippage (basis points) - 500 = 5%
            </label>
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              placeholder="500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm block mb-1">Min Delay (ms)</label>
              <input
                type="number"
                value={minDelay}
                onChange={(e) => setMinDelay(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                placeholder="3000"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">Max Delay (ms)</label>
              <input
                type="number"
                value={maxDelay}
                onChange={(e) => setMaxDelay(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                placeholder="10000"
              />
            </div>
          </div>
          <p className="text-gray-400 text-sm">
            Delays between buy transactions help avoid detection patterns.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition-colors"
      >
        Save Settings
      </button>

      {/* Info */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Security Notice</h3>
        <ul className="text-gray-400 text-sm space-y-2">
          <li>- All wallet data is stored in your browser (localStorage)</li>
          <li>- Private keys never leave your device</li>
          <li>- No data is sent to any external server</li>
          <li>- Export and backup your wallets regularly</li>
        </ul>
      </div>
    </div>
  );
}
