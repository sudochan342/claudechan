import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { SolanaService } from '../services/solana';
import { WalletManager } from './wallet-manager';
import { StealthFundingConfig, FundingPath, BundleWallet } from '../types';
import {
  sleep,
  randomDelay,
  randomizeAmount,
  solToLamports,
  lamportsToSol,
  generateKeypair,
  shuffleArray,
} from '../utils/helpers';

/**
 * Stealth Funder - Funds wallets while avoiding Bubblemaps detection
 *
 * Techniques used:
 * 1. Intermediate wallets - Funds go through multiple hops
 * 2. Random delays - Transactions are spread over time
 * 3. Amount variance - Each wallet gets slightly different amounts
 * 4. Shuffled order - Wallets are funded in random order
 * 5. Multiple funding paths - Uses different routes for each wallet
 * 6. Time-based spreading - Funds are distributed across different time windows
 */
export class StealthFunder {
  private solanaService: SolanaService;
  private walletManager: WalletManager;
  private config: StealthFundingConfig;
  private intermediateWallets: Keypair[] = [];

  constructor(
    solanaService: SolanaService,
    walletManager: WalletManager,
    config?: Partial<StealthFundingConfig>
  ) {
    this.solanaService = solanaService;
    this.walletManager = walletManager;
    this.config = {
      minDelayMs: config?.minDelayMs ?? 5000,
      maxDelayMs: config?.maxDelayMs ?? 30000,
      useIntermediateWallets: config?.useIntermediateWallets ?? true,
      intermediateWalletCount: config?.intermediateWalletCount ?? 3,
      randomizeAmounts: config?.randomizeAmounts ?? true,
      amountVariancePercent: config?.amountVariancePercent ?? 15,
    };
  }

  /**
   * Generate intermediate wallets for stealth funding
   */
  private generateIntermediateWallets(): Keypair[] {
    const wallets: Keypair[] = [];
    for (let i = 0; i < this.config.intermediateWalletCount; i++) {
      wallets.push(generateKeypair());
    }
    this.intermediateWallets = wallets;
    console.log(`Generated ${wallets.length} intermediate wallets for stealth funding`);
    return wallets;
  }

  /**
   * Create funding paths to avoid direct connections
   *
   * Strategy:
   * - Master -> Intermediate1 -> Target (1 hop)
   * - Master -> Intermediate1 -> Intermediate2 -> Target (2 hops)
   * - Mix different paths to create noise
   */
  private createFundingPaths(
    masterWallet: Keypair,
    targetWallets: BundleWallet[],
    amountPerWallet: number
  ): FundingPath[] {
    const paths: FundingPath[] = [];
    const shuffledTargets = shuffleArray(targetWallets);
    const intermediates = this.generateIntermediateWallets();

    shuffledTargets.forEach((target, index) => {
      // Calculate amount with variance
      const amount = this.config.randomizeAmounts
        ? randomizeAmount(amountPerWallet, this.config.amountVariancePercent)
        : amountPerWallet;

      // Add delay between transactions
      const delay = randomDelay(this.config.minDelayMs, this.config.maxDelayMs);

      if (this.config.useIntermediateWallets && intermediates.length > 0) {
        // Use different routing strategies
        const strategy = index % 3;

        switch (strategy) {
          case 0:
            // Single hop through one intermediate
            const singleIntermediate = intermediates[index % intermediates.length];
            paths.push({
              from: masterWallet,
              to: new PublicKey(target.info.publicKey),
              amount,
              intermediate: [singleIntermediate],
              delay,
            });
            break;

          case 1:
            // Two hops through two intermediates
            const firstIntermediate = intermediates[index % intermediates.length];
            const secondIntermediate = intermediates[(index + 1) % intermediates.length];
            paths.push({
              from: masterWallet,
              to: new PublicKey(target.info.publicKey),
              amount,
              intermediate: [firstIntermediate, secondIntermediate],
              delay: delay * 1.5, // Longer delay for multi-hop
            });
            break;

          case 2:
            // Direct transfer with extra delay (some noise)
            paths.push({
              from: masterWallet,
              to: new PublicKey(target.info.publicKey),
              amount,
              delay: delay * 2, // Extra long delay for direct transfers
            });
            break;
        }
      } else {
        // Direct transfer
        paths.push({
          from: masterWallet,
          to: new PublicKey(target.info.publicKey),
          amount,
          delay,
        });
      }
    });

    return paths;
  }

  /**
   * Fund intermediate wallets first
   */
  private async fundIntermediates(
    masterWallet: Keypair,
    totalAmount: number
  ): Promise<void> {
    if (!this.config.useIntermediateWallets || this.intermediateWallets.length === 0) {
      return;
    }

    // Each intermediate gets a portion of the total plus buffer for fees
    const amountPerIntermediate = (totalAmount / this.intermediateWallets.length) * 1.1;

    console.log(`Funding ${this.intermediateWallets.length} intermediate wallets...`);

    for (const intermediate of this.intermediateWallets) {
      const delay = randomDelay(2000, 8000);
      await sleep(delay);

      try {
        const sig = await this.solanaService.sendSol(
          masterWallet,
          intermediate.publicKey,
          amountPerIntermediate,
          1000 // Priority fee
        );
        console.log(`Funded intermediate ${intermediate.publicKey.toBase58().slice(0, 8)}... : ${sig.slice(0, 8)}...`);
      } catch (error) {
        console.error(`Failed to fund intermediate: ${error}`);
        throw error;
      }
    }

    // Wait for confirmations
    await sleep(3000);
  }

  /**
   * Execute a single funding path
   */
  private async executeFundingPath(path: FundingPath): Promise<string[]> {
    const signatures: string[] = [];

    if (path.intermediate && path.intermediate.length > 0) {
      // Multi-hop transfer
      let currentSender = path.from;
      let currentAmount = path.amount + 0.001 * path.intermediate.length; // Add fees

      for (let i = 0; i < path.intermediate.length; i++) {
        const isLast = i === path.intermediate.length - 1;
        const recipient = isLast ? path.to : path.intermediate[i + 1]?.publicKey;
        const sendAmount = isLast ? path.amount : currentAmount - 0.001;

        const intermediateKeypair = path.intermediate[i];

        // First, fund intermediate from current sender
        if (i === 0) {
          const sig = await this.solanaService.sendSol(
            currentSender,
            intermediateKeypair.publicKey,
            currentAmount,
            1000
          );
          signatures.push(sig);
          await sleep(randomDelay(1000, 3000));
        }

        // Then send from intermediate to next target
        const sig = await this.solanaService.sendSol(
          intermediateKeypair,
          recipient!,
          sendAmount,
          1000
        );
        signatures.push(sig);
        currentAmount = sendAmount;

        if (!isLast) {
          await sleep(randomDelay(2000, 5000));
        }
      }
    } else {
      // Direct transfer
      const sig = await this.solanaService.sendSol(
        path.from,
        path.to,
        path.amount,
        1000
      );
      signatures.push(sig);
    }

    return signatures;
  }

  /**
   * Execute stealth funding for multiple wallets
   */
  async fundWallets(
    masterWallet: Keypair,
    targetWallets: BundleWallet[],
    totalAmount: number,
    onProgress?: (current: number, total: number, wallet: string) => void
  ): Promise<{ success: boolean; funded: number; signatures: string[] }> {
    const amountPerWallet = totalAmount / targetWallets.length;
    const allSignatures: string[] = [];
    let fundedCount = 0;

    console.log(`\n🔒 Starting stealth funding for ${targetWallets.length} wallets`);
    console.log(`Amount per wallet: ~${amountPerWallet.toFixed(4)} SOL`);
    console.log(`Using intermediate wallets: ${this.config.useIntermediateWallets}`);
    console.log(`Random delays: ${this.config.minDelayMs}ms - ${this.config.maxDelayMs}ms\n`);

    // Check master balance
    const masterBalance = await this.solanaService.getBalanceSol(masterWallet.publicKey);
    const requiredAmount = totalAmount + 0.01 * targetWallets.length + 0.05; // Include fees buffer

    if (masterBalance < requiredAmount) {
      throw new Error(
        `Insufficient balance in master wallet. Have: ${masterBalance.toFixed(4)} SOL, Need: ${requiredAmount.toFixed(4)} SOL`
      );
    }

    // Create funding paths
    const paths = this.createFundingPaths(masterWallet, targetWallets, amountPerWallet);

    // Fund intermediate wallets if using multi-hop
    if (this.config.useIntermediateWallets) {
      await this.fundIntermediates(masterWallet, totalAmount);
    }

    // Execute funding paths with delays
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const targetAddress = path.to.toBase58();

      if (onProgress) {
        onProgress(i + 1, paths.length, targetAddress);
      }

      try {
        console.log(`[${i + 1}/${paths.length}] Funding ${targetAddress.slice(0, 8)}... with ${path.amount.toFixed(4)} SOL`);

        // Wait for the configured delay
        if (i > 0) {
          console.log(`Waiting ${(path.delay / 1000).toFixed(1)}s before next transaction...`);
          await sleep(path.delay);
        }

        const signatures = await this.executeFundingPath(path);
        allSignatures.push(...signatures);

        // Update wallet info
        this.walletManager.markAsFunded(targetAddress, solToLamports(path.amount));
        fundedCount++;

        console.log(`✅ Funded successfully`);
      } catch (error) {
        console.error(`❌ Failed to fund ${targetAddress}: ${error}`);
        // Continue with other wallets
      }
    }

    console.log(`\n🎉 Stealth funding complete!`);
    console.log(`Funded: ${fundedCount}/${targetWallets.length} wallets`);
    console.log(`Total transactions: ${allSignatures.length}`);

    return {
      success: fundedCount > 0,
      funded: fundedCount,
      signatures: allSignatures,
    };
  }

  /**
   * Quick fund - Direct funding without stealth (faster but detectable)
   */
  async quickFund(
    masterWallet: Keypair,
    targetWallets: BundleWallet[],
    amountPerWallet: number
  ): Promise<{ success: boolean; funded: number; signatures: string[] }> {
    const signatures: string[] = [];
    let funded = 0;

    for (const target of targetWallets) {
      try {
        const sig = await this.solanaService.sendSol(
          masterWallet,
          new PublicKey(target.info.publicKey),
          amountPerWallet
        );
        signatures.push(sig);
        this.walletManager.markAsFunded(target.info.publicKey, solToLamports(amountPerWallet));
        funded++;
      } catch (error) {
        console.error(`Failed to fund ${target.info.publicKey}: ${error}`);
      }
    }

    return { success: funded > 0, funded, signatures };
  }

  /**
   * Collect remaining funds back to master wallet
   */
  async collectFunds(
    targetWallets: BundleWallet[],
    destinationWallet: PublicKey
  ): Promise<{ collected: number; totalAmount: number }> {
    let collected = 0;
    let totalAmount = 0;

    for (const wallet of targetWallets) {
      try {
        const balance = await this.solanaService.getBalance(new PublicKey(wallet.info.publicKey));
        const sendAmount = balance - 5000; // Leave some for rent

        if (sendAmount > 0) {
          await this.solanaService.sendSol(
            wallet.keypair,
            destinationWallet,
            lamportsToSol(sendAmount)
          );
          totalAmount += sendAmount;
          collected++;
        }
      } catch (error) {
        console.error(`Failed to collect from ${wallet.info.publicKey}: ${error}`);
      }
    }

    return { collected, totalAmount };
  }

  /**
   * Get intermediate wallets (for debugging)
   */
  getIntermediateWallets(): Keypair[] {
    return this.intermediateWallets;
  }
}
