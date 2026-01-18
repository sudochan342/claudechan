import {
  Keypair,
  PublicKey,
  VersionedTransaction,
  Transaction,
  SystemProgram,
  TransactionMessage,
  Connection,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { JitoBundleResponse, BundleStatus } from '../types';
import { sleep, solToLamports } from '../utils/helpers';

const JITO_ENDPOINTS = [
  'https://mainnet.block-engine.jito.wtf',
  'https://amsterdam.mainnet.block-engine.jito.wtf',
  'https://frankfurt.mainnet.block-engine.jito.wtf',
  'https://ny.mainnet.block-engine.jito.wtf',
  'https://tokyo.mainnet.block-engine.jito.wtf',
];

// Jito tip accounts
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

export class JitoService {
  private endpoint: string;
  private connection: Connection;

  constructor(connection: Connection, endpoint?: string) {
    this.endpoint = endpoint || JITO_ENDPOINTS[0];
    this.connection = connection;
  }

  /**
   * Get a random Jito tip account
   */
  getRandomTipAccount(): PublicKey {
    const randomIndex = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
    return new PublicKey(JITO_TIP_ACCOUNTS[randomIndex]);
  }

  /**
   * Create a tip instruction
   */
  createTipInstruction(fromPubkey: PublicKey, tipAmountSol: number): ReturnType<typeof SystemProgram.transfer> {
    return SystemProgram.transfer({
      fromPubkey,
      toPubkey: this.getRandomTipAccount(),
      lamports: solToLamports(tipAmountSol),
    });
  }

  /**
   * Send a bundle of transactions to Jito
   */
  async sendBundle(transactions: VersionedTransaction[]): Promise<string> {
    const serializedTxs = transactions.map(tx => bs58.encode(tx.serialize()));

    const response = await fetch(`${this.endpoint}/api/v1/bundles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [serializedTxs],
      }),
    });

    const result = (await response.json()) as JitoBundleResponse;

    if (result.error) {
      throw new Error(`Jito bundle error: ${result.error.message}`);
    }

    if (!result.result) {
      throw new Error('No bundle ID returned from Jito');
    }

    return result.result;
  }

  /**
   * Get bundle status
   */
  async getBundleStatus(bundleId: string): Promise<BundleStatus> {
    const response = await fetch(`${this.endpoint}/api/v1/bundles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBundleStatuses',
        params: [[bundleId]],
      }),
    });

    const result = await response.json() as {
      result?: {
        value?: Array<{
          confirmation_status?: string;
        }>;
      };
    };

    if (result.result?.value?.[0]?.confirmation_status) {
      const status = result.result.value[0].confirmation_status;
      if (status === 'confirmed' || status === 'finalized') {
        return 'landed';
      }
    }

    return 'pending';
  }

  /**
   * Wait for bundle to land
   */
  async waitForBundle(
    bundleId: string,
    maxWaitMs: number = 60000,
    pollIntervalMs: number = 2000
  ): Promise<{ landed: boolean; status: BundleStatus }> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getBundleStatus(bundleId);

      if (status === 'landed') {
        return { landed: true, status };
      }

      if (status === 'failed' || status === 'expired') {
        return { landed: false, status };
      }

      await sleep(pollIntervalMs);
    }

    return { landed: false, status: 'expired' };
  }

  /**
   * Send bundle with retry
   */
  async sendBundleWithRetry(
    transactions: VersionedTransaction[],
    maxRetries: number = 3
  ): Promise<{ bundleId: string; landed: boolean }> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Try different endpoints
        const endpointIndex = i % JITO_ENDPOINTS.length;
        this.endpoint = JITO_ENDPOINTS[endpointIndex];

        console.log(`Sending bundle (attempt ${i + 1}/${maxRetries}) to ${this.endpoint}`);

        const bundleId = await this.sendBundle(transactions);
        console.log(`Bundle sent: ${bundleId}`);

        const { landed, status } = await this.waitForBundle(bundleId);

        if (landed) {
          return { bundleId, landed: true };
        }

        console.log(`Bundle status: ${status}, retrying...`);
      } catch (error) {
        lastError = error as Error;
        console.error(`Bundle attempt ${i + 1} failed: ${lastError.message}`);
        await sleep(1000);
      }
    }

    throw lastError || new Error('Failed to send bundle after all retries');
  }

  /**
   * Get tip amount recommendation
   */
  async getRecommendedTip(): Promise<number> {
    // In production, you'd query for recent tip levels
    // For now, return a reasonable default
    return 0.001; // 0.001 SOL
  }

  /**
   * Create a bundle transaction with tip
   */
  async createBundleTransaction(
    instructions: ReturnType<typeof SystemProgram.transfer>[],
    payer: Keypair,
    signers: Keypair[],
    tipAmountSol: number
  ): Promise<VersionedTransaction> {
    // Add tip instruction
    const tipInstruction = this.createTipInstruction(payer.publicKey, tipAmountSol);
    const allInstructions = [...instructions, tipInstruction];

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');

    const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: allInstructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([payer, ...signers]);

    return transaction;
  }
}
