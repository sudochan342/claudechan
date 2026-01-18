import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionInstruction,
} from '@solana/web3.js';

// Correct Solana Program IDs
export const PROGRAM_IDS = {
  TOKEN_PROGRAM_ID: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  ASSOCIATED_TOKEN_PROGRAM_ID: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  SYSTEM_PROGRAM_ID: SystemProgram.programId,
  COMPUTE_BUDGET_PROGRAM_ID: ComputeBudgetProgram.programId,
  // Pump.fun program ID
  PUMP_FUN_PROGRAM_ID: new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'),
};

// RPC endpoint
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

/**
 * Create a properly formatted transaction with compute budget
 * This fixes the "IncorrectProgramId" error by ensuring instructions are in the correct order
 */
export async function createBuyTransaction(
  connection: Connection,
  userPublicKey: PublicKey,
  tokenMint: PublicKey,
  solAmount: number,
  slippageBps: number = 500 // 5% default slippage
): Promise<Transaction> {
  const transaction = new Transaction();

  // CRITICAL: Instruction order matters!
  // 1. First, add compute budget instructions (these should be at the beginning)
  const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
    units: 200_000,
  });

  const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 100_000,
  });

  transaction.add(computeUnitLimit);
  transaction.add(computeUnitPrice);

  // 2. Then add the actual swap instruction
  // For Pump.fun, we need to call the buy instruction
  const buyInstruction = await createPumpFunBuyInstruction(
    userPublicKey,
    tokenMint,
    solAmount,
    slippageBps
  );

  transaction.add(buyInstruction);

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = userPublicKey;

  return transaction;
}

/**
 * Create Pump.fun buy instruction
 */
async function createPumpFunBuyInstruction(
  buyer: PublicKey,
  tokenMint: PublicKey,
  solAmount: number,
  slippageBps: number
): Promise<TransactionInstruction> {
  // Pump.fun uses a bonding curve model
  // The buy instruction needs:
  // 1. Global state account
  // 2. Fee recipient
  // 3. Mint
  // 4. Bonding curve
  // 5. Associated token accounts

  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), tokenMint.toBuffer()],
    PROGRAM_IDS.PUMP_FUN_PROGRAM_ID
  );

  const [global] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    PROGRAM_IDS.PUMP_FUN_PROGRAM_ID
  );

  // Associated token account for the buyer
  const associatedUser = await getAssociatedTokenAddress(
    tokenMint,
    buyer
  );

  // Associated bonding curve token account
  const associatedBondingCurve = await getAssociatedTokenAddress(
    tokenMint,
    bondingCurve,
    true // allowOwnerOffCurve
  );

  const lamports = Math.floor(solAmount * 1e9); // Convert SOL to lamports
  const maxSolCost = BigInt(lamports);

  // Calculate minimum tokens with slippage
  // This is a simplified calculation - in production you'd query the bonding curve
  const minTokensOut = BigInt(0); // Set to 0 for now, should be calculated based on bonding curve

  // Instruction data for buy
  // Format: [discriminator (8 bytes), amount (8 bytes), max_sol_cost (8 bytes)]
  const instructionData = Buffer.alloc(24);

  // Pump.fun buy discriminator
  instructionData.writeBigUInt64LE(BigInt('16927863322537952870'), 0);
  instructionData.writeBigUInt64LE(maxSolCost, 8);
  instructionData.writeBigUInt64LE(minTokensOut, 16);

  const keys = [
    { pubkey: global, isSigner: false, isWritable: false },
    { pubkey: new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM'), isSigner: false, isWritable: true }, // Fee recipient
    { pubkey: tokenMint, isSigner: false, isWritable: false },
    { pubkey: bondingCurve, isSigner: false, isWritable: true },
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
    { pubkey: associatedUser, isSigner: false, isWritable: true },
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: PROGRAM_IDS.SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: PROGRAM_IDS.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
    { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // Event authority placeholder
    { pubkey: PROGRAM_IDS.PUMP_FUN_PROGRAM_ID, isSigner: false, isWritable: false }, // Program
  ];

  return new TransactionInstruction({
    keys,
    programId: PROGRAM_IDS.PUMP_FUN_PROGRAM_ID,
    data: instructionData,
  });
}

/**
 * Get associated token address
 */
async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false
): Promise<PublicKey> {
  const [address] = PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      PROGRAM_IDS.TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    PROGRAM_IDS.ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

/**
 * Create Jupiter swap transaction (alternative to Pump.fun)
 */
export async function createJupiterSwapTransaction(
  userPublicKey: PublicKey,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<Transaction> {
  // Jupiter API v6
  const quoteResponse = await fetch(
    `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
  );

  const quoteData = await quoteResponse.json();

  // Get swap transaction
  const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quoteResponse: quoteData,
      userPublicKey: userPublicKey.toString(),
      wrapAndUnwrapSol: true,
      computeUnitPriceMicroLamports: 100000,
    }),
  });

  const { swapTransaction } = await swapResponse.json();

  // Deserialize transaction
  const transactionBuf = Buffer.from(swapTransaction, 'base64');
  const transaction = Transaction.from(transactionBuf);

  return transaction;
}

/**
 * Send and confirm transaction with proper error handling
 */
export async function sendAndConfirmTransactionWithRetry(
  connection: Connection,
  transaction: Transaction,
  signers: any[]
): Promise<string> {
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const signature = await connection.sendTransaction(transaction, signers, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return signature;
    } catch (error: any) {
      retries++;

      if (error.message?.includes('IncorrectProgramId')) {
        throw new Error('Transaction failed: Incorrect Program ID. Please check the token contract address.');
      }

      if (retries >= maxRetries) {
        throw error;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }

  throw new Error('Transaction failed after maximum retries');
}
