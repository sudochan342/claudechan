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
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { SolanaService } from './solana-service';
import { WalletManager } from './wallet-manager';
import { BundleWallet, PumpFunTokenInfo, HoldingsState } from './types';
import { solToLamports, lamportsToSol, sleep, randomDelay, shuffleArray } from './helpers';

// PumpFun Program Constants (January 2025 - 16 account format)
const PUMPFUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMPFUN_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
const FEE_PROGRAM_ID = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');

// Discriminators
const BUY_DISCRIMINATOR = new Uint8Array([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR = new Uint8Array([51, 230, 133, 164, 1, 127, 131, 173]);

// Helper to write u64 LE
function writeU64LE(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  let v = value;
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & BigInt(0xff));
    v = v >> BigInt(8);
  }
  return buf;
}

// Derive PDAs
function deriveGlobal(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('global')], PUMPFUN_PROGRAM_ID);
  return pda;
}

function deriveBondingCurve(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PUMPFUN_PROGRAM_ID
  );
  return pda;
}

function deriveCreatorVault(creator: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('creator-vault'), creator.toBuffer()],
    PUMPFUN_PROGRAM_ID
  );
  return pda;
}

function deriveEventAuthority(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority')],
    PUMPFUN_PROGRAM_ID
  );
  return pda;
}

function deriveGlobalVolumeAccumulator(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_volume_accumulator')],
    PUMPFUN_PROGRAM_ID
  );
  return pda;
}

function deriveUserVolumeAccumulator(user: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_volume_accumulator'), user.toBuffer()],
    PUMPFUN_PROGRAM_ID
  );
  return pda;
}

function deriveFeeConfig(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('fee_config'), PUMPFUN_PROGRAM_ID.toBuffer()],
    FEE_PROGRAM_ID
  );
  return pda;
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

  // Read creator from bonding curve account data
  async getCreatorFromBondingCurve(bondingCurve: PublicKey): Promise<PublicKey | null> {
    try {
      const info = await this.solanaService.getConnection().getAccountInfo(bondingCurve);
      if (!info || info.data.length < 81) return null;
      // Layout: 8 discriminator + 8 virtualTokenReserves + 8 virtualSolReserves + 8 realTokenReserves + 8 realSolReserves + 8 tokenTotalSupply + 1 complete + 32 creator
      // Creator at offset 49
      return new PublicKey(info.data.slice(49, 81));
    } catch {
      return null;
    }
  }

  // Detect which token program the mint uses (Token or Token-2022)
  async getTokenProgramForMint(mint: PublicKey): Promise<PublicKey> {
    try {
      const info = await this.solanaService.getConnection().getAccountInfo(mint);
      if (info && info.owner.equals(TOKEN_2022_PROGRAM_ID)) {
        return TOKEN_2022_PROGRAM_ID;
      }
    } catch {
      // Fall back to legacy
    }
    return TOKEN_PROGRAM_ID;
  }

  async executeSingleBuy(
    wallet: BundleWallet,
    mint: PublicKey,
    solAmount: number,
    slippageBps: number,
    tokenInfo?: PumpFunTokenInfo
  ): Promise<{ success: boolean; signature?: string; tokensReceived?: bigint; error?: string }> {
    try {
      const userPubkey = wallet.keypair.publicKey;
      const bondingCurve = deriveBondingCurve(mint);

      // Detect token program (Token or Token-2022)
      const tokenProgram = await this.getTokenProgramForMint(mint);

      // Derive ATAs with correct token program
      const associatedBondingCurve = await getAssociatedTokenAddress(mint, bondingCurve, true, tokenProgram);
      const associatedUser = await getAssociatedTokenAddress(mint, userPubkey, false, tokenProgram);

      // Get creator from bonding curve
      const creator = await this.getCreatorFromBondingCurve(bondingCurve);
      if (!creator) {
        return { success: false, error: 'Could not read creator from bonding curve' };
      }

      const instructions: TransactionInstruction[] = [];

      // Compute budget
      instructions.push(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 250000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 })
      );

      // Create ATA if needed (with correct token program)
      const ataInfo = await this.solanaService.getConnection().getAccountInfo(associatedUser);
      if (!ataInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(userPubkey, associatedUser, userPubkey, mint, tokenProgram)
        );
      }

      // Calculate tokens out
      const virtualSolReserves = tokenInfo?.virtual_sol_reserves ?? 30_000_000_000;
      const virtualTokenReserves = tokenInfo?.virtual_token_reserves ?? 1_073_000_000_000_000;
      const solIn = BigInt(solToLamports(solAmount));
      const tokensOut = (BigInt(virtualTokenReserves) * solIn) / (BigInt(virtualSolReserves) + solIn);
      const minTokensOut = (tokensOut * BigInt(10000 - slippageBps)) / BigInt(10000);
      const maxSolCost = solIn + (solIn * BigInt(slippageBps)) / BigInt(10000);

      // Build instruction data: 8 discriminator + 8 tokenOut + 8 maxSolCost + 1 trackVolume = 25 bytes
      const data = new Uint8Array(25);
      data.set(BUY_DISCRIMINATOR, 0);
      data.set(writeU64LE(minTokensOut), 8);
      data.set(writeU64LE(maxSolCost), 16);
      data[24] = 0; // track_volume = false

      // 16-account buy instruction (use detected token program)
      const creatorVault = deriveCreatorVault(creator);
      const eventAuth = deriveEventAuthority();
      const globalVol = deriveGlobalVolumeAccumulator();
      const userVol = deriveUserVolumeAccumulator(userPubkey);
      const feeConfig = deriveFeeConfig();
      const globalPda = deriveGlobal();

      console.log('Buy accounts:', {
        global: globalPda.toBase58(),
        feeRecipient: PUMPFUN_FEE_RECIPIENT.toBase58(),
        mint: mint.toBase58(),
        bondingCurve: bondingCurve.toBase58(),
        associatedBondingCurve: associatedBondingCurve.toBase58(),
        associatedUser: associatedUser.toBase58(),
        user: userPubkey.toBase58(),
        tokenProgram: tokenProgram.toBase58(),
        creator: creator.toBase58(),
        creatorVault: creatorVault.toBase58(),
        eventAuth: eventAuth.toBase58(),
        globalVol: globalVol.toBase58(),
        userVol: userVol.toBase58(),
        feeConfig: feeConfig.toBase58(),
      });

      const keys = [
        { pubkey: globalPda, isSigner: false, isWritable: false },
        { pubkey: PUMPFUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedUser, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: tokenProgram, isSigner: false, isWritable: false },
        { pubkey: creatorVault, isSigner: false, isWritable: true },
        { pubkey: eventAuth, isSigner: false, isWritable: false },
        { pubkey: PUMPFUN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: globalVol, isSigner: false, isWritable: false },
        { pubkey: userVol, isSigner: false, isWritable: true },
        { pubkey: feeConfig, isSigner: false, isWritable: false },
        { pubkey: FEE_PROGRAM_ID, isSigner: false, isWritable: false },
      ];

      instructions.push(
        new TransactionInstruction({
          programId: PUMPFUN_PROGRAM_ID,
          keys,
          data: Buffer.from(data),
        })
      );

      // Build and send
      const { blockhash } = await this.solanaService.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: userPubkey,
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

    const tokenInfo = await this.getTokenInfo(mint);
    const baseAmount = totalSolAmount / wallets.length;

    for (let i = 0; i < shuffledWallets.length; i++) {
      const wallet = shuffledWallets[i];
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
          const errorStatus = result.error ? `failed: ${result.error.slice(0, 100)}` : 'failed';
          onProgress(i + 1, shuffledWallets.length, wallet.info.publicKey, errorStatus);
        }
      }

      if (i < shuffledWallets.length - 1) {
        await sleep(randomDelay(minDelayMs, maxDelayMs));
      }
    }

    return { success: successful > 0, signatures, successful };
  }

  async sellAll(
    mint: PublicKey,
    slippageBps: number = 1000,
    onProgress?: (current: number, total: number, wallet: string, status: string) => void
  ): Promise<{ success: boolean; totalSolReceived: number; walletsSold: number }> {
    // Get all wallets and scan for token balances (don't rely on in-memory holdings)
    const allWallets = this.walletManager.getAllWallets();
    const tokenProgram = await this.getTokenProgramForMint(mint);

    // Find wallets with token balance
    const walletsWithTokens: { wallet: BundleWallet; balance: number }[] = [];
    for (const wallet of allWallets) {
      try {
        const balance = await this.solanaService.getTokenBalance(wallet.keypair.publicKey, mint, tokenProgram);
        if (balance > 0) {
          walletsWithTokens.push({ wallet, balance });
        }
      } catch {
        // Skip wallets where we can't get balance
      }
    }

    if (walletsWithTokens.length === 0) {
      console.log('No wallets found with token balance');
      return { success: false, totalSolReceived: 0, walletsSold: 0 };
    }

    console.log(`Found ${walletsWithTokens.length} wallets with tokens to sell`);

    let totalSolReceived = 0;
    let walletsSold = 0;

    for (let i = 0; i < walletsWithTokens.length; i++) {
      const { wallet, balance } = walletsWithTokens[i];

      if (onProgress) {
        onProgress(i + 1, walletsWithTokens.length, wallet.info.publicKey, 'selling');
      }

      try {
        const userPubkey = wallet.keypair.publicKey;
        const bondingCurve = deriveBondingCurve(mint);
        const associatedBondingCurve = await getAssociatedTokenAddress(mint, bondingCurve, true, tokenProgram);
        const associatedUser = await getAssociatedTokenAddress(mint, userPubkey, false, tokenProgram);

        const tokenAmount = BigInt(balance);
        // For sell, minSolOut is what we expect to receive (apply slippage down)
        const minSolOut = BigInt(1); // Accept any SOL to ensure sell goes through

        // Sell instruction data: 8 discriminator + 8 tokenAmount + 8 minSolOut = 24 bytes
        const data = new Uint8Array(24);
        data.set(SELL_DISCRIMINATOR, 0);
        data.set(writeU64LE(tokenAmount), 8);
        data.set(writeU64LE(minSolOut), 16);

        // 12-account sell instruction (sell uses simpler format than buy)
        const keys = [
          { pubkey: deriveGlobal(), isSigner: false, isWritable: false },
          { pubkey: PUMPFUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: bondingCurve, isSigner: false, isWritable: true },
          { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
          { pubkey: associatedUser, isSigner: false, isWritable: true },
          { pubkey: userPubkey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: tokenProgram, isSigner: false, isWritable: false },
          { pubkey: deriveEventAuthority(), isSigner: false, isWritable: false },
          { pubkey: PUMPFUN_PROGRAM_ID, isSigner: false, isWritable: false },
        ];

        console.log(`Selling ${balance} tokens from ${wallet.info.publicKey.slice(0, 8)}...`);

        const instructions = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }),
          new TransactionInstruction({
            programId: PUMPFUN_PROGRAM_ID,
            keys,
            data: Buffer.from(data),
          }),
        ];

        const { blockhash } = await this.solanaService.getLatestBlockhash();
        const messageV0 = new TransactionMessage({
          payerKey: userPubkey,
          recentBlockhash: blockhash,
          instructions,
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([wallet.keypair]);

        const sig = await this.solanaService.sendVersionedTransaction(transaction);
        console.log(`Sold! Signature: ${sig}`);

        totalSolReceived += lamportsToSol(Number(minSolOut));
        walletsSold++;
        this.holdings.delete(wallet.info.publicKey);

        if (onProgress) {
          onProgress(i + 1, walletsWithTokens.length, wallet.info.publicKey, 'sold');
        }

        await sleep(randomDelay(1000, 3000));
      } catch (error) {
        console.error('Sell failed:', error);
        if (onProgress) {
          onProgress(i + 1, walletsWithTokens.length, wallet.info.publicKey, `failed: ${error}`);
        }
      }
    }

    return { success: walletsSold > 0, totalSolReceived, walletsSold };
  }

  getHoldingsState(): HoldingsState {
    const holdingsArray = Array.from(this.holdings.values());
    if (holdingsArray.length === 0) {
      return { token: null, totalWallets: 0, totalTokens: '0', totalSolSpent: 0, holdings: [] };
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
      const response = await fetch(`/api/token/${mint.toBase58()}`);
      const data = await response.json();
      if (!response.ok) return null;
      return data as PumpFunTokenInfo;
    } catch {
      return null;
    }
  }

  clearHoldings(): void {
    this.holdings.clear();
    this.currentToken = null;
  }
}
