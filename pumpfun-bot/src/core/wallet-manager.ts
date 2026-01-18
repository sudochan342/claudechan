import { Keypair, PublicKey } from '@solana/web3.js';
import * as path from 'path';
import { WalletInfo, BundleWallet } from '../types';
import { SolanaService } from '../services/solana';
import {
  generateKeypair,
  keypairFromBase58,
  keypairToBase58,
  saveToJson,
  loadFromJson,
  getCurrentTimestamp,
  shortenAddress,
  lamportsToSol,
} from '../utils/helpers';

const WALLETS_FILE = path.join(process.cwd(), 'data', 'wallets.json');

export class WalletManager {
  private wallets: Map<string, BundleWallet> = new Map();
  private solanaService: SolanaService;

  constructor(solanaService: SolanaService) {
    this.solanaService = solanaService;
    this.loadWallets();
  }

  /**
   * Load wallets from storage
   */
  private loadWallets(): void {
    const savedWallets = loadFromJson<WalletInfo[]>(WALLETS_FILE);
    if (savedWallets) {
      savedWallets.forEach(info => {
        const keypair = keypairFromBase58(info.privateKey);
        this.wallets.set(info.publicKey, { keypair, info });
      });
      console.log(`Loaded ${this.wallets.size} wallets from storage`);
    }
  }

  /**
   * Save wallets to storage
   */
  private saveWallets(): void {
    const walletsArray = Array.from(this.wallets.values()).map(w => w.info);
    saveToJson(WALLETS_FILE, walletsArray);
  }

  /**
   * Generate new wallets
   */
  generateWallets(count: number): BundleWallet[] {
    const newWallets: BundleWallet[] = [];
    const startIndex = this.wallets.size;

    for (let i = 0; i < count; i++) {
      const keypair = generateKeypair();
      const info: WalletInfo = {
        publicKey: keypair.publicKey.toBase58(),
        privateKey: keypairToBase58(keypair),
        index: startIndex + i,
        funded: false,
        balance: 0,
        createdAt: getCurrentTimestamp(),
      };

      const bundleWallet: BundleWallet = { keypair, info };
      this.wallets.set(info.publicKey, bundleWallet);
      newWallets.push(bundleWallet);
    }

    this.saveWallets();
    console.log(`Generated ${count} new wallets`);
    return newWallets;
  }

  /**
   * Get all wallets
   */
  getAllWallets(): BundleWallet[] {
    return Array.from(this.wallets.values());
  }

  /**
   * Get funded wallets
   */
  getFundedWallets(): BundleWallet[] {
    return this.getAllWallets().filter(w => w.info.funded && w.info.balance > 0);
  }

  /**
   * Get unfunded wallets
   */
  getUnfundedWallets(): BundleWallet[] {
    return this.getAllWallets().filter(w => !w.info.funded);
  }

  /**
   * Get wallet by public key
   */
  getWallet(publicKey: string): BundleWallet | undefined {
    return this.wallets.get(publicKey);
  }

  /**
   * Get wallets by indices
   */
  getWalletsByIndices(indices: number[]): BundleWallet[] {
    return this.getAllWallets().filter(w => indices.includes(w.info.index));
  }

  /**
   * Get random wallets
   */
  getRandomWallets(count: number, fundedOnly: boolean = true): BundleWallet[] {
    const pool = fundedOnly ? this.getFundedWallets() : this.getAllWallets();
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * Update wallet balance
   */
  async updateWalletBalance(publicKey: string): Promise<number> {
    const wallet = this.wallets.get(publicKey);
    if (!wallet) {
      throw new Error(`Wallet not found: ${publicKey}`);
    }

    const balance = await this.solanaService.getBalance(new PublicKey(publicKey));
    wallet.info.balance = balance;
    wallet.info.funded = balance > 0;
    this.saveWallets();

    return balance;
  }

  /**
   * Update all wallet balances
   */
  async updateAllBalances(): Promise<Map<string, number>> {
    const publicKeys = this.getAllWallets().map(w => new PublicKey(w.info.publicKey));
    const balances = await this.solanaService.getMultipleBalances(publicKeys);

    balances.forEach((balance, pubkey) => {
      const wallet = this.wallets.get(pubkey);
      if (wallet) {
        wallet.info.balance = balance;
        wallet.info.funded = balance > 0;
      }
    });

    this.saveWallets();
    return balances;
  }

  /**
   * Mark wallet as funded
   */
  markAsFunded(publicKey: string, balance: number): void {
    const wallet = this.wallets.get(publicKey);
    if (wallet) {
      wallet.info.funded = true;
      wallet.info.balance = balance;
      this.saveWallets();
    }
  }

  /**
   * Delete a wallet
   */
  deleteWallet(publicKey: string): boolean {
    const deleted = this.wallets.delete(publicKey);
    if (deleted) {
      this.saveWallets();
    }
    return deleted;
  }

  /**
   * Delete all wallets
   */
  deleteAllWallets(): void {
    this.wallets.clear();
    this.saveWallets();
  }

  /**
   * Get wallet count
   */
  getWalletCount(): { total: number; funded: number; unfunded: number } {
    const all = this.getAllWallets();
    const funded = all.filter(w => w.info.funded);
    return {
      total: all.length,
      funded: funded.length,
      unfunded: all.length - funded.length,
    };
  }

  /**
   * Get total balance across all wallets
   */
  getTotalBalance(): number {
    return this.getAllWallets().reduce((sum, w) => sum + w.info.balance, 0);
  }

  /**
   * Get wallet summary for display
   */
  getWalletSummary(): string {
    const counts = this.getWalletCount();
    const totalBalance = this.getTotalBalance();

    let summary = `📊 **Wallet Summary**\n`;
    summary += `Total Wallets: ${counts.total}\n`;
    summary += `Funded: ${counts.funded}\n`;
    summary += `Unfunded: ${counts.unfunded}\n`;
    summary += `Total Balance: ${lamportsToSol(totalBalance).toFixed(4)} SOL\n\n`;

    if (counts.total > 0) {
      summary += `**Wallet List:**\n`;
      this.getAllWallets()
        .slice(0, 10)
        .forEach((w, i) => {
          summary += `${i + 1}. ${shortenAddress(w.info.publicKey)} - ${lamportsToSol(w.info.balance).toFixed(4)} SOL ${w.info.funded ? '✅' : '❌'}\n`;
        });

      if (counts.total > 10) {
        summary += `... and ${counts.total - 10} more wallets\n`;
      }
    }

    return summary;
  }

  /**
   * Export wallets to JSON
   */
  exportWallets(): string {
    const wallets = this.getAllWallets().map(w => ({
      publicKey: w.info.publicKey,
      privateKey: w.info.privateKey,
      index: w.info.index,
    }));
    return JSON.stringify(wallets, null, 2);
  }

  /**
   * Import wallets from private keys
   */
  importWallets(privateKeys: string[]): number {
    let imported = 0;
    const startIndex = this.wallets.size;

    privateKeys.forEach((pk, i) => {
      try {
        const keypair = keypairFromBase58(pk);
        const pubkey = keypair.publicKey.toBase58();

        if (!this.wallets.has(pubkey)) {
          const info: WalletInfo = {
            publicKey: pubkey,
            privateKey: pk,
            index: startIndex + i,
            funded: false,
            balance: 0,
            createdAt: getCurrentTimestamp(),
          };
          this.wallets.set(pubkey, { keypair, info });
          imported++;
        }
      } catch (error) {
        console.error(`Failed to import wallet: ${error}`);
      }
    });

    this.saveWallets();
    return imported;
  }
}
