import { config } from './config';
import { SolanaService } from './services/solana';
import { TelegramBot } from './telegram/bot';
import { keypairFromBase58 } from './utils/helpers';

async function main() {
  console.log('🚀 PumpFun Bundle Buyer Bot Starting...\n');

  // Validate configuration
  if (!config.telegram.botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN is required. Set it in .env file.');
    process.exit(1);
  }

  if (!config.masterWallet.privateKey) {
    console.error('❌ MASTER_WALLET_PRIVATE_KEY is required. Set it in .env file.');
    process.exit(1);
  }

  // Initialize services
  console.log('📡 Connecting to Solana RPC:', config.solana.rpcUrl);
  const solanaService = new SolanaService(config.solana.rpcUrl);

  // Load master wallet
  console.log('🔑 Loading master wallet...');
  const masterWallet = keypairFromBase58(config.masterWallet.privateKey);
  console.log('   Address:', masterWallet.publicKey.toBase58());

  // Check master wallet balance (non-blocking)
  try {
    const balance = await solanaService.getBalanceSol(masterWallet.publicKey);
    console.log('   Balance:', balance.toFixed(4), 'SOL\n');

    if (balance < 0.01) {
      console.warn('⚠️  Warning: Master wallet has low balance. Fund it before using the bot.\n');
    }
  } catch (error) {
    console.warn('⚠️  Could not fetch balance (RPC may be slow). Bot will still start.\n');
  }

  // Initialize Telegram bot
  console.log('🤖 Initializing Telegram bot...');
  const bot = new TelegramBot(
    config.telegram.botToken,
    solanaService,
    masterWallet,
    config.telegram.authorizedUsers
  );

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n⏹️  Shutting down...');
    await bot.stop();
    process.exit(0);
  });

  // Start bot
  console.log('✅ Bot is running! Send /start to the bot on Telegram.\n');
  console.log('Configuration:');
  console.log('   Max wallets:', config.bot.maxWallets);
  console.log('   Default buy amount:', config.bot.defaultBuyAmountSol, 'SOL');
  console.log('   Stealth funding:', config.stealthFunding.useIntermediateWallets ? 'Enabled' : 'Disabled');
  console.log('   Authorized users:', config.telegram.authorizedUsers.length || 'All (open access)');
  console.log('\nPress Ctrl+C to stop.\n');

  await bot.start();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
