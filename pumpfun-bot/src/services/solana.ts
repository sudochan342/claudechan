import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { solToLamports, lamportsToSol, retryWithBackoff } from '../utils/helpers';

export class SolanaService {
  private connection: Connection;
  private rpcUrl: string;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }

  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get SOL balance for a public key
   */
  async getBalance(publicKey: PublicKey): Promise<number> {
    return retryWithBackoff(async () => {
      const balance = await this.connection.getBalance(publicKey);
      return balance;
    });
  }

  /**
   * Get SOL balance in SOL (not lamports)
   */
  async getBalanceSol(publicKey: PublicKey): Promise<number> {
    const balance = await this.getBalance(publicKey);
    return lamportsToSol(balance);
  }

  /**
   * Get token balance for a wallet
   */
  async getTokenBalance(walletPubkey: PublicKey, mintPubkey: PublicKey): Promise<number> {
    try {
      const ata = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
      const balance = await this.connection.getTokenAccountBalance(ata);
      return Number(balance.value.amount);
    } catch {
      return 0;
    }
  }

  /**
   * Get latest blockhash
   */
  async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    return retryWithBackoff(async () => {
      return await this.connection.getLatestBlockhash('confirmed');
    });
  }

  /**
   * Send SOL from one wallet to another
   */
  async sendSol(
    from: Keypair,
    to: PublicKey,
    amountSol: number,
    priorityFee?: number
  ): Promise<string> {
    const instructions: TransactionInstruction[] = [];

    // Add priority fee if specified
    if (priorityFee) {
      instructions.push(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFee,
        })
      );
    }

    // Add transfer instruction
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to,
        lamports: solToLamports(amountSol),
      })
    );

    const { blockhash, lastValidBlockHeight } = await this.getLatestBlockhash();

    const transaction = new Transaction().add(...instructions);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = from.publicKey;

    const signature = await sendAndConfirmTransaction(this.connection, transaction, [from], {
      commitment: 'confirmed',
      maxRetries: 3,
    });

    return signature;
  }

  /**
   * Create a transfer instruction
   */
  createTransferInstruction(from: PublicKey, to: PublicKey, amountSol: number): TransactionInstruction {
    return SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: solToLamports(amountSol),
    });
  }

  /**
   * Get or create associated token account instruction
   */
  async getOrCreateAtaInstruction(
    mint: PublicKey,
    owner: PublicKey,
    payer: PublicKey
  ): Promise<{ ata: PublicKey; instruction?: TransactionInstruction }> {
    const ata = await getAssociatedTokenAddress(mint, owner);

    try {
      await this.connection.getAccountInfo(ata);
      return { ata };
    } catch {
      const instruction = createAssociatedTokenAccountInstruction(
        payer,
        ata,
        owner,
        mint
      );
      return { ata, instruction };
    }
  }

  /**
   * Build a versioned transaction
   */
  async buildVersionedTransaction(
    instructions: TransactionInstruction[],
    payer: PublicKey,
    signers: Keypair[],
    addressLookupTableAccounts?: AddressLookupTableAccount[]
  ): Promise<VersionedTransaction> {
    const { blockhash } = await this.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(addressLookupTableAccounts);

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign(signers);

    return transaction;
  }

  /**
   * Simulate a transaction
   */
  async simulateTransaction(transaction: VersionedTransaction): Promise<boolean> {
    try {
      const simulation = await this.connection.simulateTransaction(transaction);
      return simulation.value.err === null;
    } catch {
      return false;
    }
  }

  /**
   * Send and confirm a versioned transaction
   */
  async sendVersionedTransaction(transaction: VersionedTransaction): Promise<string> {
    const signature = await this.connection.sendTransaction(transaction, {
      skipPreflight: false,
      maxRetries: 3,
    });

    await this.connection.confirmTransaction(signature, 'confirmed');
    return signature;
  }

  /**
   * Get minimum rent exemption
   */
  async getMinimumRentExemption(dataSize: number): Promise<number> {
    return await this.connection.getMinimumBalanceForRentExemption(dataSize);
  }

  /**
   * Check if account exists
   */
  async accountExists(publicKey: PublicKey): Promise<boolean> {
    const accountInfo = await this.connection.getAccountInfo(publicKey);
    return accountInfo !== null;
  }

  /**
   * Get multiple account balances in parallel
   */
  async getMultipleBalances(publicKeys: PublicKey[]): Promise<Map<string, number>> {
    const balances = new Map<string, number>();

    const results = await Promise.all(
      publicKeys.map(pk => this.getBalance(pk).catch(() => 0))
    );

    publicKeys.forEach((pk, index) => {
      balances.set(pk.toBase58(), results[index]);
    });

    return balances;
  }
}
