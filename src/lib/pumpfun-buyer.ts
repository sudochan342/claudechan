import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { SolanaService } from './solana-service';
import { WalletManager } from './wallet-manager';
import { BundleWallet, PumpFunTokenInfo, HoldingsState } from './types';
import { solToLamports, lamportsToSol, sleep, randomDelay, shuffleArray } from './helpers';

// PumpFun Program Constants (Updated for new IDL - January 2025)
const PUMPFUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMPFUN_GLOBAL = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
const PUMPFUN_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
const PUMPFUN_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');
// New accounts required by updated PumpFun IDL
const PUMPFUN_FEE_PROGRAM = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');

// Discriminators as Uint8Array (browser compatible)
const BUY_DISCRIMINATOR = new Uint8Array([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR = new Uint8Array([51, 230, 133, 164, 1, 127, 131, 173]);

// Helper function to write BigInt as little-endian bytes
function writeBigUint64LE(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  let v = value;
  for (let i = 0; i < 8; i++) {
    bytes[i] = Number(v & BigInt(0xff));
    v = v >> BigInt(8);
  }
  return bytes;
}

// Helper to create instruction data (returns Buffer for TransactionInstruction compatibility)
// Old format: 8 discriminator + 8 value1 + 8 value2 = 24 bytes
function createInstructionData(discriminator: Uint8Array, value1: bigint, value2: bigint): Buffer {
  const data = new Uint8Array(24);
  data.set(discriminator, 0);
  data.set(writeBigUint64LE(value1), 8);
  data.set(writeBigUint64LE(value2), 16);
  return Buffer.from(data);
}

// New buy format: 8 discriminator + 8 amount + 8 maxSolCost + 1 trackVolume = 25 bytes
function createBuyInstructionData(amount: bigint, maxSolCost: bigint, trackVolume: boolean | null = null): Buffer {
  const data = new Uint8Array(25);
  data.set(BUY_DISCRIMINATOR, 0);
  data.set(writeBigUint64LE(amount), 8);
  data.set(writeBigUint64LE(maxSolCost), 16);
  // OptionBool: 0 = None, 1 = Some(false), 2 = Some(true)
  data[24] = trackVolume === null ? 0 : (trackVolume ? 2 : 1);
  return Buffer.from(data);
}

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
  private holdings: Map<string, WalletHolding> = new Map();
  private currentToken: PublicKey | null = null;

  constructor(solanaService: SolanaService, walletManager: WalletManager) {
    this.solanaService = solanaService;
    this.walletManager = walletManager;
  }

  deriveBondingCurve(mint: PublicKey): PublicKey {
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mint.toBuffer()],
      PUMPFUN_PROGRAM_ID
    );
    return bondingCurve;
  }

  deriveAssociatedBondingCurve(mint: PublicKey, bondingCurve: PublicKey): PublicKey {
    const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
      [bondingCurve.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return associatedBondingCurve;
  }

  // New PDA derivations for updated IDL
  // creator-vault uses the CREATOR address from the bonding curve, not the mint
  deriveCreatorVault(creator: PublicKey): PublicKey {
    const [creatorVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('creator-vault'), creator.toBuffer()],
      PUMPFUN_PROGRAM_ID
    );
    return creatorVault;
  }

  deriveUserVolumeAccumulator(user: PublicKey): PublicKey {
    const [userVolumeAccumulator] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_volume_accumulator'), user.toBuffer()],
      PUMPFUN_PROGRAM_ID
    );
    return userVolumeAccumulator;
  }

  deriveGlobalVolumeAccumulator(): PublicKey {
    const [globalVolumeAccumulator] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_volume_accumulator')],
      PUMPFUN_PROGRAM_ID
    );
    return globalVolumeAccumulator;
  }

  deriveFeeConfig(): PublicKey {
    // fee_config has a hardcoded pubkey seed according to the IDL
    // The seed is: "fee_config" + a fixed pubkey
    const FEE_CONFIG_SEED_PUBKEY = new PublicKey('1VQBxGDh4xRibcKG3PMPDKgHbmkVEv2ia2i4pZ1e3YY');
    const [feeConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_config'), FEE_CONFIG_SEED_PUBKEY.toBuffer()],
      PUMPFUN_FEE_PROGRAM
    );
    return feeConfig;
  }

  // Read creator address from bonding curve account
  async getCreatorFromBondingCurve(bondingCurve: PublicKey): Promise<PublicKey | null> {
    try {
      const accountInfo = await this.solanaService.getConnection().getAccountInfo(bondingCurve);
      if (!accountInfo || accountInfo.data.length < 81) {
        return null;
      }
      // BondingCurve layout: 8 discriminator + 40 reserves/supply + 1 complete + 32 creator
      // Creator starts at offset 49
      const creatorBytes = accountInfo.data.slice(49, 81);
      return new PublicKey(creatorBytes);
    } catch (error) {
      console.error('Failed to read creator from bonding curve:', error);
      return null;
    }
  }

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

  async createBuyInstruction(
    wallet: PublicKey,
    mint: PublicKey,
    bondingCurve: PublicKey,
    associatedBondingCurve: PublicKey,
    associatedUser: PublicKey,
    solAmount: number,
    minTokensOut: bigint
  ): Promise<TransactionInstruction> {
    // Get the creator address from the bonding curve account
    const creator = await this.getCreatorFromBondingCurve(bondingCurve);
    if (!creator) {
      throw new Error('Failed to get creator from bonding curve - token may not exist or bonding curve not initialized');
    }

    // Derive new required PDAs with correct seeds
    const creatorVault = this.deriveCreatorVault(creator);
    const userVolumeAccumulator = this.deriveUserVolumeAccumulator(wallet);
    const globalVolumeAccumulator = this.deriveGlobalVolumeAccumulator();
    const feeConfig = this.deriveFeeConfig();

    // New instruction data format with trackVolume option
    const data = createBuyInstructionData(
      minTokensOut,
      BigInt(solToLamports(solAmount)),
      null // trackVolume = None
    );

    // Updated account keys order per new IDL (16 accounts)
    const keys = [
      { pubkey: PUMPFUN_GLOBAL, isSigner: false, isWritable: false },           // 1. global
      { pubkey: PUMPFUN_FEE_RECIPIENT, isSigner: false, isWritable: true },     // 2. fee_recipient
      { pubkey: mint, isSigner: false, isWritable: false },                     // 3. mint
      { pubkey: bondingCurve, isSigner: false, isWritable: true },              // 4. bonding_curve
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },    // 5. associated_bonding_curve
      { pubkey: associatedUser, isSigner: false, isWritable: true },            // 6. associated_user
      { pubkey: wallet, isSigner: true, isWritable: true },                     // 7. user (signer)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },  // 8. system_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },         // 9. token_program
      { pubkey: creatorVault, isSigner: false, isWritable: true },              // 10. creator_vault
      { pubkey: PUMPFUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },  // 11. event_authority
      { pubkey: PUMPFUN_PROGRAM_ID, isSigner: false, isWritable: false },       // 12. program
      { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: false },  // 13. global_volume_accumulator
      { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },     // 14. user_volume_accumulator
      { pubkey: feeConfig, isSigner: false, isWritable: false },                // 15. fee_config
      { pubkey: PUMPFUN_FEE_PROGRAM, isSigner: false, isWritable: false },      // 16. fee_program
    ];

    return new TransactionInstruction({
      programId: PUMPFUN_PROGRAM_ID,
      keys,
      data,
    });
  }

  createSellInstruction(
    wallet: PublicKey,
    mint: PublicKey,
    bondingCurve: PublicKey,
    associatedBondingCurve: PublicKey,
    associatedUser: PublicKey,
    tokenAmount: bigint,
    minSolOut: bigint
  ): TransactionInstruction {
    const data = createInstructionData(
      SELL_DISCRIMINATOR,
      tokenAmount,
      minSolOut
    );

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

  async executeSingleBuy(
    wallet: BundleWallet,
    mint: PublicKey,
    solAmount: number,
    slippageBps: number,
    tokenInfo?: PumpFunTokenInfo
  ): Promise<{ success: boolean; signature?: string; tokensReceived?: bigint; error?: string }> {
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
    const virtualSolReserves = tokenInfo?.virtual_sol_reserves ?? 30 * 1e9;
    const virtualTokenReserves = tokenInfo?.virtual_token_reserves ?? 1000000000 * 1e6;
    const minTokensOut = this.calculateTokensOut(solAmount, virtualSolReserves, virtualTokenReserves, slippageBps);

    // Add buy instruction (now async to fetch creator from bonding curve)
    const buyInstruction = await this.createBuyInstruction(
      wallet.keypair.publicKey,
      mint,
      bondingCurve,
      associatedBondingCurve,
      associatedUser,
      solAmount,
      minTokensOut
    );
    instructions.push(buyInstruction);

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
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Buy failed:', errorMsg);
      return { success: false, error: errorMsg };
    }
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

    const tokenInfo = await this.getTokenInfo(mint);
    const virtualSolReserves = tokenInfo?.virtual_sol_reserves ?? 30 * 1e9;
    const virtualTokenReserves = tokenInfo?.virtual_token_reserves ?? 1000000000 * 1e6;

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

        await this.solanaService.sendVersionedTransaction(transaction);

        const solReceived = lamportsToSol(Number(minSolOut));
        totalSolReceived += solReceived;
        walletsSold++;

        // Clear holding
        this.holdings.delete(wallet.info.publicKey);

        if (onProgress) {
          onProgress(i + 1, holdings.length, wallet.info.publicKey, 'sold');
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
