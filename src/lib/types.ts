import { Keypair, PublicKey } from '@solana/web3.js';

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

export interface PumpFunTokenInfo {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image_uri?: string;
  creator: string;
  bonding_curve?: string;
  associated_bonding_curve?: string;
  virtual_sol_reserves?: number;
  virtual_token_reserves?: number;
  total_supply?: number;
  complete?: boolean;
  market_cap?: number;
  usd_market_cap?: number;
}

export interface HoldingInfo {
  walletAddress: string;
  tokenBalance: string;
  solSpent: number;
  buyTime: number;
  buyPrice: number; // Price per token in SOL (solSpent / tokenBalance)
}

export interface HoldingsState {
  token: string | null;
  totalWallets: number;
  totalTokens: string;
  totalSolSpent: number;
  holdings: HoldingInfo[];
}

export interface BuyResult {
  success: boolean;
  signature?: string;
  tokensReceived?: string;
  error?: string;
}

export interface SellResult {
  success: boolean;
  totalSolReceived: number;
  walletsSold: number;
}

export interface FundingResult {
  success: boolean;
  funded: number;
  total: number;
  signatures: string[];
}

export type TabType = 'dashboard' | 'wallets' | 'buy' | 'sell' | 'settings';

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

export interface BotSettings {
  rpcUrl: string;
  masterPrivateKey: string;
  slippageBps: number;
  buyDelayMinMs: number;
  buyDelayMaxMs: number;
}
