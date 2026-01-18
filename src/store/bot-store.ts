'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Keypair, PublicKey } from '@solana/web3.js';
import { TabType, LogEntry, BotSettings, HoldingsState, PumpFunTokenInfo, WalletInfo } from '@/lib/types';
import { SolanaService, getSolanaService } from '@/lib/solana-service';
import { WalletManager } from '@/lib/wallet-manager';
import { PumpFunBuyer } from '@/lib/pumpfun-buyer';
import { generateId, keypairFromBase58, lamportsToSol, solToLamports } from '@/lib/helpers';

interface BotState {
  // UI State
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;

  // Settings
  settings: BotSettings;
  updateSettings: (settings: Partial<BotSettings>) => void;

  // Logs
  logs: LogEntry[];
  addLog: (type: LogEntry['type'], message: string) => void;
  clearLogs: () => void;

  // Wallet state
  wallets: WalletInfo[];
  masterBalance: number;

  // Holdings state
  holdings: HoldingsState;
  currentTokenInfo: PumpFunTokenInfo | null;

  // Loading states
  isLoading: boolean;
  loadingMessage: string;
  setLoading: (loading: boolean, message?: string) => void;

  // Services (non-persisted)
  solanaService: SolanaService | null;
  walletManager: WalletManager | null;
  pumpFunBuyer: PumpFunBuyer | null;

  // Initialize services
  initServices: () => void;

  // Wallet actions
  generateWallets: (count: number) => Promise<void>;
  refreshBalances: () => Promise<void>;
  deleteAllWallets: () => void;
  importWallets: (privateKeys: string[]) => Promise<number>;
  exportWallets: () => string;

  // Master wallet
  getMasterKeypair: () => Keypair | null;
  refreshMasterBalance: () => Promise<void>;

  // Funding actions
  quickFundWallets: (amountPerWallet: number) => Promise<void>;
  collectAllFunds: () => Promise<void>;

  // Buy/Sell actions
  lookupToken: (mintAddress: string) => Promise<PumpFunTokenInfo | null>;
  executeBuy: (
    mintAddress: string,
    totalAmount: number,
    walletCount: number,
    onProgress?: (current: number, total: number, wallet: string, status: string) => void
  ) => Promise<void>;
  executeSellAll: (
    onProgress?: (current: number, total: number, wallet: string, status: string) => void
  ) => Promise<void>;
  clearHoldings: () => void;
}

const DEFAULT_SETTINGS: BotSettings = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  masterPrivateKey: '',
  slippageBps: 500,
  buyDelayMinMs: 3000,
  buyDelayMaxMs: 10000,
};

export const useBotStore = create<BotState>()(
  persist(
    (set, get) => ({
      // UI State
      activeTab: 'dashboard',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Settings
      settings: DEFAULT_SETTINGS,
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
        // Reinitialize services if RPC URL changed
        if (newSettings.rpcUrl) {
          get().initServices();
        }
      },

      // Logs
      logs: [],
      addLog: (type, message) => {
        const entry: LogEntry = {
          id: generateId(),
          timestamp: Date.now(),
          type,
          message,
        };
        set((state) => ({
          logs: [entry, ...state.logs].slice(0, 100),
        }));
      },
      clearLogs: () => set({ logs: [] }),

      // Wallet state
      wallets: [],
      masterBalance: 0,

      // Holdings
      holdings: {
        token: null,
        totalWallets: 0,
        totalTokens: '0',
        totalSolSpent: 0,
        holdings: [],
      },
      currentTokenInfo: null,

      // Loading
      isLoading: false,
      loadingMessage: '',
      setLoading: (loading, message = '') => set({ isLoading: loading, loadingMessage: message }),

      // Services
      solanaService: null,
      walletManager: null,
      pumpFunBuyer: null,

      initServices: () => {
        const { settings } = get();
        const solanaService = getSolanaService(settings.rpcUrl);
        const walletManager = new WalletManager(solanaService);
        const pumpFunBuyer = new PumpFunBuyer(solanaService, walletManager);

        set({
          solanaService,
          walletManager,
          pumpFunBuyer,
          wallets: walletManager.getAllWallets().map(w => w.info),
        });

        get().addLog('info', 'Services initialized');
      },

      // Wallet actions
      generateWallets: async (count) => {
        const { walletManager, addLog } = get();
        if (!walletManager) {
          addLog('error', 'Services not initialized');
          return;
        }

        set({ isLoading: true, loadingMessage: `Generating ${count} wallets...` });

        try {
          walletManager.generateWallets(count);
          set({ wallets: walletManager.getAllWallets().map(w => w.info) });
          addLog('success', `Generated ${count} new wallets`);
        } catch (error) {
          addLog('error', `Failed to generate wallets: ${error}`);
        } finally {
          set({ isLoading: false, loadingMessage: '' });
        }
      },

      refreshBalances: async () => {
        const { walletManager, addLog } = get();
        if (!walletManager) {
          addLog('error', 'Services not initialized');
          return;
        }

        set({ isLoading: true, loadingMessage: 'Refreshing balances...' });

        try {
          await walletManager.updateAllBalances();
          set({ wallets: walletManager.getAllWallets().map(w => w.info) });
          addLog('info', 'Balances refreshed');
        } catch (error) {
          addLog('error', `Failed to refresh balances: ${error}`);
        } finally {
          set({ isLoading: false, loadingMessage: '' });
        }
      },

      deleteAllWallets: () => {
        const { walletManager, addLog } = get();
        if (!walletManager) return;

        walletManager.deleteAllWallets();
        set({ wallets: [] });
        addLog('warning', 'All wallets deleted');
      },

      importWallets: async (privateKeys) => {
        const { walletManager, addLog, refreshBalances } = get();
        if (!walletManager) {
          addLog('error', 'Services not initialized');
          return 0;
        }

        set({ isLoading: true, loadingMessage: 'Importing wallets...' });

        const imported = walletManager.importWallets(privateKeys);
        set({ wallets: walletManager.getAllWallets().map(w => w.info) });
        addLog('success', `Imported ${imported} wallets`);

        // Auto-refresh balances after import
        if (imported > 0) {
          addLog('info', 'Fetching balances from blockchain...');
          await refreshBalances();
        }

        set({ isLoading: false, loadingMessage: '' });
        return imported;
      },

      exportWallets: () => {
        const { walletManager } = get();
        if (!walletManager) return '[]';
        return walletManager.exportWallets();
      },

      getMasterKeypair: () => {
        const { settings } = get();
        if (!settings.masterPrivateKey) return null;
        try {
          return keypairFromBase58(settings.masterPrivateKey);
        } catch {
          return null;
        }
      },

      refreshMasterBalance: async () => {
        const { solanaService, getMasterKeypair, addLog } = get();
        if (!solanaService) return;

        const master = getMasterKeypair();
        if (!master) return;

        try {
          const balance = await solanaService.getBalanceSol(master.publicKey);
          set({ masterBalance: balance });
        } catch (error) {
          addLog('error', `Failed to get master balance: ${error}`);
        }
      },

      quickFundWallets: async (amountPerWallet) => {
        const { solanaService, walletManager, getMasterKeypair, addLog, refreshBalances } = get();
        if (!solanaService || !walletManager) {
          addLog('error', 'Services not initialized');
          return;
        }

        const masterKeypair = getMasterKeypair();
        if (!masterKeypair) {
          addLog('error', 'Master wallet not configured');
          return;
        }

        const unfunded = walletManager.getUnfundedWallets();
        if (unfunded.length === 0) {
          addLog('warning', 'No unfunded wallets');
          return;
        }

        set({ isLoading: true, loadingMessage: `Funding ${unfunded.length} wallets...` });

        let funded = 0;
        for (const wallet of unfunded) {
          try {
            addLog('info', `Funding ${wallet.info.publicKey.slice(0, 8)}...`);
            await solanaService.sendSol(
              masterKeypair,
              new PublicKey(wallet.info.publicKey),
              amountPerWallet
            );
            walletManager.markAsFunded(wallet.info.publicKey, solToLamports(amountPerWallet));
            funded++;
          } catch (error) {
            addLog('error', `Failed to fund ${wallet.info.publicKey.slice(0, 8)}...: ${error}`);
          }
        }

        await refreshBalances();
        await get().refreshMasterBalance();
        addLog('success', `Funded ${funded}/${unfunded.length} wallets`);
        set({ isLoading: false, loadingMessage: '' });
      },

      collectAllFunds: async () => {
        const { solanaService, walletManager, getMasterKeypair, addLog, refreshBalances } = get();
        if (!solanaService || !walletManager) {
          addLog('error', 'Services not initialized');
          return;
        }

        const masterKeypair = getMasterKeypair();
        if (!masterKeypair) {
          addLog('error', 'Master wallet not configured');
          return;
        }

        const funded = walletManager.getFundedWallets();
        if (funded.length === 0) {
          addLog('warning', 'No funded wallets to collect from');
          return;
        }

        set({ isLoading: true, loadingMessage: `Collecting from ${funded.length} wallets...` });

        let collected = 0;
        let totalAmount = 0;

        for (const wallet of funded) {
          try {
            const balance = await solanaService.getBalance(new PublicKey(wallet.info.publicKey));
            const sendAmount = balance - 5000; // Leave rent

            if (sendAmount > 0) {
              await solanaService.sendSol(
                wallet.keypair,
                masterKeypair.publicKey,
                lamportsToSol(sendAmount)
              );
              totalAmount += sendAmount;
              collected++;
              addLog('info', `Collected ${lamportsToSol(sendAmount).toFixed(4)} SOL from ${wallet.info.publicKey.slice(0, 8)}...`);
            }
          } catch (error) {
            addLog('error', `Failed to collect from ${wallet.info.publicKey.slice(0, 8)}...: ${error}`);
          }
        }

        await refreshBalances();
        await get().refreshMasterBalance();
        addLog('success', `Collected ${lamportsToSol(totalAmount).toFixed(4)} SOL from ${collected} wallets`);
        set({ isLoading: false, loadingMessage: '' });
      },

      lookupToken: async (mintAddress) => {
        const { pumpFunBuyer, addLog } = get();
        if (!pumpFunBuyer) {
          addLog('error', 'Services not initialized');
          return null;
        }

        try {
          const info = await pumpFunBuyer.getTokenInfo(new PublicKey(mintAddress));
          if (info) {
            set({ currentTokenInfo: info });
            addLog('info', `Found token: ${info.name} (${info.symbol})`);
          } else {
            addLog('warning', 'Token not found on PumpFun');
          }
          return info;
        } catch (error) {
          addLog('error', `Failed to lookup token: ${error}`);
          return null;
        }
      },

      executeBuy: async (mintAddress, totalAmount, walletCount, onProgress) => {
        const { pumpFunBuyer, walletManager, settings, addLog, refreshBalances } = get();
        if (!pumpFunBuyer || !walletManager) {
          addLog('error', 'Services not initialized');
          return;
        }

        const wallets = walletManager.getRandomWallets(walletCount, true);
        if (wallets.length < walletCount) {
          addLog('error', `Not enough funded wallets. Have ${wallets.length}, need ${walletCount}`);
          return;
        }

        set({ isLoading: true, loadingMessage: 'Executing spread buy...' });
        addLog('info', `Starting spread buy: ${totalAmount} SOL across ${walletCount} wallets`);

        try {
          const result = await pumpFunBuyer.executeSpreadBuy(
            new PublicKey(mintAddress),
            wallets,
            totalAmount,
            settings.slippageBps,
            settings.buyDelayMinMs,
            settings.buyDelayMaxMs,
            (current, total, wallet, status, signature) => {
              if (onProgress) onProgress(current, total, wallet, status);
              if (status === 'success') {
                addLog('success', `[${current}/${total}] Bought with ${wallet.slice(0, 8)}...`);
              } else if (status === 'failed') {
                addLog('error', `[${current}/${total}] Failed with ${wallet.slice(0, 8)}...`);
              }
            }
          );

          set({ holdings: pumpFunBuyer.getHoldingsState() });
          await refreshBalances();
          addLog('success', `Buy complete! ${result.successful}/${walletCount} successful`);
        } catch (error) {
          addLog('error', `Buy failed: ${error}`);
        } finally {
          set({ isLoading: false, loadingMessage: '' });
        }
      },

      executeSellAll: async (onProgress) => {
        const { pumpFunBuyer, settings, addLog, refreshBalances } = get();
        if (!pumpFunBuyer) {
          addLog('error', 'Services not initialized');
          return;
        }

        const holdings = pumpFunBuyer.getHoldingsState();
        if (!holdings.token) {
          addLog('warning', 'No holdings to sell');
          return;
        }

        set({ isLoading: true, loadingMessage: 'Selling all positions...' });
        addLog('info', 'Starting sell all...');

        try {
          const result = await pumpFunBuyer.sellAll(
            new PublicKey(holdings.token),
            settings.slippageBps,
            (current, total, wallet, status) => {
              if (onProgress) onProgress(current, total, wallet, status);
              addLog('info', `[${current}/${total}] ${status} - ${wallet.slice(0, 8)}...`);
            }
          );

          set({ holdings: pumpFunBuyer.getHoldingsState() });
          await refreshBalances();
          addLog('success', `Sold from ${result.walletsSold} wallets, received ${result.totalSolReceived.toFixed(4)} SOL`);
        } catch (error) {
          addLog('error', `Sell failed: ${error}`);
        } finally {
          set({ isLoading: false, loadingMessage: '' });
        }
      },

      clearHoldings: () => {
        const { pumpFunBuyer } = get();
        if (pumpFunBuyer) {
          pumpFunBuyer.clearHoldings();
          set({
            holdings: {
              token: null,
              totalWallets: 0,
              totalTokens: '0',
              totalSolSpent: 0,
              holdings: [],
            },
            currentTokenInfo: null,
          });
        }
      },
    }),
    {
      name: 'pumpfun-bot-storage',
      partialize: (state) => ({
        settings: state.settings,
        logs: state.logs.slice(0, 50),
      }),
    }
  )
);
