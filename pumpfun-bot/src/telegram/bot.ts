import { Bot, Context, session, SessionFlavor, InlineKeyboard, Keyboard } from 'grammy';
import { PublicKey, Keypair } from '@solana/web3.js';
import { SolanaService } from '../services/solana';
import { JitoService } from '../services/jito';
import { WalletManager } from '../core/wallet-manager';
import { StealthFunder } from '../core/stealth-funder';
import { PumpFunBuyer } from '../core/pumpfun-buyer';
import { TelegramUserSession } from '../types';
import {
  keypairFromBase58,
  lamportsToSol,
  shortenAddress,
  isValidPublicKey,
} from '../utils/helpers';

// Session data interface
interface SessionData {
  step: string;
  data: Record<string, unknown>;
}

type BotContext = Context & SessionFlavor<SessionData>;

export class TelegramBot {
  private bot: Bot<BotContext>;
  private solanaService: SolanaService;
  private jitoService: JitoService;
  private walletManager: WalletManager;
  private stealthFunder: StealthFunder;
  private pumpFunBuyer: PumpFunBuyer;
  private masterWallet: Keypair;
  private authorizedUsers: Set<number>;

  constructor(
    token: string,
    solanaService: SolanaService,
    masterWallet: Keypair,
    authorizedUsers: number[] = []
  ) {
    this.bot = new Bot<BotContext>(token);
    this.solanaService = solanaService;
    this.jitoService = new JitoService(solanaService.getConnection());
    this.walletManager = new WalletManager(solanaService);
    this.stealthFunder = new StealthFunder(solanaService, this.walletManager);
    this.pumpFunBuyer = new PumpFunBuyer(solanaService, this.jitoService, this.walletManager);
    this.masterWallet = masterWallet;
    this.authorizedUsers = new Set(authorizedUsers);

    this.setupMiddleware();
    this.setupHandlers();
  }

  private setupMiddleware(): void {
    // Session middleware
    this.bot.use(
      session({
        initial: (): SessionData => ({
          step: '',
          data: {},
        }),
      })
    );

    // Auth middleware
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      // Allow if no users are authorized (open access) or user is in list
      if (this.authorizedUsers.size === 0 || this.authorizedUsers.has(userId)) {
        await next();
      } else {
        await ctx.reply('⛔ Unauthorized. Contact the admin to get access.');
      }
    });
  }

  private setupHandlers(): void {
    // Start command
    this.bot.command('start', async ctx => {
      const welcomeMessage = `
🚀 **PumpFun Bundle Buyer Bot**

Welcome! This bot helps you buy PumpFun tokens using multiple wallets in a bundle.

**Features:**
• Generate & manage multiple wallets
• Stealth funding (avoid Bubblemaps detection)
• Bundle buying via Jito
• Token info lookup

**Commands:**
/wallets - Manage wallets
/fund - Fund wallets (stealth mode)
/buy - Bundle buy tokens
/balance - Check balances
/settings - Bot settings
/help - Show this help

Use the buttons below to get started:
      `;

      const keyboard = new InlineKeyboard()
        .text('📊 Wallets', 'menu_wallets')
        .text('💰 Fund', 'menu_fund')
        .row()
        .text('🛒 Buy', 'menu_buy')
        .text('💵 Balance', 'menu_balance')
        .row()
        .text('ℹ️ Help', 'menu_help');

      await ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    });

    // Wallets command
    this.bot.command('wallets', async ctx => this.handleWalletsMenu(ctx));
    this.bot.callbackQuery('menu_wallets', async ctx => {
      await ctx.answerCallbackQuery();
      await this.handleWalletsMenu(ctx);
    });

    // Fund command
    this.bot.command('fund', async ctx => this.handleFundMenu(ctx));
    this.bot.callbackQuery('menu_fund', async ctx => {
      await ctx.answerCallbackQuery();
      await this.handleFundMenu(ctx);
    });

    // Buy command
    this.bot.command('buy', async ctx => this.handleBuyMenu(ctx));
    this.bot.callbackQuery('menu_buy', async ctx => {
      await ctx.answerCallbackQuery();
      await this.handleBuyMenu(ctx);
    });

    // Balance command
    this.bot.command('balance', async ctx => this.handleBalanceMenu(ctx));
    this.bot.callbackQuery('menu_balance', async ctx => {
      await ctx.answerCallbackQuery();
      await this.handleBalanceMenu(ctx);
    });

    // Help command
    this.bot.command('help', async ctx => this.handleHelp(ctx));
    this.bot.callbackQuery('menu_help', async ctx => {
      await ctx.answerCallbackQuery();
      await this.handleHelp(ctx);
    });

    // Callback query handlers
    this.setupCallbackHandlers();

    // Message handlers
    this.setupMessageHandlers();
  }

  private setupCallbackHandlers(): void {
    // Generate wallets
    this.bot.callbackQuery(/^gen_wallets_(\d+)$/, async ctx => {
      await ctx.answerCallbackQuery();
      const count = parseInt(ctx.match![1]);
      await this.generateWallets(ctx, count);
    });

    // Fund wallets
    this.bot.callbackQuery('fund_stealth', async ctx => {
      await ctx.answerCallbackQuery();
      ctx.session.step = 'fund_amount';
      ctx.session.data.fundMode = 'stealth';
      await ctx.reply('💰 Enter the total amount of SOL to distribute across wallets:');
    });

    this.bot.callbackQuery('fund_quick', async ctx => {
      await ctx.answerCallbackQuery();
      ctx.session.step = 'fund_amount';
      ctx.session.data.fundMode = 'quick';
      await ctx.reply('💰 Enter the amount of SOL per wallet:');
    });

    // Buy tokens
    this.bot.callbackQuery('buy_start', async ctx => {
      await ctx.answerCallbackQuery();
      ctx.session.step = 'buy_token';
      await ctx.reply('🪙 Enter the token mint address (CA):');
    });

    // Refresh balances
    this.bot.callbackQuery('refresh_balances', async ctx => {
      await ctx.answerCallbackQuery('Refreshing...');
      await this.refreshBalances(ctx);
    });

    // Export wallets
    this.bot.callbackQuery('export_wallets', async ctx => {
      await ctx.answerCallbackQuery();
      await this.exportWallets(ctx);
    });

    // Delete all wallets
    this.bot.callbackQuery('delete_all_wallets', async ctx => {
      await ctx.answerCallbackQuery();
      const keyboard = new InlineKeyboard()
        .text('✅ Yes, delete all', 'confirm_delete_all')
        .text('❌ Cancel', 'cancel_action');
      await ctx.reply('⚠️ Are you sure you want to delete ALL wallets? This cannot be undone!', {
        reply_markup: keyboard,
      });
    });

    this.bot.callbackQuery('confirm_delete_all', async ctx => {
      await ctx.answerCallbackQuery();
      this.walletManager.deleteAllWallets();
      await ctx.reply('🗑️ All wallets have been deleted.');
    });

    this.bot.callbackQuery('cancel_action', async ctx => {
      await ctx.answerCallbackQuery('Cancelled');
      ctx.session.step = '';
      ctx.session.data = {};
      await ctx.reply('Action cancelled.');
    });

    // Collect funds
    this.bot.callbackQuery('collect_funds', async ctx => {
      await ctx.answerCallbackQuery();
      await this.collectFunds(ctx);
    });
  }

  private setupMessageHandlers(): void {
    this.bot.on('message:text', async ctx => {
      const text = ctx.message.text;
      const step = ctx.session.step;

      switch (step) {
        case 'fund_amount':
          await this.handleFundAmount(ctx, text);
          break;
        case 'buy_token':
          await this.handleBuyToken(ctx, text);
          break;
        case 'buy_amount':
          await this.handleBuyAmount(ctx, text);
          break;
        case 'buy_wallets':
          await this.handleBuyWallets(ctx, text);
          break;
        default:
          // Check if it's a token address
          if (isValidPublicKey(text) && text.length > 30) {
            await this.lookupToken(ctx, text);
          }
      }
    });
  }

  private async handleWalletsMenu(ctx: BotContext): Promise<void> {
    const summary = this.walletManager.getWalletSummary();

    const keyboard = new InlineKeyboard()
      .text('➕ Generate 5', 'gen_wallets_5')
      .text('➕ Generate 10', 'gen_wallets_10')
      .row()
      .text('➕ Generate 20', 'gen_wallets_20')
      .text('🔄 Refresh', 'refresh_balances')
      .row()
      .text('📤 Export', 'export_wallets')
      .text('🗑️ Delete All', 'delete_all_wallets');

    await ctx.reply(summary, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async handleFundMenu(ctx: BotContext): Promise<void> {
    const masterBalance = await this.solanaService.getBalanceSol(this.masterWallet.publicKey);
    const counts = this.walletManager.getWalletCount();

    const message = `
💰 **Fund Wallets**

Master Wallet: \`${shortenAddress(this.masterWallet.publicKey.toBase58())}\`
Master Balance: ${masterBalance.toFixed(4)} SOL

Wallets to fund: ${counts.unfunded} unfunded

**Funding Modes:**
🔒 **Stealth** - Uses intermediate wallets & delays to avoid Bubblemaps detection
⚡ **Quick** - Direct transfers (faster but wallets may appear connected)
    `;

    const keyboard = new InlineKeyboard()
      .text('🔒 Stealth Fund', 'fund_stealth')
      .text('⚡ Quick Fund', 'fund_quick')
      .row()
      .text('💸 Collect Back', 'collect_funds');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async handleBuyMenu(ctx: BotContext): Promise<void> {
    const fundedCount = this.walletManager.getWalletCount().funded;

    const message = `
🛒 **Bundle Buy**

Funded wallets available: ${fundedCount}

Send a token mint address to look up info, or click below to start a bundle buy.

**How it works:**
1. Enter token mint address
2. Enter total SOL amount
3. Select number of wallets
4. Confirm and execute bundle via Jito
    `;

    const keyboard = new InlineKeyboard()
      .text('🚀 Start Bundle Buy', 'buy_start');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async handleBalanceMenu(ctx: BotContext): Promise<void> {
    await ctx.reply('🔄 Fetching balances...');
    await this.refreshBalances(ctx);
  }

  private async handleHelp(ctx: BotContext): Promise<void> {
    const helpMessage = `
📖 **PumpFun Bundle Bot Help**

**Wallet Management:**
• Generate multiple wallets for bundle buying
• Wallets are stored securely and persist between sessions
• Export wallet keys anytime

**Stealth Funding:**
To avoid detection on Bubblemaps:
• Uses intermediate wallets
• Random delays between transfers
• Randomized amounts
• Multiple funding paths

**Bundle Buying:**
• Executes buys from multiple wallets in one Jito bundle
• All transactions land in the same block
• Higher success rate for sniping

**Tips:**
• Fund wallets before buying
• Use stealth funding for better opsec
• Higher Jito tips = faster landing

**Commands:**
\`/start\` - Main menu
\`/wallets\` - Manage wallets
\`/fund\` - Fund wallets
\`/buy\` - Bundle buy
\`/balance\` - Check balances
    `;

    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  }

  private async generateWallets(ctx: BotContext, count: number): Promise<void> {
    await ctx.reply(`⏳ Generating ${count} wallets...`);

    const wallets = this.walletManager.generateWallets(count);

    const addresses = wallets
      .slice(0, 5)
      .map((w, i) => `${i + 1}. \`${w.info.publicKey}\``)
      .join('\n');

    let message = `✅ Generated ${count} new wallets!\n\n${addresses}`;
    if (count > 5) {
      message += `\n... and ${count - 5} more`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  private async handleFundAmount(ctx: BotContext, text: string): Promise<void> {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Invalid amount. Please enter a positive number.');
      return;
    }

    ctx.session.data.fundAmount = amount;
    ctx.session.step = 'fund_confirm';

    const mode = ctx.session.data.fundMode as string;
    const unfundedWallets = this.walletManager.getUnfundedWallets();

    if (unfundedWallets.length === 0) {
      await ctx.reply('❌ No unfunded wallets. Generate some wallets first!');
      ctx.session.step = '';
      return;
    }

    const perWallet = mode === 'stealth' ? amount / unfundedWallets.length : amount;

    const keyboard = new InlineKeyboard()
      .text('✅ Confirm', 'confirm_fund')
      .text('❌ Cancel', 'cancel_action');

    await ctx.reply(
      `📋 **Funding Summary**\n\n` +
        `Mode: ${mode === 'stealth' ? '🔒 Stealth' : '⚡ Quick'}\n` +
        `Wallets to fund: ${unfundedWallets.length}\n` +
        `Amount per wallet: ~${perWallet.toFixed(4)} SOL\n` +
        `Total: ${(perWallet * unfundedWallets.length).toFixed(4)} SOL\n\n` +
        `Confirm to proceed?`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );

    // Set up confirm handler
    this.bot.callbackQuery('confirm_fund', async confirmCtx => {
      await confirmCtx.answerCallbackQuery();
      await this.executeFunding(confirmCtx);
    });
  }

  private async executeFunding(ctx: BotContext): Promise<void> {
    const mode = ctx.session.data.fundMode as string;
    const amount = ctx.session.data.fundAmount as number;
    const unfundedWallets = this.walletManager.getUnfundedWallets();

    ctx.session.step = '';
    ctx.session.data = {};

    await ctx.reply('⏳ Starting funding process...');

    try {
      if (mode === 'stealth') {
        const result = await this.stealthFunder.fundWallets(
          this.masterWallet,
          unfundedWallets,
          amount,
          async (current, total, wallet) => {
            if (current % 3 === 0 || current === total) {
              await ctx.reply(`📤 Progress: ${current}/${total} - ${shortenAddress(wallet)}`);
            }
          }
        );

        await ctx.reply(
          `✅ **Stealth Funding Complete**\n\n` +
            `Funded: ${result.funded}/${unfundedWallets.length} wallets\n` +
            `Transactions: ${result.signatures.length}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        const perWallet = amount;
        const result = await this.stealthFunder.quickFund(
          this.masterWallet,
          unfundedWallets,
          perWallet
        );

        await ctx.reply(
          `✅ **Quick Funding Complete**\n\n` +
            `Funded: ${result.funded}/${unfundedWallets.length} wallets`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      await ctx.reply(`❌ Funding failed: ${error}`);
    }
  }

  private async handleBuyToken(ctx: BotContext, text: string): Promise<void> {
    if (!isValidPublicKey(text)) {
      await ctx.reply('❌ Invalid token address. Please enter a valid Solana address.');
      return;
    }

    ctx.session.data.tokenMint = text;
    ctx.session.step = 'buy_amount';

    // Try to get token info
    const tokenInfo = await this.pumpFunBuyer.getTokenInfo(new PublicKey(text));
    if (tokenInfo) {
      await ctx.reply(
        `🪙 **Token Found**\n\n` +
          `Name: ${tokenInfo.name}\n` +
          `Symbol: ${tokenInfo.symbol}\n` +
          `Mint: \`${text}\`\n\n` +
          `Enter the total SOL amount to spend:`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply('Enter the total SOL amount to spend across all wallets:');
    }
  }

  private async handleBuyAmount(ctx: BotContext, text: string): Promise<void> {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Invalid amount. Please enter a positive number.');
      return;
    }

    ctx.session.data.buyAmount = amount;
    ctx.session.step = 'buy_wallets';

    const fundedCount = this.walletManager.getWalletCount().funded;

    const keyboard = new InlineKeyboard()
      .text('5 wallets', 'buy_wallets_5')
      .text('10 wallets', 'buy_wallets_10')
      .row()
      .text('15 wallets', 'buy_wallets_15')
      .text('20 wallets', 'buy_wallets_20');

    await ctx.reply(
      `How many wallets to use? (${fundedCount} available)\n\n` +
        `Total: ${amount} SOL\n` +
        `Select or enter a custom number:`,
      { reply_markup: keyboard }
    );

    // Handle quick selections
    ['5', '10', '15', '20'].forEach(num => {
      this.bot.callbackQuery(`buy_wallets_${num}`, async cbCtx => {
        await cbCtx.answerCallbackQuery();
        await this.handleBuyWallets(cbCtx, num);
      });
    });
  }

  private async handleBuyWallets(ctx: BotContext, text: string): Promise<void> {
    const walletCount = parseInt(text);
    const fundedCount = this.walletManager.getWalletCount().funded;

    if (isNaN(walletCount) || walletCount <= 0) {
      await ctx.reply('❌ Invalid number. Please enter a positive integer.');
      return;
    }

    if (walletCount > fundedCount) {
      await ctx.reply(`❌ Not enough funded wallets. You have ${fundedCount}, requested ${walletCount}.`);
      return;
    }

    const tokenMint = ctx.session.data.tokenMint as string;
    const totalAmount = ctx.session.data.buyAmount as number;
    const perWallet = totalAmount / walletCount;

    ctx.session.step = '';

    const keyboard = new InlineKeyboard()
      .text('🚀 Execute Bundle', 'execute_bundle')
      .text('❌ Cancel', 'cancel_action');

    await ctx.reply(
      `📋 **Bundle Buy Summary**\n\n` +
        `Token: \`${tokenMint}\`\n` +
        `Total: ${totalAmount} SOL\n` +
        `Wallets: ${walletCount}\n` +
        `Per wallet: ${perWallet.toFixed(4)} SOL\n` +
        `Jito tip: 0.001 SOL\n\n` +
        `Ready to execute?`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );

    ctx.session.data.walletCount = walletCount;

    // Handle execute
    this.bot.callbackQuery('execute_bundle', async execCtx => {
      await execCtx.answerCallbackQuery();
      await this.executeBundleBuy(execCtx);
    });
  }

  private async executeBundleBuy(ctx: BotContext): Promise<void> {
    const tokenMint = ctx.session.data.tokenMint as string;
    const totalAmount = ctx.session.data.buyAmount as number;
    const walletCount = ctx.session.data.walletCount as number;

    ctx.session.step = '';
    ctx.session.data = {};

    await ctx.reply('⏳ Executing bundle buy...');

    try {
      const result = await this.pumpFunBuyer.executeBundleBuy({
        mint: new PublicKey(tokenMint),
        totalSolAmount: totalAmount,
        walletCount,
        slippageBps: 500,
        jitoTipAmount: 0.001,
      });

      if (result.success) {
        await ctx.reply(
          `✅ **Bundle Buy Successful!**\n\n` +
            `Bundle ID: \`${result.bundleId}\`\n` +
            `Transactions: ${result.signatures?.length || walletCount}\n\n` +
            `Check Solscan for details.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(`❌ Bundle failed: ${result.error}`);
      }
    } catch (error) {
      await ctx.reply(`❌ Error: ${error}`);
    }
  }

  private async refreshBalances(ctx: BotContext): Promise<void> {
    try {
      const masterBalance = await this.solanaService.getBalanceSol(this.masterWallet.publicKey);
      await this.walletManager.updateAllBalances();

      const summary = this.walletManager.getWalletSummary();
      await ctx.reply(
        `💵 **Master Wallet:** ${masterBalance.toFixed(4)} SOL\n\n${summary}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await ctx.reply(`❌ Error refreshing balances: ${error}`);
    }
  }

  private async exportWallets(ctx: BotContext): Promise<void> {
    const wallets = this.walletManager.getAllWallets();
    if (wallets.length === 0) {
      await ctx.reply('No wallets to export.');
      return;
    }

    const exportData = this.walletManager.exportWallets();

    // Send as document
    await ctx.replyWithDocument({
      source: Buffer.from(exportData),
      filename: 'wallets.json',
    });

    await ctx.reply('⚠️ Keep this file secure! It contains private keys.');
  }

  private async collectFunds(ctx: BotContext): Promise<void> {
    const fundedWallets = this.walletManager.getFundedWallets();
    if (fundedWallets.length === 0) {
      await ctx.reply('No funded wallets to collect from.');
      return;
    }

    await ctx.reply(`⏳ Collecting funds from ${fundedWallets.length} wallets...`);

    try {
      const result = await this.stealthFunder.collectFunds(
        fundedWallets,
        this.masterWallet.publicKey
      );

      await ctx.reply(
        `✅ **Collection Complete**\n\n` +
          `Collected from: ${result.collected} wallets\n` +
          `Total: ${lamportsToSol(result.totalAmount).toFixed(4)} SOL`,
        { parse_mode: 'Markdown' }
      );

      // Refresh balances
      await this.walletManager.updateAllBalances();
    } catch (error) {
      await ctx.reply(`❌ Error collecting funds: ${error}`);
    }
  }

  private async lookupToken(ctx: BotContext, mint: string): Promise<void> {
    await ctx.reply('🔍 Looking up token...');

    try {
      const tokenInfo = await this.pumpFunBuyer.getTokenInfo(new PublicKey(mint));

      if (tokenInfo) {
        const message = `
🪙 **${tokenInfo.name}** (${tokenInfo.symbol})

Mint: \`${mint}\`
Creator: \`${shortenAddress(tokenInfo.creator)}\`
Bonding Curve: \`${shortenAddress(tokenInfo.bondingCurve)}\`

Status: ${tokenInfo.complete ? '✅ Completed' : '🟡 Active'}
        `;

        const keyboard = new InlineKeyboard().text('🛒 Buy This Token', 'buy_start');

        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });

        ctx.session.data.tokenMint = mint;
      } else {
        await ctx.reply('❌ Token not found on PumpFun or may not be a PumpFun token.');
      }
    } catch (error) {
      await ctx.reply(`❌ Error looking up token: ${error}`);
    }
  }

  async start(): Promise<void> {
    console.log('🤖 Starting Telegram bot...');
    await this.bot.start();
  }

  async stop(): Promise<void> {
    await this.bot.stop();
  }
}
