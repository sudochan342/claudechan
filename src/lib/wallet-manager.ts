import { Keypair, PublicKey } from '@solana/web3.js';
import { WalletInfo, BundleWallet } from './types';
import { SolanaService } from './solana-service';
import {
  generateKeypair,
  keypairFromBase58,
  keypairToBase58,
} from './helpers';

// Fallback to localStorage if API fails
const WALLETS_STORAGE_KEY = 'pumpfun_bot_wallets';

export class WalletManager {
  private wallets: Map<string, BundleWallet> = new Map();
  private solanaService: SolanaService;
  private initialized: boolean = false;

  constructor(solanaService: SolanaService) {
    this.solanaService = solanaService;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.loadWallets();
    this.initialized = true;
  }

  private async loadWallets(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Try to load from API (SQLite database)
      const response = await fetch('/api/wallets');
      if (response.ok) {
        const data = await response.json();
        if (data.wallets && Array.isArray(data.wallets)) {
          data.wallets.forEach((dbWallet: {
            public_key: string;
            private_key: string;
            wallet_index: number;
            funded: number;
            balance: number;
            created_at: number;
          }) => {
            try {
              const keypair = keypairFromBase58(dbWallet.private_key);
              const info: WalletInfo = {
                publicKey: dbWallet.public_key,
                privateKey: dbWallet.private_key,
                index: dbWallet.wallet_index,
                funded: dbWallet.funded === 1,
                balance: dbWallet.balance,
                createdAt: dbWallet.created_at,
              };
              this.wallets.set(info.publicKey, { keypair, info });
            } catch (e) {
              console.error('Failed to load wallet from DB:', e);
            }
          });
          console.log(`Loaded ${this.wallets.size} wallets from database`);

          // Migrate localStorage wallets to DB if any exist but DB is empty
          if (this.wallets.size === 0) {
            await this.migrateFromLocalStorage();
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load from API, falling back to localStorage:', e);
    }

    // Fallback to localStorage
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): void {
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
        console.log(`Loaded ${this.wallets.size} wallets from localStorage`);
      }
    } catch (e) {
      console.error('Failed to load wallets from localStorage:', e);
    }
  }

  private async migrateFromLocalStorage(): Promise<void> {
    try {
      const saved = localStorage.getItem(WALLETS_STORAGE_KEY);
      if (saved) {
        const savedWallets: WalletInfo[] = JSON.parse(saved);
        if (savedWallets.length > 0) {
          console.log(`Migrating ${savedWallets.length} wallets from localStorage to database...`);

          // Convert to DB format
          const dbWallets = savedWallets.map(info => ({
            public_key: info.publicKey,
            private_key: info.privateKey,
            wallet_index: info.index,
            funded: info.funded ? 1 : 0,
            balance: info.balance,
            created_at: info.createdAt,
          }));

          // Save to database
          const response = await fetch('/api/wallets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallets: dbWallets }),
          });

          if (response.ok) {
            // Load into memory
            savedWallets.forEach(info => {
              try {
                const keypair = keypairFromBase58(info.privateKey);
                this.wallets.set(info.publicKey, { keypair, info });
              } catch (e) {
                console.error('Failed to load wallet:', e);
              }
            });
            console.log('Migration complete!');
          }
        }
      }
    } catch (e) {
      console.error('Migration failed:', e);
      this.loadFromLocalStorage();
    }
  }

  private async saveWallets(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Save to localStorage as backup
    try {
      const walletsArray = Array.from(this.wallets.values()).map(w => w.info);
      localStorage.setItem(WALLETS_STORAGE_KEY, JSON.stringify(walletsArray));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  private async saveToDb(wallets: WalletInfo[]): Promise<boolean> {
    try {
      const dbWallets = wallets.map(info => ({
        public_key: info.publicKey,
        private_key: info.privateKey,
        wallet_index: info.index,
        funded: info.funded ? 1 : 0,
        balance: info.balance,
        created_at: info.createdAt,
      }));

      const response = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallets: dbWallets }),
      });

      return response.ok;
    } catch (e) {
      console.error('Failed to save to database:', e);
      return false;
    }
  }

  private async updateInDb(updates: { publicKey: string; funded?: number; balance?: number }[]): Promise<boolean> {
    try {
      const response = await fetch('/api/wallets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      return response.ok;
    } catch (e) {
      console.error('Failed to update in database:', e);
      return false;
    }
  }

  async generateWallets(count: number): Promise<BundleWallet[]> {
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

    // Save to database
    const infos = newWallets.map(w => w.info);
    await this.saveToDb(infos);
    await this.saveWallets();

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

    await this.updateInDb([{ publicKey, funded: balance > 0 ? 1 : 0, balance }]);
    await this.saveWallets();

    return balance;
  }

  async updateAllBalances(): Promise<Map<string, number>> {
    const publicKeys = this.getAllWallets().map(w => new PublicKey(w.info.publicKey));
    const balances = await this.solanaService.getMultipleBalances(publicKeys);

    const updates: { publicKey: string; funded?: number; balance?: number }[] = [];

    balances.forEach((balance, pubkey) => {
      const wallet = this.wallets.get(pubkey);
      if (wallet) {
        wallet.info.balance = balance;
        wallet.info.funded = balance > 0;
        updates.push({ publicKey: pubkey, funded: balance > 0 ? 1 : 0, balance });
      }
    });

    await this.updateInDb(updates);
    await this.saveWallets();

    return balances;
  }

  async markAsFunded(publicKey: string, balance: number): Promise<void> {
    const wallet = this.wallets.get(publicKey);
    if (wallet) {
      wallet.info.funded = true;
      wallet.info.balance = balance;
      await this.updateInDb([{ publicKey, funded: 1, balance }]);
      await this.saveWallets();
    }
  }

  async deleteWallet(publicKey: string): Promise<boolean> {
    const deleted = this.wallets.delete(publicKey);
    if (deleted) {
      try {
        await fetch(`/api/wallets?publicKey=${encodeURIComponent(publicKey)}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to delete from DB:', e);
      }
      await this.saveWallets();
    }
    return deleted;
  }

  async deleteAllWallets(): Promise<void> {
    this.wallets.clear();
    try {
      await fetch('/api/wallets', { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete from DB:', e);
    }
    await this.saveWallets();
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

  async importWallets(privateKeys: string[]): Promise<number> {
    let imported = 0;
    const startIndex = this.wallets.size;
    const newWallets: WalletInfo[] = [];

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
          newWallets.push(info);
          imported++;
        }
      } catch (error) {
        console.error(`Failed to import wallet: ${error}`);
      }
    });

    if (newWallets.length > 0) {
      await this.saveToDb(newWallets);
      await this.saveWallets();
    }

    return imported;
  }
}
