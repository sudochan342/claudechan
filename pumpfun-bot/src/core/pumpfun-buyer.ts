import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { SolanaService } from '../services/solana';
import { JitoService } from '../services/jito';
import { WalletManager } from './wallet-manager';
import { BundleWallet, BundleBuyParams, BundleResult, PumpFunTokenInfo } from '../types';
import { solToLamports, sleep, chunkArray } from '../utils/helpers';

// PumpFun Program Constants
const PUMPFUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMPFUN_GLOBAL = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
const PUMPFUN_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
const PUMPFUN_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');

// Buy discriminator for PumpFun
const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);

export class PumpFunBuyer {
  private solanaService: SolanaService;
  private jitoService: JitoService;
  private walletManager: WalletManager;

  constructor(
    solanaService: SolanaService,
    jitoService: JitoService,
    walletManager: WalletManager
  ) {
    this.solanaService = solanaService;
    this.jitoService = jitoService;
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

    // Constant product formula: x * y = k
    // tokensOut = tokenReserves - (solReserves * tokenReserves) / (solReserves + solIn)
    const tokensOut = tokenReserves - (solReserves * tokenReserves) / (solReserves + solIn);

    // Apply slippage
    const minTokensOut = (tokensOut * BigInt(10000 - slippageBps)) / BigInt(10000);

    return minTokensOut;
  }

  /**
   * Create buy instruction for PumpFun
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
    // Encode instruction data
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
   * Build buy transaction for a single wallet
   */
  async buildBuyTransaction(
    wallet: Keypair,
    mint: PublicKey,
    solAmount: number,
    slippageBps: number,
    tokenInfo?: PumpFunTokenInfo
  ): Promise<{ transaction: VersionedTransaction; instructions: TransactionInstruction[] }> {
    const bondingCurve = this.deriveBondingCurve(mint);
    const associatedBondingCurve = this.deriveAssociatedBondingCurve(mint, bondingCurve);
    const associatedUser = await getAssociatedTokenAddress(mint, wallet.publicKey);

    const instructions: TransactionInstruction[] = [];

    // Add compute budget
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 })
    );

    // Check if ATA exists, if not create it
    const ataInfo = await this.solanaService.getConnection().getAccountInfo(associatedUser);
    if (!ataInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          associatedUser,
          wallet.publicKey,
          mint
        )
      );
    }

    // Calculate minimum tokens (use default reserves if not provided)
    const virtualSolReserves = tokenInfo?.virtualSolReserves ?? 30 * 1e9; // 30 SOL default
    const virtualTokenReserves = tokenInfo?.virtualTokenReserves ?? 1000000000 * 1e6; // 1B tokens default
    const minTokensOut = this.calculateTokensOut(
      solAmount,
      virtualSolReserves,
      virtualTokenReserves,
      slippageBps
    );

    // Add buy instruction
    instructions.push(
      this.createBuyInstruction(
        wallet.publicKey,
        mint,
        bondingCurve,
        associatedBondingCurve,
        associatedUser,
        solAmount,
        minTokensOut
      )
    );

    // Build versioned transaction
    const { blockhash } = await this.solanaService.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([wallet]);

    return { transaction, instructions };
  }

  /**
   * Execute bundle buy with multiple wallets
   */
  async executeBundleBuy(params: BundleBuyParams): Promise<BundleResult> {
    const { mint, totalSolAmount, walletCount, slippageBps, jitoTipAmount } = params;

    console.log(`\n🚀 Executing bundle buy for ${mint.toBase58()}`);
    console.log(`Total amount: ${totalSolAmount} SOL across ${walletCount} wallets`);

    // Get funded wallets
    const wallets = this.walletManager.getRandomWallets(walletCount, true);

    if (wallets.length < walletCount) {
      return {
        success: false,
        error: `Not enough funded wallets. Have: ${wallets.length}, Need: ${walletCount}`,
      };
    }

    const amountPerWallet = totalSolAmount / walletCount;
    console.log(`Amount per wallet: ${amountPerWallet.toFixed(4)} SOL`);

    try {
      // Build transactions for all wallets
      const transactions: VersionedTransaction[] = [];

      for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        console.log(`Building tx for wallet ${i + 1}/${wallets.length}: ${wallet.info.publicKey.slice(0, 8)}...`);

        const { transaction } = await this.buildBuyTransaction(
          wallet.keypair,
          mint,
          amountPerWallet,
          slippageBps
        );

        transactions.push(transaction);
      }

      // Add Jito tip to the last transaction
      const tipWallet = wallets[wallets.length - 1];
      const tipInstruction = this.jitoService.createTipInstruction(
        tipWallet.keypair.publicKey,
        jitoTipAmount
      );

      // Rebuild last transaction with tip
      const { blockhash } = await this.solanaService.getLatestBlockhash();
      const lastTxInstructions = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 250000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }),
        tipInstruction,
      ];

      // Get original buy instruction and add it
      const bondingCurve = this.deriveBondingCurve(mint);
      const associatedBondingCurve = this.deriveAssociatedBondingCurve(mint, bondingCurve);
      const associatedUser = await getAssociatedTokenAddress(mint, tipWallet.keypair.publicKey);

      const minTokensOut = this.calculateTokensOut(amountPerWallet, 30 * 1e9, 1000000000 * 1e6, slippageBps);

      lastTxInstructions.push(
        this.createBuyInstruction(
          tipWallet.keypair.publicKey,
          mint,
          bondingCurve,
          associatedBondingCurve,
          associatedUser,
          amountPerWallet,
          minTokensOut
        )
      );

      const lastMessageV0 = new TransactionMessage({
        payerKey: tipWallet.keypair.publicKey,
        recentBlockhash: blockhash,
        instructions: lastTxInstructions,
      }).compileToV0Message();

      const lastTransaction = new VersionedTransaction(lastMessageV0);
      lastTransaction.sign([tipWallet.keypair]);
      transactions[transactions.length - 1] = lastTransaction;

      console.log(`\n📦 Sending bundle with ${transactions.length} transactions...`);

      // Send bundle via Jito
      const { bundleId, landed } = await this.jitoService.sendBundleWithRetry(transactions);

      if (landed) {
        console.log(`✅ Bundle landed successfully! ID: ${bundleId}`);
        return {
          success: true,
          bundleId,
          signatures: transactions.map(tx => tx.signatures[0].toString()),
        };
      } else {
        return {
          success: false,
          bundleId,
          error: 'Bundle did not land',
        };
      }
    } catch (error) {
      console.error(`❌ Bundle buy failed: ${error}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Execute individual buys (non-bundled, for comparison/backup)
   */
  async executeIndividualBuys(
    mint: PublicKey,
    wallets: BundleWallet[],
    amountPerWallet: number,
    slippageBps: number,
    delayMs: number = 100
  ): Promise<{ successful: number; failed: number; signatures: string[] }> {
    const signatures: string[] = [];
    let successful = 0;
    let failed = 0;

    for (const wallet of wallets) {
      try {
        const { transaction } = await this.buildBuyTransaction(
          wallet.keypair,
          mint,
          amountPerWallet,
          slippageBps
        );

        const signature = await this.solanaService.sendVersionedTransaction(transaction);
        signatures.push(signature);
        successful++;
        console.log(`✅ Buy successful for ${wallet.info.publicKey.slice(0, 8)}...: ${signature}`);
      } catch (error) {
        failed++;
        console.error(`❌ Buy failed for ${wallet.info.publicKey.slice(0, 8)}...: ${error}`);
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }

    return { successful, failed, signatures };
  }

  /**
   * Get token info from PumpFun API
   */
  async getTokenInfo(mint: PublicKey): Promise<PumpFunTokenInfo | null> {
    try {
      const response = await fetch(`https://frontend-api.pump.fun/coins/${mint.toBase58()}`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json() as PumpFunTokenInfo;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Sell tokens back to bonding curve
   */
  async sell(
    wallet: Keypair,
    mint: PublicKey,
    tokenAmount: bigint,
    slippageBps: number
  ): Promise<string> {
    // Implement sell logic similar to buy
    // For now, this is a placeholder
    throw new Error('Sell not yet implemented');
  }
}
