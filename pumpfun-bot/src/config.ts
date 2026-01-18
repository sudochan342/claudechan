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
  },

  // Master wallet
  masterWallet: {
    privateKey: getEnvVar('MASTER_WALLET_PRIVATE_KEY', ''),
  },

  // Bot settings
  bot: {
    maxWallets: getEnvNumber('MAX_WALLETS', 20),
    defaultBuyAmountSol: getEnvNumber('DEFAULT_BUY_AMOUNT_SOL', 0.05),
  },

  // CEX-Style Stealth funding settings
  stealthFunding: {
    minDelayMs: getEnvNumber('MIN_DELAY_MS', 60000),
    maxDelayMs: getEnvNumber('MAX_DELAY_MS', 300000),
    useIntermediateWallets: getEnvBoolean('USE_INTERMEDIATE_WALLETS', true),
    intermediateWalletCount: getEnvNumber('HOT_WALLET_COUNT', 5),
    randomizeAmounts: true,
    amountVariancePercent: 40,
  },

  // Spread buy settings
  spreadBuy: {
    minDelayMs: getEnvNumber('BUY_MIN_DELAY_MS', 3000),
    maxDelayMs: getEnvNumber('BUY_MAX_DELAY_MS', 10000),
  },

  // PumpFun settings
  pumpfun: {
    programId: new PublicKey(getEnvVar('PUMPFUN_PROGRAM_ID', '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')),
    slippageBps: getEnvNumber('SLIPPAGE_BPS', 500),
  },
};

export type Config = typeof config;
