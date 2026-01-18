import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createBurnInstruction,
} from '@solana/spl-token';
import { SolanaService } from '../services/solana';
import { WalletManager } from './wallet-manager';
import { BundleWallet, BundleResult, PumpFunTokenInfo } from '../types';
import { solToLamports, lamportsToSol, sleep, randomDelay, shuffleArray } from '../utils/helpers';

// PumpFun Program Constants
const PUMPFUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMPFUN_GLOBAL = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
const PUMPFUN_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
const PUMPFUN_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');

// Discriminators
const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);

// Wallet holdings tracker
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

  // Track holdings for sell all
  private holdings: Map<string, WalletHolding> = new Map();
  private currentToken: PublicKey | null = null;

  constructor(
    solanaService: SolanaService,
    walletManager: WalletManager
  ) {
    this.solanaService = solanaService;
    this.walletManager = walletManager;
  }

  /**
   * Derive PumpFun bonding curve PDA
   */
  deriveBondingCurve(mint: PublicKey): PublicKey {
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mint.toBuffer()],
      PUMPFUN_PROGRAM_ID
    );
    return bondingCurve;
  }

  /**
   * Derive associated bonding curve token account
   */
  deriveAssociatedBondingCurve(mint: PublicKey, bondingCurve: PublicKey): PublicKey {
    const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
      [bondingCurve.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return associatedBondingCurve;
  }

  /**
   * Calculate tokens out for a given SOL amount
   */
  calculateTokensOut(
    solAmount: number,
    virtualSolReserves: number,
    virtualTokenReserves: number,
    slippageBps: number
  ): bigint {
    const solIn = BigInt(solToLamports(solAmount));
    const solReserves = BigInt(virtualSolReserves);
    const tokenReserves = BigInt(virtualTokenReserves);

    const tokensOut = tokenReserves - (solReserves * tokenReserves) / (solReserves + solIn);
    const minTokensOut = (tokensOut * BigInt(10000 - slippageBps)) / BigInt(10000);

    return minTokensOut;
  }

  /**
   * Calculate SOL out for a given token amount
   */
  calculateSolOut(
    tokenAmount: bigint,
    virtualSolReserves: number,
    virtualTokenReserves: number,
    slippageBps: number
  ): bigint {
    const tokenIn = tokenAmount;
    const solReserves = BigInt(virtualSolReserves);
    const tokenReserves = BigInt(virtualTokenReserves);

    const solOut = solReserves - (solReserves * tokenReserves) / (tokenReserves + tokenIn);
    const minSolOut = (solOut * BigInt(10000 - slippageBps)) / BigInt(10000);

    return minSolOut;
  }

  /**
   * Create buy instruction
   */
  createBuyInstruction(
    wallet: PublicKey,
    mint: PublicKey,
    bondingCurve: PublicKey,
    associatedBondingCurve: PublicKey,
    associatedUser: PublicKey,
    solAmount: number,
    minTokensOut: bigint
  ): TransactionInstruction {
    const data = Buffer.alloc(24);
    BUY_DISCRIMINATOR.copy(data, 0);
    data.writeBigUInt64LE(minTokensOut, 8);
    data.writeBigUInt64LE(BigInt(solToLamports(solAmount)), 16);

    const keys = [
      { pubkey: PUMPFUN_GLOBAL, isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedUser, isSigner: false, isWritable: true },
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      programId: PUMPFUN_PROGRAM_ID,
      keys,
      data,
    });
  }

  /**
   * Create sell instruction
   */
  createSellInstruction(
    wallet: PublicKey,
    mint: PublicKey,
    bondingCurve: PublicKey,
    associatedBondingCurve: PublicKey,
    associatedUser: PublicKey,
    tokenAmount: bigint,
    minSolOut: bigint
  ): TransactionInstruction {
    const data = Buffer.alloc(24);
    SELL_DISCRIMINATOR.copy(data, 0);
    data.writeBigUInt64LE(tokenAmount, 8);
    data.writeBigUInt64LE(minSolOut, 16);

    const keys = [
      { pubkey: PUMPFUN_GLOBAL, isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedUser, isSigner: false, isWritable: true },
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      programId: PUMPFUN_PROGRAM_ID,
      keys,
      data,
    });
  }

  /**
   * Execute a single buy transaction
   */
  async executeSingleBuy(
    wallet: BundleWallet,
    mint: PublicKey,
    solAmount: number,
    slippageBps: number,
    tokenInfo?: PumpFunTokenInfo
  ): Promise<{ success: boolean; signature?: string; tokensReceived?: bigint }> {
    const bondingCurve = this.deriveBondingCurve(mint);
    const associatedBondingCurve = this.deriveAssociatedBondingCurve(mint, bondingCurve);
    const associatedUser = await getAssociatedTokenAddress(mint, wallet.keypair.publicKey);

    const instructions: TransactionInstruction[] = [];

    // Compute budget
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })
    );

    // Create ATA if needed
    const ataInfo = await this.solanaService.getConnection().getAccountInfo(associatedUser);
    if (!ataInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          wallet.keypair.publicKey,
          associatedUser,
          wallet.keypair.publicKey,
          mint
        )
      );
    }

    // Calculate tokens
    const virtualSolReserves = tokenInfo?.virtualSolReserves ?? 30 * 1e9;
    const virtualTokenReserves = tokenInfo?.virtualTokenReserves ?? 1000000000 * 1e6;
    const minTokensOut = this.calculateTokensOut(solAmount, virtualSolReserves, virtualTokenReserves, slippageBps);

    // Add buy instruction
    instructions.push(
      this.createBuyInstruction(
        wallet.keypair.publicKey,
        mint,
        bondingCurve,
        associatedBondingCurve,
        associatedUser,
        solAmount,
        minTokensOut
      )
    );

    try {
      const { blockhash } = await this.solanaService.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: wallet.keypair.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([wallet.keypair]);

      const signature = await this.solanaService.sendVersionedTransaction(transaction);

      // Track holding
      this.holdings.set(wallet.info.publicKey, {
        wallet,
        tokenBalance: minTokensOut,
        solSpent: solAmount,
        buyPrice: solAmount / Number(minTokensOut),
        buyTime: Date.now(),
      });

      return { success: true, signature, tokensReceived: minTokensOut };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * SPREAD BUY - Buy from multiple wallets spread across different blocks
   * This avoids Bubblemaps "magic nodes" detection
   */
  async executeSpreadBuy(
    mint: PublicKey,
    wallets: BundleWallet[],
    totalSolAmount: number,
    slippageBps: number,
    minDelayMs: number = 3000,
    maxDelayMs: number = 10000,
    onProgress?: (current: number, total: number, wallet: string, status: string) => void
  ): Promise<BundleResult> {
    console.log(`\n🎯 Starting SPREAD BUY (Anti-Magic-Nodes Mode)`);
    console.log(`   Token: ${mint.toBase58()}`);
    console.log(`   Wallets: ${wallets.length}`);
    console.log(`   Total: ${totalSolAmount} SOL`);
    console.log(`   Delay: ${minDelayMs}-${maxDelayMs}ms between buys\n`);

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

      // Randomize amount (±30%)
      const variance = (Math.random() - 0.5) * 0.6;
      const amount = baseAmount * (1 + variance);

      if (onProgress) {
        onProgress(i + 1, shuffledWallets.length, wallet.info.publicKey, 'buying');
      }

      console.log(`[${i + 1}/${shuffledWallets.length}] Buying with ${wallet.info.publicKey.slice(0, 8)}... (${amount.toFixed(4)} SOL)`);

      const result = await this.executeSingleBuy(wallet, mint, amount, slippageBps, tokenInfo || undefined);

      if (result.success && result.signature) {
        signatures.push(result.signature);
        successful++;
        console.log(`   ✅ ${result.signature.slice(0, 8)}...`);
      } else {
        console.log(`   ❌ Failed`);
      }

      // Wait before next buy (spread across blocks)
      if (i < shuffledWallets.length - 1) {
        const delay = randomDelay(minDelayMs, maxDelayMs);
        console.log(`   ⏳ Waiting ${delay}ms...\n`);
        await sleep(delay);
      }
    }

    console.log(`\n🎉 Spread Buy Complete: ${successful}/${wallets.length} successful`);

    return {
      success: successful > 0,
      signatures,
    };
  }

  /**
   * SELL ALL - Sell tokens from all wallets
   */
  async sellAll(
    mint: PublicKey,
    slippageBps: number = 1000,
    onProgress?: (current: number, total: number, wallet: string, status: string) => void
  ): Promise<{ success: boolean; totalSolReceived: number; walletsold: number }> {
    console.log(`\n💸 Starting SELL ALL`);

    const holdings = Array.from(this.holdings.values()).filter(
      h => h.tokenBalance > BigInt(0)
    );

    if (holdings.length === 0) {
      console.log('No holdings to sell');
      return { success: false, totalSolReceived: 0, walletsold: 0 };
    }

    let totalSolReceived = 0;
    let walletsSold = 0;

    const tokenInfo = await this.getTokenInfo(mint);
    const virtualSolReserves = tokenInfo?.virtualSolReserves ?? 30 * 1e9;
    const virtualTokenReserves = tokenInfo?.virtualTokenReserves ?? 1000000000 * 1e6;

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
          console.log(`[${i + 1}/${holdings.length}] ${wallet.info.publicKey.slice(0, 8)}... - No tokens`);
          continue;
        }

        const bondingCurve = this.deriveBondingCurve(mint);
        const associatedBondingCurve = this.deriveAssociatedBondingCurve(mint, bondingCurve);
        const associatedUser = await getAssociatedTokenAddress(mint, wallet.keypair.publicKey);

        const tokenAmount = BigInt(actualBalance);
        const minSolOut = this.calculateSolOut(tokenAmount, virtualSolReserves, virtualTokenReserves, slippageBps);

        const instructions: TransactionInstruction[] = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
          this.createSellInstruction(
            wallet.keypair.publicKey,
            mint,
            bondingCurve,
            associatedBondingCurve,
            associatedUser,
            tokenAmount,
            minSolOut
          ),
        ];

        const { blockhash } = await this.solanaService.getLatestBlockhash();
        const messageV0 = new TransactionMessage({
          payerKey: wallet.keypair.publicKey,
          recentBlockhash: blockhash,
          instructions,
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([wallet.keypair]);

        const signature = await this.solanaService.sendVersionedTransaction(transaction);

        const solReceived = lamportsToSol(Number(minSolOut));
        totalSolReceived += solReceived;
        walletsSold++;

        console.log(`[${i + 1}/${holdings.length}] ${wallet.info.publicKey.slice(0, 8)}... sold for ${solReceived.toFixed(4)} SOL ✅`);

        // Clear holding
        this.holdings.delete(wallet.info.publicKey);

        // Small delay between sells
        await sleep(randomDelay(1000, 3000));
      } catch (error) {
        console.log(`[${i + 1}/${holdings.length}] ${wallet.info.publicKey.slice(0, 8)}... ❌ ${error}`);
      }
    }

    console.log(`\n✅ Sold from ${walletsSold} wallets, received ${totalSolReceived.toFixed(4)} SOL`);

    return {
      success: walletsSold > 0,
      totalSolReceived,
      walletsold: walletsSold,
    };
  }

  /**
   * Get current holdings state
   */
  getHoldingsState(): {
    token: string | null;
    totalWallets: number;
    totalTokens: string;
    totalSolSpent: number;
    avgBuyPrice: number;
    holdings: Array<{
      wallet: string;
      tokens: string;
      solSpent: number;
    }>;
  } {
    const holdingsArray = Array.from(this.holdings.values());

    if (holdingsArray.length === 0) {
      return {
        token: null,
        totalWallets: 0,
        totalTokens: '0',
        totalSolSpent: 0,
        avgBuyPrice: 0,
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
      avgBuyPrice: totalSolSpent / Number(totalTokens),
      holdings: holdingsArray.map(h => ({
        wallet: h.wallet.info.publicKey,
        tokens: h.tokenBalance.toString(),
        solSpent: h.solSpent,
      })),
    };
  }

  /**
   * Get token info from PumpFun API
   */
  async getTokenInfo(mint: PublicKey): Promise<PumpFunTokenInfo | null> {
    try {
      const response = await fetch(`https://frontend-api.pump.fun/coins/${mint.toBase58()}`);
      if (!response.ok) return null;
      return await response.json() as PumpFunTokenInfo;
    } catch {
      return null;
    }
  }

  /**
   * Clear all holdings tracking
   */
  clearHoldings(): void {
    this.holdings.clear();
    this.currentToken = null;
  }
}
