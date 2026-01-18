import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createBurnInstruction,
  createCloseAccountInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddress,
  getMint,
} from '@solana/spl-token';
import { SolanaService } from '../services/solana';

// Metaplex Token Metadata Program
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// PumpFun constants
const PUMPFUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
}

export class TokenManager {
  private solanaService: SolanaService;

  constructor(solanaService: SolanaService) {
    this.solanaService = solanaService;
  }

  /**
   * Derive metadata PDA
   */
  deriveMetadataPDA(mint: PublicKey): PublicKey {
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    return metadataPDA;
  }

  /**
   * Get token metadata
   */
  async getTokenMetadata(mint: PublicKey): Promise<TokenMetadata | null> {
    try {
      // For PumpFun tokens, use their API
      const response = await fetch(`https://frontend-api.pump.fun/coins/${mint.toBase58()}`);
      if (response.ok) {
        const data = await response.json() as {
          name: string;
          symbol: string;
          uri?: string;
          image_uri?: string;
          metadata_uri?: string;
        };
        return {
          name: data.name,
          symbol: data.symbol,
          uri: data.uri || data.metadata_uri || data.image_uri || '',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Burn LP tokens (for PumpFun graduated tokens on Raydium)
   */
  async burnLPTokens(
    wallet: Keypair,
    lpMint: PublicKey,
    amount?: bigint // If not provided, burns all
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const lpTokenAccount = await getAssociatedTokenAddress(lpMint, wallet.publicKey);

      // Get current balance if amount not specified
      let burnAmount = amount;
      if (!burnAmount) {
        const balance = await this.solanaService.getTokenBalance(wallet.publicKey, lpMint);
        burnAmount = BigInt(balance);
      }

      if (burnAmount === BigInt(0)) {
        return { success: false, error: 'No LP tokens to burn' };
      }

      const instructions: TransactionInstruction[] = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
        createBurnInstruction(
          lpTokenAccount,
          lpMint,
          wallet.publicKey,
          burnAmount
        ),
      ];

      const { blockhash } = await this.solanaService.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([wallet]);

      const signature = await this.solanaService.sendVersionedTransaction(transaction);

      return { success: true, signature };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Revoke mint authority (for tokens you control)
   */
  async revokeMintAuthority(
    wallet: Keypair,
    mint: PublicKey
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const instructions: TransactionInstruction[] = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
        createSetAuthorityInstruction(
          mint,
          wallet.publicKey,
          AuthorityType.MintTokens,
          null // Setting to null revokes
        ),
      ];

      const { blockhash } = await this.solanaService.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([wallet]);

      const signature = await this.solanaService.sendVersionedTransaction(transaction);

      return { success: true, signature };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Revoke freeze authority
   */
  async revokeFreezeAuthority(
    wallet: Keypair,
    mint: PublicKey
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const instructions: TransactionInstruction[] = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
        createSetAuthorityInstruction(
          mint,
          wallet.publicKey,
          AuthorityType.FreezeAccount,
          null
        ),
      ];

      const { blockhash } = await this.solanaService.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([wallet]);

      const signature = await this.solanaService.sendVersionedTransaction(transaction);

      return { success: true, signature };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Update token metadata using Metaplex
   * Note: This only works if you have update authority
   */
  async updateMetadata(
    wallet: Keypair,
    mint: PublicKey,
    newName?: string,
    newSymbol?: string,
    newUri?: string
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const metadataPDA = this.deriveMetadataPDA(mint);

      // Create update metadata instruction
      // Using Metaplex instruction format
      const updateData = {
        name: newName,
        symbol: newSymbol,
        uri: newUri,
        sellerFeeBasisPoints: null,
        creators: null,
      };

      // Discriminator for updateMetadataAccountV2
      const discriminator = Buffer.from([15, 216, 198, 193, 104, 111, 85, 68]); // update_metadata_accounts_v2

      // Encode the update data
      const nameBuffer = newName ? Buffer.from(newName.padEnd(32, '\0')) : Buffer.alloc(0);
      const symbolBuffer = newSymbol ? Buffer.from(newSymbol.padEnd(10, '\0')) : Buffer.alloc(0);
      const uriBuffer = newUri ? Buffer.from(newUri.padEnd(200, '\0')) : Buffer.alloc(0);

      const data = Buffer.concat([
        discriminator,
        // Add proper serialization based on Metaplex format
        Buffer.from([1]), // Some instruction data
        nameBuffer,
        symbolBuffer,
        uriBuffer,
      ]);

      const keys = [
        { pubkey: metadataPDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      ];

      const instruction = new TransactionInstruction({
        programId: TOKEN_METADATA_PROGRAM_ID,
        keys,
        data,
      });

      const instructions: TransactionInstruction[] = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
        instruction,
      ];

      const { blockhash } = await this.solanaService.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([wallet]);

      const signature = await this.solanaService.sendVersionedTransaction(transaction);

      return { success: true, signature };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Upload image to IPFS (using Pinata or similar)
   * Returns the IPFS URI
   */
  async uploadImage(
    imageBuffer: Buffer,
    filename: string,
    pinataApiKey: string,
    pinataSecretKey: string
  ): Promise<{ success: boolean; uri?: string; error?: string }> {
    try {
      const formData = new FormData();
      const blob = new Blob([imageBuffer]);
      formData.append('file', blob, filename);

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'pinata_api_key': pinataApiKey,
          'pinata_secret_api_key': pinataSecretKey,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Pinata upload failed: ${response.statusText}`);
      }

      const result = await response.json() as { IpfsHash: string };
      const uri = `https://ipfs.io/ipfs/${result.IpfsHash}`;

      return { success: true, uri };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Create metadata JSON and upload to IPFS
   */
  async createAndUploadMetadata(
    name: string,
    symbol: string,
    description: string,
    imageUri: string,
    pinataApiKey: string,
    pinataSecretKey: string
  ): Promise<{ success: boolean; uri?: string; error?: string }> {
    try {
      const metadata = {
        name,
        symbol,
        description,
        image: imageUri,
        showName: true,
        createdOn: 'https://pump.fun',
      };

      const metadataBuffer = Buffer.from(JSON.stringify(metadata));
      const result = await this.uploadImage(
        metadataBuffer,
        'metadata.json',
        pinataApiKey,
        pinataSecretKey
      );

      return result;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get token info including authorities
   */
  async getTokenInfo(mint: PublicKey): Promise<{
    mintAuthority: string | null;
    freezeAuthority: string | null;
    supply: string;
    decimals: number;
  } | null> {
    try {
      const mintInfo = await getMint(this.solanaService.getConnection(), mint);

      return {
        mintAuthority: mintInfo.mintAuthority?.toBase58() || null,
        freezeAuthority: mintInfo.freezeAuthority?.toBase58() || null,
        supply: mintInfo.supply.toString(),
        decimals: mintInfo.decimals,
      };
    } catch {
      return null;
    }
  }

  /**
   * Close empty token account (reclaim rent)
   */
  async closeTokenAccount(
    wallet: Keypair,
    tokenAccount: PublicKey
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const instructions: TransactionInstruction[] = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 }),
        createCloseAccountInstruction(
          tokenAccount,
          wallet.publicKey, // destination for rent
          wallet.publicKey  // authority
        ),
      ];

      const { blockhash } = await this.solanaService.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([wallet]);

      const signature = await this.solanaService.sendVersionedTransaction(transaction);

      return { success: true, signature };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
