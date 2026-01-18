import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { SolanaService } from '../services/solana';
import { WalletManager } from './wallet-manager';
import { StealthFundingConfig, BundleWallet } from '../types';
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
 * Advanced Stealth Funder - CEX-Style Funding to Avoid Bubblemaps Detection
 *
 * Anti-Detection Techniques:
 *
 * 1. CEX-STYLE WITHDRAWAL SIMULATION
 *    - Creates a "hot wallet" pool that mimics exchange behavior
 *    - Multiple hot wallets send to targets (like Binance/Coinbase)
 *    - Random withdrawal amounts (exchanges never send exact amounts)
 *    - Withdrawal fees deducted (mimics real CEX behavior)
 *
 * 2. TIME SPREADING
 *    - Massive delays between transfers (minutes to hours)
 *    - No two wallets funded within same time window
 *    - Randomized scheduling
 *
 * 3. AMOUNT OBFUSCATION
 *    - Wild variance in amounts (not just ±15%, but completely random)
 *    - Some wallets get 0.05, others get 0.12, etc.
 *    - No pattern detectable
 *
 * 4. MULTI-HOP CHAINS
 *    - Master -> Hot Wallet Pool -> Mixer Wallets -> Target
 *    - Each hop has different timing
 *    - Mixer wallets are disposable
 *
 * 5. ANTI-MAGIC-NODES
 *    - Bubblemaps "magic nodes" detect wallets that interact with same contract
 *    - Solution: Spread BUYS over time too, not just funding
 *    - Never buy from multiple wallets in same block
 */

interface HotWallet {
  keypair: Keypair;
  balance: number;
  lastUsed: number;
}

interface FundingSchedule {
  target: PublicKey;
  amount: number;
  executeAt: number; // timestamp
  hotWalletIndex: number;
  mixerChain: Keypair[];
}

export class StealthFunder {
  private solanaService: SolanaService;
  private walletManager: WalletManager;
  private config: StealthFundingConfig;

  // CEX-style hot wallet pool
  private hotWallets: HotWallet[] = [];
  private mixerWallets: Keypair[] = [];

  constructor(
    solanaService: SolanaService,
    walletManager: WalletManager,
    config?: Partial<StealthFundingConfig>
  ) {
    this.solanaService = solanaService;
    this.walletManager = walletManager;
    this.config = {
      minDelayMs: config?.minDelayMs ?? 60000, // 1 minute minimum
      maxDelayMs: config?.maxDelayMs ?? 300000, // 5 minutes max
      useIntermediateWallets: config?.useIntermediateWallets ?? true,
      intermediateWalletCount: config?.intermediateWalletCount ?? 5,
      randomizeAmounts: config?.randomizeAmounts ?? true,
      amountVariancePercent: config?.amountVariancePercent ?? 40, // High variance
    };
  }

  /**
   * Initialize CEX-style hot wallet pool
   * These wallets simulate exchange hot wallets
   */
  async initializeHotWalletPool(masterWallet: Keypair, poolSize: number = 5): Promise<void> {
    console.log(`\n🏦 Initializing CEX-style hot wallet pool (${poolSize} wallets)...`);

    this.hotWallets = [];

    for (let i = 0; i < poolSize; i++) {
      const keypair = generateKeypair();
      this.hotWallets.push({
        keypair,
        balance: 0,
        lastUsed: 0,
      });
    }

    // Fund hot wallets from master with random amounts and delays
    const masterBalance = await this.solanaService.getBalanceSol(masterWallet.publicKey);
    const amountPerHot = (masterBalance * 0.9) / poolSize; // Keep 10% buffer

    for (let i = 0; i < this.hotWallets.length; i++) {
      const hotWallet = this.hotWallets[i];
      // Random amount for each hot wallet
      const amount = randomizeAmount(amountPerHot, 30);

      try {
        await this.solanaService.sendSol(
          masterWallet,
          hotWallet.keypair.publicKey,
          amount
        );
        hotWallet.balance = solToLamports(amount);
        console.log(`   Hot wallet ${i + 1}: ${hotWallet.keypair.publicKey.toBase58().slice(0, 8)}... funded with ${amount.toFixed(4)} SOL`);
      } catch (error) {
        console.error(`   Failed to fund hot wallet ${i + 1}: ${error}`);
      }

      // Random delay between hot wallet funding
      if (i < this.hotWallets.length - 1) {
        const delay = randomDelay(5000, 15000);
        await sleep(delay);
      }
    }

    console.log(`✅ Hot wallet pool ready\n`);
  }

  /**
   * Generate mixer wallet chains for each target
   * Creates disposable intermediate wallets
   */
  private generateMixerChain(depth: number = 2): Keypair[] {
    const chain: Keypair[] = [];
    for (let i = 0; i < depth; i++) {
      chain.push(generateKeypair());
    }
    return chain;
  }

  /**
   * Create funding schedule with maximum randomization
   */
  private createFundingSchedule(
    targetWallets: BundleWallet[],
    totalAmount: number
  ): FundingSchedule[] {
    const schedules: FundingSchedule[] = [];
    const shuffledTargets = shuffleArray(targetWallets);

    // Calculate base amount but with WILD variance
    const baseAmount = totalAmount / targetWallets.length;

    let currentTime = Date.now();

    for (let i = 0; i < shuffledTargets.length; i++) {
      const target = shuffledTargets[i];

      // Completely random amount within range
      const minAmount = baseAmount * 0.5;
      const maxAmount = baseAmount * 1.5;
      const amount = minAmount + Math.random() * (maxAmount - minAmount);

      // Simulate CEX "withdrawal fee" (makes amounts look more realistic)
      const withdrawalFee = 0.0001 + Math.random() * 0.0005;
      const finalAmount = amount - withdrawalFee;

      // Random delay - much longer for stealth
      const delay = randomDelay(this.config.minDelayMs, this.config.maxDelayMs);
      currentTime += delay;

      // Select hot wallet (round-robin with some randomness)
      const hotWalletIndex = (i + Math.floor(Math.random() * 2)) % this.hotWallets.length;

      // Generate mixer chain (1-3 hops)
      const mixerDepth = 1 + Math.floor(Math.random() * 3);
      const mixerChain = this.config.useIntermediateWallets
        ? this.generateMixerChain(mixerDepth)
        : [];

      schedules.push({
        target: new PublicKey(target.info.publicKey),
        amount: finalAmount,
        executeAt: currentTime,
        hotWalletIndex,
        mixerChain,
      });
    }

    return schedules;
  }

  /**
   * Execute a single funding through mixer chain
   */
  private async executeFundingChain(
    schedule: FundingSchedule,
    hotWallet: HotWallet
  ): Promise<string[]> {
    const signatures: string[] = [];
    const totalNeeded = schedule.amount + 0.001 * (schedule.mixerChain.length + 1);

    if (schedule.mixerChain.length === 0) {
      // Direct transfer from hot wallet (still looks like CEX withdrawal)
      const sig = await this.solanaService.sendSol(
        hotWallet.keypair,
        schedule.target,
        schedule.amount
      );
      signatures.push(sig);
      return signatures;
    }

    // Fund first mixer from hot wallet
    let currentSender = hotWallet.keypair;
    let currentAmount = totalNeeded;

    for (let i = 0; i < schedule.mixerChain.length; i++) {
      const mixer = schedule.mixerChain[i];
      const isLast = i === schedule.mixerChain.length - 1;

      // Send to mixer
      const sig = await this.solanaService.sendSol(
        currentSender,
        mixer.publicKey,
        currentAmount
      );
      signatures.push(sig);

      // Small delay between hops
      await sleep(randomDelay(2000, 8000));

      currentSender = mixer;
      currentAmount = currentAmount - 0.001; // Subtract fee
    }

    // Final transfer from last mixer to target
    const finalSig = await this.solanaService.sendSol(
      currentSender,
      schedule.target,
      schedule.amount
    );
    signatures.push(finalSig);

    return signatures;
  }

  /**
   * Main funding function - CEX-style stealth funding
   */
  async fundWalletsCEXStyle(
    masterWallet: Keypair,
    targetWallets: BundleWallet[],
    totalAmount: number,
    onProgress?: (current: number, total: number, wallet: string, eta: string) => void
  ): Promise<{ success: boolean; funded: number; signatures: string[] }> {
    console.log(`\n🔒 Starting CEX-Style Stealth Funding`);
    console.log(`   Target wallets: ${targetWallets.length}`);
    console.log(`   Total amount: ${totalAmount} SOL`);
    console.log(`   Mode: Maximum stealth (anti-Bubblemaps + anti-magic-nodes)\n`);

    // Initialize hot wallet pool if not done
    if (this.hotWallets.length === 0) {
      await this.initializeHotWalletPool(masterWallet, 5);
    }

    // Create randomized funding schedule
    const schedules = this.createFundingSchedule(targetWallets, totalAmount);

    const allSignatures: string[] = [];
    let fundedCount = 0;

    // Calculate total time needed
    const totalTimeMs = schedules[schedules.length - 1].executeAt - Date.now();
    console.log(`📅 Funding will complete in ~${Math.ceil(totalTimeMs / 60000)} minutes\n`);

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      const hotWallet = this.hotWallets[schedule.hotWalletIndex];
      const targetAddress = schedule.target.toBase58();

      // Wait until scheduled time
      const waitTime = schedule.executeAt - Date.now();
      if (waitTime > 0) {
        const eta = new Date(schedule.executeAt).toLocaleTimeString();
        if (onProgress) {
          onProgress(i + 1, schedules.length, targetAddress, eta);
        }
        console.log(`⏳ [${i + 1}/${schedules.length}] Waiting ${Math.ceil(waitTime / 1000)}s for next transfer (ETA: ${eta})`);
        await sleep(waitTime);
      }

      try {
        console.log(`📤 Funding ${targetAddress.slice(0, 8)}... with ${schedule.amount.toFixed(4)} SOL`);
        console.log(`   Route: Hot${schedule.hotWalletIndex + 1} -> ${schedule.mixerChain.length} mixers -> Target`);

        const signatures = await this.executeFundingChain(schedule, hotWallet);
        allSignatures.push(...signatures);

        // Update wallet info
        this.walletManager.markAsFunded(targetAddress, solToLamports(schedule.amount));
        fundedCount++;

        console.log(`   ✅ Done (${signatures.length} txs)\n`);
      } catch (error) {
        console.error(`   ❌ Failed: ${error}\n`);
      }
    }

    console.log(`\n🎉 CEX-Style Funding Complete!`);
    console.log(`   Funded: ${fundedCount}/${targetWallets.length}`);
    console.log(`   Total transactions: ${allSignatures.length}`);

    return {
      success: fundedCount > 0,
      funded: fundedCount,
      signatures: allSignatures,
    };
  }

  /**
   * Quick fund - for testing only (NOT stealth)
   */
  async quickFund(
    masterWallet: Keypair,
    targetWallets: BundleWallet[],
    amountPerWallet: number
  ): Promise<{ success: boolean; funded: number; signatures: string[] }> {
    console.log(`\n⚡ Quick funding (NOT stealth!) - ${targetWallets.length} wallets`);

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
        console.error(`Failed: ${target.info.publicKey}: ${error}`);
      }
    }

    return { success: funded > 0, funded, signatures };
  }

  /**
   * Collect all funds back to a wallet
   */
  async collectFunds(
    targetWallets: BundleWallet[],
    destinationWallet: PublicKey
  ): Promise<{ collected: number; totalAmount: number; signatures: string[] }> {
    console.log(`\n💸 Collecting funds from ${targetWallets.length} wallets...`);

    let collected = 0;
    let totalAmount = 0;
    const signatures: string[] = [];

    for (const wallet of targetWallets) {
      try {
        const balance = await this.solanaService.getBalance(new PublicKey(wallet.info.publicKey));
        const sendAmount = balance - 5000; // Leave rent

        if (sendAmount > 0) {
          const sig = await this.solanaService.sendSol(
            wallet.keypair,
            destinationWallet,
            lamportsToSol(sendAmount)
          );
          signatures.push(sig);
          totalAmount += sendAmount;
          collected++;
          console.log(`   ${wallet.info.publicKey.slice(0, 8)}...: ${lamportsToSol(sendAmount).toFixed(4)} SOL`);
        }
      } catch (error) {
        console.error(`   Failed ${wallet.info.publicKey.slice(0, 8)}...: ${error}`);
      }
    }

    console.log(`\n✅ Collected ${lamportsToSol(totalAmount).toFixed(4)} SOL from ${collected} wallets`);

    return { collected, totalAmount, signatures };
  }

  /**
   * Get hot wallet info for debugging
   */
  getHotWalletInfo(): { address: string; balance: number }[] {
    return this.hotWallets.map(hw => ({
      address: hw.keypair.publicKey.toBase58(),
      balance: lamportsToSol(hw.balance),
    }));
  }
}
