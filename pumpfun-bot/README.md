# PumpFun Bundle Buyer Bot

A Telegram bot for buying PumpFun tokens using multiple wallets in Jito bundles, with stealth funding to avoid Bubblemaps detection.

## Features

- **Multi-Wallet Management**: Generate and manage multiple Solana wallets
- **Stealth Funding**: Fund wallets using intermediate hops, random delays, and amount variance to avoid detection on Bubblemaps
- **Bundle Buying**: Execute buys from multiple wallets in a single Jito bundle (all transactions land in the same block)
- **Telegram Interface**: Easy-to-use bot interface for all operations
- **Jito Integration**: MEV protection and guaranteed transaction landing

## How Stealth Funding Works

Bubblemaps detects wallet connections by analyzing on-chain transaction patterns. This bot avoids detection by:

1. **Intermediate Wallets**: Funds flow through temporary wallets before reaching targets
2. **Random Delays**: 5-30 second delays between transfers
3. **Amount Variance**: Each wallet receives slightly different amounts (±15%)
4. **Shuffled Order**: Wallets are funded in random order
5. **Multiple Paths**: Different routing strategies for each wallet

```
Traditional Funding (Detectable):
Master -> Wallet1
Master -> Wallet2  (All visible as connected on Bubblemaps)
Master -> Wallet3

Stealth Funding (Not Detectable):
Master -> Intermediate1 -> Wallet1
Master -> Intermediate2 -> Intermediate3 -> Wallet2
Master -(delayed)-> Wallet3
```

## Quick Start

### 1. Clone and Install

```bash
cd pumpfun-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Telegram Bot Token (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token

# Solana RPC (use a paid RPC for reliability)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Master Wallet Private Key (base58 encoded)
MASTER_WALLET_PRIVATE_KEY=your_private_key

# Optional: Restrict access to specific Telegram user IDs
TELEGRAM_AUTHORIZED_USERS=123456789,987654321
```

### 3. Build and Run

```bash
npm run build
npm start
```

Or for development:

```bash
npm run dev
```

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Show main menu |
| `/wallets` | Manage wallets (generate, view, export) |
| `/fund` | Fund wallets with stealth or quick mode |
| `/buy` | Execute bundle buy |
| `/balance` | Check all wallet balances |
| `/help` | Show help information |

## Bot Usage Flow

### 1. Generate Wallets

1. Send `/wallets` to the bot
2. Click "Generate 10" (or other amount)
3. Wallets are created and saved locally

### 2. Fund Wallets (Stealth Mode)

1. Send `/fund` to the bot
2. Select "Stealth Fund"
3. Enter total SOL amount to distribute
4. Confirm and wait for funding to complete

Stealth funding takes longer but makes wallets appear unconnected on Bubblemaps.

### 3. Bundle Buy

1. Send `/buy` to the bot (or paste a token mint address)
2. Enter the token contract address
3. Enter total SOL amount
4. Select number of wallets
5. Confirm to execute bundle via Jito

All buys execute in the same block for maximum impact.

## Project Structure

```
pumpfun-bot/
├── src/
│   ├── core/
│   │   ├── wallet-manager.ts    # Wallet generation & storage
│   │   ├── stealth-funder.ts    # Anti-Bubblemaps funding
│   │   └── pumpfun-buyer.ts     # PumpFun buy logic
│   ├── services/
│   │   ├── solana.ts            # Solana RPC wrapper
│   │   └── jito.ts              # Jito bundle service
│   ├── telegram/
│   │   └── bot.ts               # Telegram bot interface
│   ├── utils/
│   │   └── helpers.ts           # Utility functions
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   ├── config.ts                # Configuration
│   └── index.ts                 # Entry point
├── data/                        # Wallet storage (gitignored)
├── .env.example
├── package.json
└── tsconfig.json
```

## Configuration Options

### Stealth Funding Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `MIN_DELAY_MS` | 5000 | Minimum delay between transfers (ms) |
| `MAX_DELAY_MS` | 30000 | Maximum delay between transfers (ms) |
| `USE_INTERMEDIATE_WALLETS` | true | Use intermediate hops |
| `INTERMEDIATE_WALLET_COUNT` | 3 | Number of intermediate wallets |

### Trading Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_WALLETS` | 20 | Maximum wallets for bundle |
| `DEFAULT_BUY_AMOUNT_SOL` | 0.01 | Default buy amount |
| `JITO_TIP_AMOUNT_SOL` | 0.001 | Jito bundle tip |
| `SLIPPAGE_BPS` | 500 | Slippage tolerance (5%) |

## Security Notes

⚠️ **Important Security Practices:**

1. **Never share your `.env` file** - it contains private keys
2. **Use a dedicated wallet** as the master wallet
3. **Keep wallet exports secure** - they contain private keys
4. **Use authorized users** to restrict bot access
5. **Monitor your wallets** for unexpected activity

## API Rate Limits

- Use a paid RPC provider for reliability
- Recommended: Helius, QuickNode, or Triton
- Free RPCs have strict rate limits and may fail

## Troubleshooting

### "Insufficient balance"
Fund your master wallet with enough SOL for:
- Wallet funding amounts
- Transaction fees (~0.000005 SOL per tx)
- Jito tips

### "Bundle did not land"
- Increase Jito tip amount
- Check if token is still active on PumpFun
- Verify wallets have sufficient balance

### "RPC error"
- Switch to a paid RPC provider
- Check if RPC endpoint is accessible
- Reduce concurrent requests

## Disclaimer

This software is for educational purposes only. Use at your own risk. Trading cryptocurrencies involves significant risk of loss. Always do your own research and never invest more than you can afford to lose.
