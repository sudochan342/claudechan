import { VersionedTransaction, PublicKey, Keypair } from '@solana/web3.js';
import { SolanaService } from './solana-service';
import { solToLamports } from './helpers';

// SOL mint address (native SOL wrapped)
const SOL_MINT = 'So11111111111111111111111111111111111111112';

interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
    };
    percent: number;
  }>;
}

interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
  prioritizationType: {
    computeBudget: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
  dynamicSlippageReport: {
    slippageBps: number;
    otherAmount: number;
    simulatedIncurredSlippageBps: number;
    amplificationRatio: string;
  };
}

export class JupiterService {
  private solanaService: SolanaService;

  constructor(solanaService: SolanaService) {
    this.solanaService = solanaService;
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 500
  ): Promise<{ quote: JupiterQuote | null; error?: string }> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
      });

      // Use our server-side proxy to avoid CORS and auth issues
      const url = `/api/jupiter/quote?${params}`;
      console.log('Jupiter quote URL:', url);

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        console.error('Jupiter quote error:', response.status, data);
        return { quote: null, error: data.error || `Jupiter API ${response.status}` };
      }

      console.log('Jupiter quote response:', data);
      return { quote: data };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Jupiter quote failed:', errorMsg);
      return { quote: null, error: errorMsg };
    }
  }

  async buildSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: string,
    priorityFeeLamports: number = 100000
  ): Promise<JupiterSwapResponse | null> {
    try {
      // Use our server-side proxy to avoid CORS and auth issues
      const response = await fetch('/api/jupiter/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey,
          prioritizationFeeLamports: priorityFeeLamports,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Jupiter swap build error:', response.status, data);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Jupiter swap build failed:', error);
      return null;
    }
  }

  async executeSwap(
    wallet: Keypair,
    tokenMint: string,
    solAmount: number,
    slippageBps: number = 500
  ): Promise<{ success: boolean; signature?: string; tokensReceived?: string; error?: string }> {
    try {
      // Step 1: Get quote (SOL -> Token)
      const lamports = solToLamports(solAmount);
      const quoteResult = await this.getQuote(SOL_MINT, tokenMint, lamports, slippageBps);

      if (!quoteResult.quote) {
        return { success: false, error: quoteResult.error || 'Failed to get quote from Jupiter' };
      }

      const quote = quoteResult.quote;

      // Step 2: Build swap transaction
      const swapResponse = await this.buildSwapTransaction(
        quote,
        wallet.publicKey.toBase58()
      );

      if (!swapResponse || !swapResponse.swapTransaction) {
        return { success: false, error: 'Failed to build swap transaction' };
      }

      // Step 3: Deserialize, sign, and send
      const transactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);
      transaction.sign([wallet]);

      const signature = await this.solanaService.sendVersionedTransaction(transaction);

      return {
        success: true,
        signature,
        tokensReceived: quote.outAmount,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Jupiter swap failed:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async executeSell(
    wallet: Keypair,
    tokenMint: string,
    tokenAmount: bigint,
    slippageBps: number = 500
  ): Promise<{ success: boolean; signature?: string; solReceived?: string; error?: string }> {
    try {
      // Step 1: Get quote (Token -> SOL)
      const quoteResult = await this.getQuote(
        tokenMint,
        SOL_MINT,
        Number(tokenAmount),
        slippageBps
      );

      if (!quoteResult.quote) {
        return { success: false, error: quoteResult.error || 'Failed to get sell quote from Jupiter' };
      }

      const quote = quoteResult.quote;

      // Step 2: Build swap transaction
      const swapResponse = await this.buildSwapTransaction(
        quote,
        wallet.publicKey.toBase58()
      );

      if (!swapResponse || !swapResponse.swapTransaction) {
        return { success: false, error: 'Failed to build sell transaction' };
      }

      // Step 3: Deserialize, sign, and send
      const transactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);
      transaction.sign([wallet]);

      const signature = await this.solanaService.sendVersionedTransaction(transaction);

      return {
        success: true,
        signature,
        solReceived: quote.outAmount,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Jupiter sell failed:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }
}

// Singleton
let jupiterServiceInstance: JupiterService | null = null;

export function getJupiterService(solanaService: SolanaService): JupiterService {
  if (!jupiterServiceInstance) {
    jupiterServiceInstance = new JupiterService(solanaService);
  }
  return jupiterServiceInstance;
}
