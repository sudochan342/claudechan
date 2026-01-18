import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { solToLamports, lamportsToSol, retryWithBackoff } from './helpers';

export class SolanaService {
  private connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }

  getConnection(): Connection {
    return this.connection;
  }

  updateRpcUrl(rpcUrl: string): void {
    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }

  async getBalance(publicKey: PublicKey): Promise<number> {
    return retryWithBackoff(async () => {
      const balance = await this.connection.getBalance(publicKey);
      return balance;
    });
  }

  async getBalanceSol(publicKey: PublicKey): Promise<number> {
    const balance = await this.getBalance(publicKey);
    return lamportsToSol(balance);
  }

  async getTokenBalance(walletPubkey: PublicKey, mintPubkey: PublicKey, tokenProgram: PublicKey = TOKEN_PROGRAM_ID): Promise<number> {
    try {
      const ata = await getAssociatedTokenAddress(mintPubkey, walletPubkey, false, tokenProgram);
      const balance = await this.connection.getTokenAccountBalance(ata);
      return Number(balance.value.amount);
    } catch {
      return 0;
    }
  }

  async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    return retryWithBackoff(async () => {
      return await this.connection.getLatestBlockhash('confirmed');
    });
  }

  async sendSol(
    from: Keypair,
    to: PublicKey,
    amountSol: number,
    priorityFee?: number
  ): Promise<string> {
    const instructions: TransactionInstruction[] = [];

    if (priorityFee) {
      instructions.push(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFee,
        })
      );
    }

    instructions.push(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to,
        lamports: solToLamports(amountSol),
      })
    );

    const { blockhash } = await this.getLatestBlockhash();

    const transaction = new Transaction().add(...instructions);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = from.publicKey;

    const signature = await sendAndConfirmTransaction(this.connection, transaction, [from], {
      commitment: 'confirmed',
      maxRetries: 3,
    });

    return signature;
  }

  async buildVersionedTransaction(
    instructions: TransactionInstruction[],
    payer: PublicKey,
    signers: Keypair[]
  ): Promise<VersionedTransaction> {
    const { blockhash } = await this.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign(signers);

    return transaction;
  }

  async sendVersionedTransaction(transaction: VersionedTransaction): Promise<string> {
    // First simulate to get detailed error logs if it fails
    const simulation = await this.connection.simulateTransaction(transaction, {
      commitment: 'confirmed',
    });

    if (simulation.value.err) {
      const logs = simulation.value.logs?.join('\n') || 'No logs available';
      const errStr = JSON.stringify(simulation.value.err);
      throw new Error(`Simulation failed. Error: ${errStr}. Logs:\n${logs}`);
    }

    const signature = await this.connection.sendTransaction(transaction, {
      skipPreflight: true, // Already simulated
      maxRetries: 3,
    });

    await this.connection.confirmTransaction(signature, 'confirmed');
    return signature;
  }

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

  async accountExists(publicKey: PublicKey): Promise<boolean> {
    const accountInfo = await this.connection.getAccountInfo(publicKey);
    return accountInfo !== null;
  }
}

// Singleton instance
let solanaServiceInstance: SolanaService | null = null;

export function getSolanaService(rpcUrl?: string): SolanaService {
  if (!solanaServiceInstance) {
    solanaServiceInstance = new SolanaService(
      rpcUrl || 'https://api.mainnet-beta.solana.com'
    );
  } else if (rpcUrl) {
    solanaServiceInstance.updateRpcUrl(rpcUrl);
  }
  return solanaServiceInstance;
}
