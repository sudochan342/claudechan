import { Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export interface WalletInfo {
  publicKey: string;
  privateKey: string;
  index: number;
  funded: boolean;
  balance: number;
  createdAt: number;
}

export interface BundleWallet {
  keypair: Keypair;
  info: WalletInfo;
}

export interface FundingPath {
  from: Keypair;
  to: PublicKey;
  amount: number;
  intermediate?: Keypair[];
  delay: number;
}

export interface StealthFundingConfig {
  minDelayMs: number;
  maxDelayMs: number;
  useIntermediateWallets: boolean;
  intermediateWalletCount: number;
  randomizeAmounts: boolean;
  amountVariancePercent: number;
}

export interface PumpFunBuyParams {
  mint: PublicKey;
  solAmount: number;
  slippageBps: number;
  wallet: Keypair;
}

export interface BundleBuyParams {
  mint: PublicKey;
  totalSolAmount: number;
  walletCount: number;
  slippageBps: number;
  jitoTipAmount: number;
}

export interface BundleResult {
  success: boolean;
  bundleId?: string;
  signatures?: string[];
  error?: string;
}

export interface PumpFunTokenInfo {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  imageUri?: string;
  creator: string;
  bondingCurve: string;
  associatedBondingCurve: string;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  totalSupply: number;
  complete: boolean;
}

export interface BotState {
  wallets: WalletInfo[];
  masterBalance: number;
  activeToken?: string;
  lastBundleId?: string;
}

export interface TelegramUserSession {
  chatId: number;
  step: string;
  data: Record<string, unknown>;
}

export type BundleStatus = 'pending' | 'landed' | 'failed' | 'expired';

export interface JitoBundleResponse {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: {
    code: number;
    message: string;
  };
}
