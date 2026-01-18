'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Keypair, PublicKey } from '@solana/web3.js';
import { TabType, LogEntry, BotSettings, HoldingsState, PumpFunTokenInfo, WalletInfo, BundleWallet } from '@/lib/types';
import { SolanaService, getSolanaService } from '@/lib/solana-service';
import { WalletManager } from '@/lib/wallet-manager';
import { PumpFunBuyer } from '@/lib/pumpfun-buyer';
import { generateId, keypairFromBase58, lamportsToSol, solToLamports, generateKeypair, sleep, randomDelay } from '@/lib/helpers';

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
  initServices: () => Promise<void>;

  // Wallet actions
  generateWallets: (count: number) => Promise<BundleWallet[]>;
  refreshBalances: () => Promise<void>;
  deleteAllWallets: () => Promise<void>;
  importWallets: (privateKeys: string[]) => Promise<number>;
  exportWallets: () => string;

  // Master wallet
  getMasterKeypair: () => Keypair | null;
  refreshMasterBalance: () => Promise<void>;

  // Funding actions
  quickFundWallets: (amountPerWallet: number) => Promise<void>;
  stealthFundWallets: (
    amountPerWallet: number,
    intermediateCount?: number,
    onProgress?: (step: string, current: number, total: number) => void
  ) => Promise<void>;
  collectAllFunds: () => Promise<void>;

  // Buy/Sell actions
  lookupToken: (mintAddress: string) => Promise<PumpFunTokenInfo | null>;
  refreshTokenInfo: () => Promise<PumpFunTokenInfo | null>;
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

      initServices: async () => {
        const { settings, addLog } = get();
        const solanaService = getSolanaService(settings.rpcUrl);
        const walletManager = new WalletManager(solanaService);

        // Initialize wallet manager (loads from database)
        try {
          await walletManager.initialize();
        } catch (e) {
          console.error('Failed to initialize wallet manager:', e);
        }

        const pumpFunBuyer = new PumpFunBuyer(solanaService, walletManager);

        set({
          solanaService,
          walletManager,
          pumpFunBuyer,
          wallets: walletManager.getAllWallets().map(w => w.info),
        });

        addLog('info', 'Services initialized');
      },

      // Wallet actions
      generateWallets: async (count) => {
        const { walletManager, addLog } = get();
        if (!walletManager) {
          addLog('error', 'Services not initialized');
          return [];
        }

        set({ isLoading: true, loadingMessage: `Generating ${count} wallets...` });

        try {
          const newWallets = await walletManager.generateWallets(count);
          set({ wallets: walletManager.getAllWallets().map(w => w.info) });
          addLog('success', `Generated ${count} new wallets`);
          return newWallets;
        } catch (error) {
          addLog('error', `Failed to generate wallets: ${error}`);
          return [];
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

      deleteAllWallets: async () => {
        const { walletManager, addLog } = get();
        if (!walletManager) return;

        await walletManager.deleteAllWallets();
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

        const imported = await walletManager.importWallets(privateKeys);
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
        const MAX_RETRIES = 3;

        for (const wallet of unfunded) {
          let success = false;
          let lastError: unknown = null;

          for (let attempt = 1; attempt <= MAX_RETRIES && !success; attempt++) {
            try {
              set({ loadingMessage: `Funding wallet ${funded + 1}/${unfunded.length}${attempt > 1 ? ` (retry ${attempt})` : ''}...` });
              addLog('info', `Funding ${wallet.info.publicKey.slice(0, 8)}...${attempt > 1 ? ` (attempt ${attempt})` : ''}`);

              await solanaService.sendSol(
                masterKeypair,
                new PublicKey(wallet.info.publicKey),
                amountPerWallet
              );

              await walletManager.markAsFunded(wallet.info.publicKey, solToLamports(amountPerWallet));
              funded++;
              success = true;
            } catch (error) {
              lastError = error;
              if (attempt < MAX_RETRIES) {
                // Wait before retry with exponential backoff
                const waitMs = Math.pow(2, attempt) * 1000;
                addLog('warning', `Retry ${attempt} failed, waiting ${waitMs / 1000}s...`);
                await sleep(waitMs);
              }
            }
          }

          if (!success) {
            addLog('error', `Failed to fund ${wallet.info.publicKey.slice(0, 8)}... after ${MAX_RETRIES} attempts: ${lastError}`);
          }

          // Small delay between wallets to avoid rate limiting
          await sleep(500);
        }

        await refreshBalances();
        await get().refreshMasterBalance();
        addLog('success', `Funded ${funded}/${unfunded.length} wallets`);
        set({ isLoading: false, loadingMessage: '' });
      },

      stealthFundWallets: async (amountPerWallet, intermediateCount = 3, onProgress) => {
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

        set({ isLoading: true, loadingMessage: 'Stealth funding in progress...' });
        addLog('info', `Starting stealth funding for ${unfunded.length} wallets via ${intermediateCount} intermediate wallets`);

        try {
          // Step 1: Create intermediate wallets
          const intermediateWallets: Keypair[] = [];
          for (let i = 0; i < intermediateCount; i++) {
            intermediateWallets.push(generateKeypair());
          }
          addLog('info', `Created ${intermediateCount} intermediate wallets`);
          if (onProgress) onProgress('Creating intermediate wallets', intermediateCount, intermediateCount);

          // Calculate how much each intermediate needs (split unfunded wallets among them)
          const walletsPerIntermediate = Math.ceil(unfunded.length / intermediateCount);
          const txFee = 0.00005; // Estimated tx fee
          const amountPerIntermediate = (amountPerWallet + txFee) * walletsPerIntermediate + txFee;

          // Step 2: Fund intermediate wallets from master (with retry)
          addLog('info', 'Funding intermediate wallets from master...');
          const MAX_RETRIES = 3;
          const fundedIntermediates: number[] = [];

          for (let i = 0; i < intermediateWallets.length; i++) {
            const intermediate = intermediateWallets[i];
            let success = false;

            for (let attempt = 1; attempt <= MAX_RETRIES && !success; attempt++) {
              try {
                await solanaService.sendSol(
                  masterKeypair,
                  intermediate.publicKey,
                  amountPerIntermediate
                );
                addLog('info', `Funded intermediate ${i + 1}/${intermediateCount}`);
                if (onProgress) onProgress('Funding intermediates', i + 1, intermediateCount);
                fundedIntermediates.push(i);
                success = true;
              } catch (error) {
                if (attempt < MAX_RETRIES) {
                  const waitMs = Math.pow(2, attempt) * 1000;
                  addLog('warning', `Intermediate ${i + 1} retry ${attempt}, waiting ${waitMs / 1000}s...`);
                  await sleep(waitMs);
                } else {
                  addLog('error', `Failed to fund intermediate ${i + 1} after ${MAX_RETRIES} attempts: ${error}`);
                }
              }
            }

            // Random delay between intermediate funding
            await sleep(randomDelay(1000, 3000));
          }

          if (fundedIntermediates.length === 0) {
            throw new Error('Failed to fund any intermediate wallets');
          }

          // Step 3: Wait a bit to break timing patterns
          addLog('info', 'Waiting to break timing patterns...');
          await sleep(randomDelay(3000, 6000));

          // Step 4: Fund target wallets from intermediate wallets (with retry)
          let funded = 0;
          for (let i = 0; i < unfunded.length; i++) {
            const targetWallet = unfunded[i];
            // Only use intermediate wallets that were successfully funded
            const intermediateIndex = fundedIntermediates[i % fundedIntermediates.length];
            const intermediate = intermediateWallets[intermediateIndex];
            let success = false;

            for (let attempt = 1; attempt <= MAX_RETRIES && !success; attempt++) {
              try {
                set({ loadingMessage: `Stealth funding wallet ${i + 1}/${unfunded.length}${attempt > 1 ? ` (retry ${attempt})` : ''}...` });
                await solanaService.sendSol(
                  intermediate,
                  new PublicKey(targetWallet.info.publicKey),
                  amountPerWallet
                );
                await walletManager.markAsFunded(targetWallet.info.publicKey, solToLamports(amountPerWallet));
                funded++;
                addLog('info', `Funded ${targetWallet.info.publicKey.slice(0, 8)}... from intermediate ${intermediateIndex + 1}`);
                if (onProgress) onProgress('Funding target wallets', i + 1, unfunded.length);
                success = true;
              } catch (error) {
                if (attempt < MAX_RETRIES) {
                  const waitMs = Math.pow(2, attempt) * 1000;
                  addLog('warning', `Wallet ${targetWallet.info.publicKey.slice(0, 8)} retry ${attempt}, waiting ${waitMs / 1000}s...`);
                  await sleep(waitMs);
                } else {
                  addLog('error', `Failed to fund ${targetWallet.info.publicKey.slice(0, 8)}... after ${MAX_RETRIES} attempts: ${error}`);
                }
              }
            }

            // Random delay between target wallet funding
            await sleep(randomDelay(2000, 5000));
          }

          // Step 5: Drain remaining dust from intermediate wallets back to master
          addLog('info', 'Cleaning up intermediate wallets...');
          let totalDustRecovered = 0;
          for (let i = 0; i < intermediateWallets.length; i++) {
            const intermediate = intermediateWallets[i];
            try {
              const balance = await solanaService.getBalance(intermediate.publicKey);
              const dustAmount = balance - 5000; // Leave minimum for rent
              if (dustAmount > 0) {
                await solanaService.sendSol(
                  intermediate,
                  masterKeypair.publicKey,
                  lamportsToSol(dustAmount)
                );
                totalDustRecovered += dustAmount;
              }
            } catch (error) {
              // Ignore dust collection errors
            }
          }

          if (totalDustRecovered > 0) {
            addLog('info', `Recovered ${lamportsToSol(totalDustRecovered).toFixed(6)} SOL dust from intermediates`);
          }

          await refreshBalances();
          await get().refreshMasterBalance();
          addLog('success', `Stealth funded ${funded}/${unfunded.length} wallets (chain: master→intermediate→target)`);
        } catch (error) {
          addLog('error', `Stealth funding failed: ${error}`);
        } finally {
          set({ isLoading: false, loadingMessage: '' });
        }
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

      refreshTokenInfo: async () => {
        const { holdings, pumpFunBuyer } = get();
        if (!pumpFunBuyer || !holdings.token) {
          return null;
        }

        try {
          const info = await pumpFunBuyer.getTokenInfo(new PublicKey(holdings.token));
          if (info) {
            set({ currentTokenInfo: info });
          }
          return info;
        } catch {
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
              } else if (status.startsWith('failed')) {
                addLog('error', `[${current}/${total}] ${wallet.slice(0, 8)}... ${status}`);
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
