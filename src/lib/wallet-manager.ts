import { Keypair, PublicKey } from '@solana/web3.js';
import { WalletInfo, BundleWallet } from './types';
import { SolanaService } from './solana-service';
import {
  generateKeypair,
  keypairFromBase58,
  keypairToBase58,
  lamportsToSol,
  shortenAddress,
} from './helpers';

const WALLETS_STORAGE_KEY = 'pumpfun_bot_wallets';

export class WalletManager {
  private wallets: Map<string, BundleWallet> = new Map();
  private solanaService: SolanaService;

  constructor(solanaService: SolanaService) {
    this.solanaService = solanaService;
    this.loadWallets();
  }

  private loadWallets(): void {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(WALLETS_STORAGE_KEY);
      if (saved) {
        const savedWallets: WalletInfo[] = JSON.parse(saved);
        savedWallets.forEach(info => {
          try {
            const keypair = keypairFromBase58(info.privateKey);
            this.wallets.set(info.publicKey, { keypair, info });
          } catch (e) {
            console.error('Failed to load wallet:', e);
          }
        });
      }
    } catch (e) {
      console.error('Failed to load wallets from storage:', e);
    }
  }

  private saveWallets(): void {
    if (typeof window === 'undefined') return;

    try {
      const walletsArray = Array.from(this.wallets.values()).map(w => w.info);
      localStorage.setItem(WALLETS_STORAGE_KEY, JSON.stringify(walletsArray));
    } catch (e) {
      console.error('Failed to save wallets:', e);
    }
  }

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
        createdAt: Date.now(),
      };

      const bundleWallet: BundleWallet = { keypair, info };
      this.wallets.set(info.publicKey, bundleWallet);
      newWallets.push(bundleWallet);
    }

    this.saveWallets();
    return newWallets;
  }

  getAllWallets(): BundleWallet[] {
    return Array.from(this.wallets.values());
  }

  getFundedWallets(): BundleWallet[] {
    return this.getAllWallets().filter(w => w.info.funded && w.info.balance > 0);
  }

  getUnfundedWallets(): BundleWallet[] {
    return this.getAllWallets().filter(w => !w.info.funded);
  }

  getWallet(publicKey: string): BundleWallet | undefined {
    return this.wallets.get(publicKey);
  }

  getRandomWallets(count: number, fundedOnly: boolean = true): BundleWallet[] {
    const pool = fundedOnly ? this.getFundedWallets() : this.getAllWallets();
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

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

  markAsFunded(publicKey: string, balance: number): void {
    const wallet = this.wallets.get(publicKey);
    if (wallet) {
      wallet.info.funded = true;
      wallet.info.balance = balance;
      this.saveWallets();
    }
  }

  deleteWallet(publicKey: string): boolean {
    const deleted = this.wallets.delete(publicKey);
    if (deleted) {
      this.saveWallets();
    }
    return deleted;
  }

  deleteAllWallets(): void {
    this.wallets.clear();
    this.saveWallets();
  }

  getWalletCount(): { total: number; funded: number; unfunded: number } {
    const all = this.getAllWallets();
    const funded = all.filter(w => w.info.funded);
    return {
      total: all.length,
      funded: funded.length,
      unfunded: all.length - funded.length,
    };
  }

  getTotalBalance(): number {
    return this.getAllWallets().reduce((sum, w) => sum + w.info.balance, 0);
  }

  exportWallets(): string {
    const wallets = this.getAllWallets().map(w => ({
      publicKey: w.info.publicKey,
      privateKey: w.info.privateKey,
      index: w.info.index,
    }));
    return JSON.stringify(wallets, null, 2);
  }

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
            createdAt: Date.now(),
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
