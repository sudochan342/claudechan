# PumpFun Bundle Buyer Bot

A Telegram bot for buying PumpFun tokens using multiple wallets with stealth funding to avoid Bubblemaps detection. Features spread buying to avoid magic node detection.

## Features

- **Multi-Wallet Management**: Generate and manage multiple Solana wallets
- **CEX-Style Stealth Funding**: Fund wallets using hot wallet pools, mixers, and time delays to avoid Bubblemaps
- **Anti-Magic-Node Buying**: Spread buys across different blocks to avoid detection
- **Sell All**: One-click sell all positions across all wallets
- **Token Tools**: Burn LP, edit metadata, revoke authorities
- **Dashboard UI**: Clean Telegram interface with buttons and state tracking

## Anti-Detection Features

### CEX-Style Funding (Anti-Bubblemaps)

Bubblemaps detects wallet connections by analyzing on-chain transaction patterns. This bot avoids detection by simulating CEX (exchange) withdrawals:

1. **Hot Wallet Pool**: Creates 5 "hot wallets" that simulate exchange behavior
2. **Mixer Chains**: 1-3 intermediate hops per wallet
3. **Time Spreading**: 1-5 minute delays between transfers
4. **Amount Variance**: ±40% randomization (exchanges never send exact amounts)
5. **Withdrawal Fees**: Simulates CEX withdrawal fees for realism

```
Traditional (Detectable):          CEX-Style (Not Detectable):
Master → Wallet1                   Master → Hot1 → Mixer → Wallet1
Master → Wallet2                   Master → Hot2 → Mixer → Mixer → Wallet2
Master → Wallet3                   Master → Hot3 -(5min)→ Wallet3
```

### Spread Buying (Anti-Magic-Nodes)

Bubblemaps "magic nodes" detect wallets that interact with the same token contract around the same time. This bot avoids detection by:

1. **Different Blocks**: 3-10 second delays between each buy
2. **Random Order**: Wallets buy in shuffled order
3. **Amount Variance**: Each wallet buys slightly different amounts

## Quick Start

```bash
cd pumpfun-bot
npm install
cp .env.example .env
# Edit .env with your bot token & master wallet key
npm run dev
```

## Telegram Interface

### Dashboard
```
PUMPFUN BOT

Master Wallet
abc123...xyz789
Balance: 5.0000 SOL

Sub Wallets
Total: 10 | Funded: 10
Combined Balance: 1.0000 SOL

Current Holdings
Token: pump...xyz
Wallets: 10
Invested: 0.5000 SOL

[Wallets] [Fund]
[Buy] [Sell]
[Token Tools] [Refresh]
```

### Commands

| Command | Description |
|---------|-------------|
| `/start` | Show dashboard |
| `/wallets` | Manage wallets |
| `/fund` | Fund wallets |
| `/buy` | Buy tokens |
| `/sell` | Sell positions |
| `/status` | Current state |

## Usage Flow

### 1. Generate Wallets
- Tap `Wallets` → `+10` to generate 10 wallets

### 2. Fund Wallets
- Tap `Fund` → `CEX Style (Stealth)`
- Enter total SOL amount
- Wait for funding (takes time for stealth)

### 3. Buy Token
- Tap `Buy` → `Start Buy`
- Enter token CA
- Enter SOL amount
- Select wallet count
- Confirm

### 4. Sell
- Tap `Sell` → `SELL ALL`
- All wallets sell their positions

## Token Tools

- **Burn LP**: Burn LP tokens after graduation
- **Edit Metadata**: Change token name/symbol/image
- **Revoke Mint Auth**: Remove mint authority

## Project Structure

```
pumpfun-bot/
├── src/
│   ├── core/
│   │   ├── wallet-manager.ts    # Wallet generation & storage
│   │   ├── stealth-funder.ts    # CEX-style anti-Bubblemaps funding
│   │   ├── pumpfun-buyer.ts     # Spread buy & sell logic
│   │   └── token-manager.ts     # LP burn, metadata, authorities
│   ├── services/
│   │   └── solana.ts            # Solana RPC wrapper
│   ├── telegram/
│   │   └── bot.ts               # Telegram bot interface
│   └── ...
```

## Configuration

### CEX-Style Funding

| Setting | Default | Description |
|---------|---------|-------------|
| `MIN_DELAY_MS` | 60000 | Min delay between transfers (1 min) |
| `MAX_DELAY_MS` | 300000 | Max delay between transfers (5 min) |
| `USE_INTERMEDIATE_WALLETS` | true | Use mixer hops |
| `HOT_WALLET_COUNT` | 5 | Hot wallets in pool |

### Spread Buying

| Setting | Default | Description |
|---------|---------|-------------|
| `BUY_MIN_DELAY_MS` | 3000 | Min delay between buys |
| `BUY_MAX_DELAY_MS` | 10000 | Max delay between buys |
| `SLIPPAGE_BPS` | 500 | Slippage tolerance (5%) |

## Security

- Never share `.env` file
- Use dedicated master wallet
- Keep wallet exports secure
- Set `TELEGRAM_AUTHORIZED_USERS` to restrict access

## Troubleshooting

**"Insufficient balance"**
- Fund master wallet with enough SOL

**"No funded wallets"**
- Generate and fund wallets first

**"RPC error"**
- Use paid RPC (Helius, QuickNode, Triton)

## Disclaimer

Educational purposes only. Use at your own risk. Cryptocurrency trading involves significant risk of loss.
