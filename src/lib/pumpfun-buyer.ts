import { PublicKey } from '@solana/web3.js';
import { SolanaService } from './solana-service';
import { WalletManager } from './wallet-manager';
import { JupiterService, getJupiterService } from './jupiter-service';
import { BundleWallet, PumpFunTokenInfo, HoldingsState } from './types';
import { lamportsToSol, sleep, randomDelay, shuffleArray } from './helpers';

// Using Jupiter aggregator for swaps - no longer need direct PumpFun program constants

interface WalletHolding {
  wallet: BundleWallet;
  tokenBalance: bigint;
  solSpent: number;
  buyPrice: number;
  buyTime: number;
}

export class PumpFunBuyer {
  private solanaService: SolanaService;
  private walletManager: WalletManager;
  private jupiterService: JupiterService;
  private holdings: Map<string, WalletHolding> = new Map();
  private currentToken: PublicKey | null = null;

  constructor(solanaService: SolanaService, walletManager: WalletManager) {
    this.solanaService = solanaService;
    this.walletManager = walletManager;
    this.jupiterService = getJupiterService(solanaService);
  }

  async executeSingleBuy(
    wallet: BundleWallet,
    mint: PublicKey,
    solAmount: number,
    slippageBps: number,
    _tokenInfo?: PumpFunTokenInfo
  ): Promise<{ success: boolean; signature?: string; tokensReceived?: bigint; error?: string }> {
    // Use Jupiter aggregator instead of direct PumpFun instructions
    // This is more reliable and handles routing automatically
    const result = await this.jupiterService.executeSwap(
      wallet.keypair,
      mint.toBase58(),
      solAmount,
      slippageBps
    );

    if (result.success && result.signature) {
      const tokensReceived = BigInt(result.tokensReceived || '0');

      // Track holding
      this.holdings.set(wallet.info.publicKey, {
        wallet,
        tokenBalance: tokensReceived,
        solSpent: solAmount,
        buyPrice: tokensReceived > 0 ? solAmount / Number(tokensReceived) : 0,
        buyTime: Date.now(),
      });

      return { success: true, signature: result.signature, tokensReceived };
    }

    return { success: false, error: result.error };
  }

  async executeSpreadBuy(
    mint: PublicKey,
    wallets: BundleWallet[],
    totalSolAmount: number,
    slippageBps: number,
    minDelayMs: number = 3000,
    maxDelayMs: number = 10000,
    onProgress?: (current: number, total: number, wallet: string, status: string, signature?: string) => void
  ): Promise<{ success: boolean; signatures: string[]; successful: number }> {
    this.currentToken = mint;
    const shuffledWallets = shuffleArray(wallets);
    const signatures: string[] = [];
    let successful = 0;

    // Get token info
    const tokenInfo = await this.getTokenInfo(mint);

    // Random amounts per wallet
    const baseAmount = totalSolAmount / wallets.length;

    for (let i = 0; i < shuffledWallets.length; i++) {
      const wallet = shuffledWallets[i];

      // Randomize amount (+-30%)
      const variance = (Math.random() - 0.5) * 0.6;
      const amount = baseAmount * (1 + variance);

      if (onProgress) {
        onProgress(i + 1, shuffledWallets.length, wallet.info.publicKey, 'buying');
      }

      const result = await this.executeSingleBuy(wallet, mint, amount, slippageBps, tokenInfo || undefined);

      if (result.success && result.signature) {
        signatures.push(result.signature);
        successful++;
        if (onProgress) {
          onProgress(i + 1, shuffledWallets.length, wallet.info.publicKey, 'success', result.signature);
        }
      } else {
        if (onProgress) {
          // Include error message in status
          const errorStatus = result.error ? `failed: ${result.error.slice(0, 100)}` : 'failed';
          onProgress(i + 1, shuffledWallets.length, wallet.info.publicKey, errorStatus);
        }
      }

      // Wait before next buy
      if (i < shuffledWallets.length - 1) {
        const delay = randomDelay(minDelayMs, maxDelayMs);
        await sleep(delay);
      }
    }

    return {
      success: successful > 0,
      signatures,
      successful,
    };
  }

  async sellAll(
    mint: PublicKey,
    slippageBps: number = 1000,
    onProgress?: (current: number, total: number, wallet: string, status: string) => void
  ): Promise<{ success: boolean; totalSolReceived: number; walletsSold: number }> {
    const holdings = Array.from(this.holdings.values()).filter(
      h => h.tokenBalance > BigInt(0)
    );

    if (holdings.length === 0) {
      return { success: false, totalSolReceived: 0, walletsSold: 0 };
    }

    let totalSolReceived = 0;
    let walletsSold = 0;

    for (let i = 0; i < holdings.length; i++) {
      const holding = holdings[i];
      const wallet = holding.wallet;

      if (onProgress) {
        onProgress(i + 1, holdings.length, wallet.info.publicKey, 'selling');
      }

      try {
        // Get actual token balance
        const actualBalance = await this.solanaService.getTokenBalance(
          wallet.keypair.publicKey,
          mint
        );

        if (actualBalance === 0) {
          continue;
        }

        const tokenAmount = BigInt(actualBalance);

        // Use Jupiter for selling
        const result = await this.jupiterService.executeSell(
          wallet.keypair,
          mint.toBase58(),
          tokenAmount,
          slippageBps
        );

        if (result.success && result.solReceived) {
          const solReceived = lamportsToSol(Number(result.solReceived));
          totalSolReceived += solReceived;
          walletsSold++;

          // Clear holding
          this.holdings.delete(wallet.info.publicKey);

          if (onProgress) {
            onProgress(i + 1, holdings.length, wallet.info.publicKey, 'sold');
          }
        } else {
          if (onProgress) {
            onProgress(i + 1, holdings.length, wallet.info.publicKey, `failed: ${result.error}`);
          }
        }

        // Small delay between sells
        await sleep(randomDelay(1000, 3000));
      } catch (error) {
        console.error('Sell failed:', error);
        if (onProgress) {
          onProgress(i + 1, holdings.length, wallet.info.publicKey, 'failed');
        }
      }
    }

    return {
      success: walletsSold > 0,
      totalSolReceived,
      walletsSold,
    };
  }

  getHoldingsState(): HoldingsState {
    const holdingsArray = Array.from(this.holdings.values());

    if (holdingsArray.length === 0) {
      return {
        token: null,
        totalWallets: 0,
        totalTokens: '0',
        totalSolSpent: 0,
        holdings: [],
      };
    }

    const totalTokens = holdingsArray.reduce((sum, h) => sum + h.tokenBalance, BigInt(0));
    const totalSolSpent = holdingsArray.reduce((sum, h) => sum + h.solSpent, 0);

    return {
      token: this.currentToken?.toBase58() || null,
      totalWallets: holdingsArray.length,
      totalTokens: totalTokens.toString(),
      totalSolSpent,
      holdings: holdingsArray.map(h => ({
        walletAddress: h.wallet.info.publicKey,
        tokenBalance: h.tokenBalance.toString(),
        solSpent: h.solSpent,
        buyTime: h.buyTime,
      })),
    };
  }

  async getTokenInfo(mint: PublicKey): Promise<PumpFunTokenInfo | null> {
    try {
      // Use our API route to avoid CORS issues
      const response = await fetch(`/api/token/${mint.toBase58()}`);
      const data = await response.json();

      if (!response.ok) {
        console.error('Token lookup error:', data.error || 'Unknown error');
        return null;
      }

      return data as PumpFunTokenInfo;
    } catch (error) {
      console.error('Token lookup failed:', error);
      return null;
    }
  }

  clearHoldings(): void {
    this.holdings.clear();
    this.currentToken = null;
  }
}
