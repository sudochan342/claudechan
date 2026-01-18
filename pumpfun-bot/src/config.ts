import * as dotenv from 'dotenv';
import { PublicKey } from '@solana/web3.js';

dotenv.config();

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseFloat(value) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export const config = {
  // Telegram
  telegram: {
    botToken: getEnvVar('TELEGRAM_BOT_TOKEN', ''),
    authorizedUsers: process.env.TELEGRAM_AUTHORIZED_USERS
      ? process.env.TELEGRAM_AUTHORIZED_USERS.split(',').map(id => parseInt(id.trim()))
      : [],
  },

  // Solana RPC
  solana: {
    rpcUrl: getEnvVar('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
    wsUrl: getEnvVar('SOLANA_WS_URL', 'wss://api.mainnet-beta.solana.com'),
  },

  // Jito
  jito: {
    blockEngineUrl: getEnvVar('JITO_BLOCK_ENGINE_URL', 'https://mainnet.block-engine.jito.wtf'),
    tipAccount: getEnvVar('JITO_TIP_ACCOUNT', '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
    tipAmountSol: getEnvNumber('JITO_TIP_AMOUNT_SOL', 0.001),
  },

  // Master wallet
  masterWallet: {
    privateKey: getEnvVar('MASTER_WALLET_PRIVATE_KEY', ''),
  },

  // Bot settings
  bot: {
    maxWallets: getEnvNumber('MAX_WALLETS', 20),
    defaultBuyAmountSol: getEnvNumber('DEFAULT_BUY_AMOUNT_SOL', 0.01),
  },

  // Stealth funding settings
  stealthFunding: {
    minDelayMs: getEnvNumber('MIN_DELAY_MS', 5000),
    maxDelayMs: getEnvNumber('MAX_DELAY_MS', 30000),
    useIntermediateWallets: getEnvBoolean('USE_INTERMEDIATE_WALLETS', true),
    intermediateWalletCount: getEnvNumber('INTERMEDIATE_WALLET_COUNT', 3),
    randomizeAmounts: true,
    amountVariancePercent: 15,
  },

  // PumpFun settings
  pumpfun: {
    programId: new PublicKey(getEnvVar('PUMPFUN_PROGRAM_ID', '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')),
    slippageBps: getEnvNumber('SLIPPAGE_BPS', 500),
  },
};

export type Config = typeof config;
