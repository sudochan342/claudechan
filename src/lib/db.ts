import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database file location
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'wallets.db');

// Singleton database instance
let db: DatabaseType | null = null;

function getDb(): DatabaseType {
  if (db) return db;

  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Create database connection with busy timeout
  db = new Database(DB_PATH, { timeout: 5000 });
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      public_key TEXT PRIMARY KEY,
      private_key TEXT NOT NULL,
      wallet_index INTEGER NOT NULL,
      funded INTEGER DEFAULT 0,
      balance INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      token_mint TEXT NOT NULL,
      token_balance TEXT NOT NULL,
      sol_spent REAL NOT NULL,
      buy_price REAL NOT NULL,
      buy_time INTEGER NOT NULL,
      UNIQUE(wallet_address, token_mint)
    );

    CREATE INDEX IF NOT EXISTS idx_holdings_token ON holdings(token_mint);
    CREATE INDEX IF NOT EXISTS idx_holdings_wallet ON holdings(wallet_address);
  `);

  return db;
}

export interface DbWallet {
  public_key: string;
  private_key: string;
  wallet_index: number;
  funded: number;
  balance: number;
  created_at: number;
}

export interface DbHolding {
  id?: number;
  wallet_address: string;
  token_mint: string;
  token_balance: string;
  sol_spent: number;
  buy_price: number;
  buy_time: number;
}

// Wallet operations
export const walletDb = {
  getAll: (): DbWallet[] => {
    return getDb().prepare('SELECT * FROM wallets ORDER BY wallet_index').all() as DbWallet[];
  },

  getByPublicKey: (publicKey: string): DbWallet | undefined => {
    return getDb().prepare('SELECT * FROM wallets WHERE public_key = ?').get(publicKey) as DbWallet | undefined;
  },

  insert: (wallet: DbWallet): void => {
    getDb().prepare(`
      INSERT INTO wallets (public_key, private_key, wallet_index, funded, balance, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      wallet.public_key,
      wallet.private_key,
      wallet.wallet_index,
      wallet.funded,
      wallet.balance,
      wallet.created_at
    );
  },

  insertMany: (wallets: DbWallet[]): void => {
    const database = getDb();
    const insert = database.prepare(`
      INSERT INTO wallets (public_key, private_key, wallet_index, funded, balance, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertMany = database.transaction((wallets: DbWallet[]) => {
      for (const w of wallets) {
        insert.run(w.public_key, w.private_key, w.wallet_index, w.funded, w.balance, w.created_at);
      }
    });
    insertMany(wallets);
  },

  update: (publicKey: string, updates: Partial<DbWallet>): void => {
    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (updates.funded !== undefined) {
      fields.push('funded = ?');
      values.push(updates.funded);
    }
    if (updates.balance !== undefined) {
      fields.push('balance = ?');
      values.push(updates.balance);
    }

    if (fields.length > 0) {
      values.push(publicKey);
      getDb().prepare(`UPDATE wallets SET ${fields.join(', ')} WHERE public_key = ?`).run(...values);
    }
  },

  updateMany: (updates: { publicKey: string; funded?: number; balance?: number }[]): void => {
    const database = getDb();
    const update = database.prepare('UPDATE wallets SET funded = ?, balance = ? WHERE public_key = ?');
    const updateMany = database.transaction((updates: { publicKey: string; funded?: number; balance?: number }[]) => {
      for (const u of updates) {
        const wallet = walletDb.getByPublicKey(u.publicKey);
        if (wallet) {
          update.run(
            u.funded ?? wallet.funded,
            u.balance ?? wallet.balance,
            u.publicKey
          );
        }
      }
    });
    updateMany(updates);
  },

  delete: (publicKey: string): boolean => {
    const result = getDb().prepare('DELETE FROM wallets WHERE public_key = ?').run(publicKey);
    return result.changes > 0;
  },

  deleteAll: (): void => {
    getDb().prepare('DELETE FROM wallets').run();
  },

  count: (): { total: number; funded: number } => {
    const database = getDb();
    const total = (database.prepare('SELECT COUNT(*) as count FROM wallets').get() as { count: number }).count;
    const funded = (database.prepare('SELECT COUNT(*) as count FROM wallets WHERE funded = 1').get() as { count: number }).count;
    return { total, funded };
  },

  getNextIndex: (): number => {
    const result = getDb().prepare('SELECT MAX(wallet_index) as max_index FROM wallets').get() as { max_index: number | null };
    return (result.max_index ?? -1) + 1;
  },
};

// Holdings operations
export const holdingsDb = {
  getByToken: (tokenMint: string): DbHolding[] => {
    return getDb().prepare('SELECT * FROM holdings WHERE token_mint = ?').all(tokenMint) as DbHolding[];
  },

  getByWallet: (walletAddress: string): DbHolding[] => {
    return getDb().prepare('SELECT * FROM holdings WHERE wallet_address = ?').all(walletAddress) as DbHolding[];
  },

  upsert: (holding: DbHolding): void => {
    getDb().prepare(`
      INSERT INTO holdings (wallet_address, token_mint, token_balance, sol_spent, buy_price, buy_time)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(wallet_address, token_mint) DO UPDATE SET
        token_balance = excluded.token_balance,
        sol_spent = excluded.sol_spent,
        buy_price = excluded.buy_price,
        buy_time = excluded.buy_time
    `).run(
      holding.wallet_address,
      holding.token_mint,
      holding.token_balance,
      holding.sol_spent,
      holding.buy_price,
      holding.buy_time
    );
  },

  upsertMany: (holdings: DbHolding[]): void => {
    const database = getDb();
    const upsert = database.prepare(`
      INSERT INTO holdings (wallet_address, token_mint, token_balance, sol_spent, buy_price, buy_time)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(wallet_address, token_mint) DO UPDATE SET
        token_balance = excluded.token_balance,
        sol_spent = excluded.sol_spent,
        buy_price = excluded.buy_price,
        buy_time = excluded.buy_time
    `);
    const upsertMany = database.transaction((holdings: DbHolding[]) => {
      for (const h of holdings) {
        upsert.run(h.wallet_address, h.token_mint, h.token_balance, h.sol_spent, h.buy_price, h.buy_time);
      }
    });
    upsertMany(holdings);
  },

  deleteByToken: (tokenMint: string): void => {
    getDb().prepare('DELETE FROM holdings WHERE token_mint = ?').run(tokenMint);
  },

  deleteByWallet: (walletAddress: string): void => {
    getDb().prepare('DELETE FROM holdings WHERE wallet_address = ?').run(walletAddress);
  },

  deleteAll: (): void => {
    getDb().prepare('DELETE FROM holdings').run();
  },
};

export default getDb;
