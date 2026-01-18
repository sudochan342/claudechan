import { Bot, Context, session, SessionFlavor, InlineKeyboard, InputFile } from 'grammy';
import { PublicKey, Keypair } from '@solana/web3.js';
import { SolanaService } from '../services/solana';
import { WalletManager } from '../core/wallet-manager';
import { StealthFunder } from '../core/stealth-funder';
import { PumpFunBuyer } from '../core/pumpfun-buyer';
import { TokenManager } from '../core/token-manager';
import {
  keypairFromBase58,
  lamportsToSol,
  shortenAddress,
  isValidPublicKey,
} from '../utils/helpers';

interface SessionData {
  step: string;
  data: Record<string, unknown>;
}

type BotContext = Context & SessionFlavor<SessionData>;

export class TelegramBot {
  private bot: Bot<BotContext>;
  private solanaService: SolanaService;
  private walletManager: WalletManager;
  private stealthFunder: StealthFunder;
  private pumpFunBuyer: PumpFunBuyer;
  private tokenManager: TokenManager;
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
    this.walletManager = new WalletManager(solanaService);
    this.stealthFunder = new StealthFunder(solanaService, this.walletManager);
    this.pumpFunBuyer = new PumpFunBuyer(solanaService, this.walletManager);
    this.tokenManager = new TokenManager(solanaService);
    this.masterWallet = masterWallet;
    this.authorizedUsers = new Set(authorizedUsers);

    this.setupMiddleware();
    this.setupHandlers();
  }

  private setupMiddleware(): void {
    this.bot.use(
      session({
        initial: (): SessionData => ({ step: '', data: {} }),
      })
    );

    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId) return;
      if (this.authorizedUsers.size === 0 || this.authorizedUsers.has(userId)) {
        await next();
      } else {
        await ctx.reply('Unauthorized');
      }
    });
  }

  private setupHandlers(): void {
    // Main menu
    this.bot.command('start', ctx => this.showDashboard(ctx));
    this.bot.command('menu', ctx => this.showDashboard(ctx));

    // Quick commands
    this.bot.command('wallets', ctx => this.showWallets(ctx));
    this.bot.command('buy', ctx => this.showBuyMenu(ctx));
    this.bot.command('sell', ctx => this.showSellMenu(ctx));
    this.bot.command('fund', ctx => this.showFundMenu(ctx));
    this.bot.command('status', ctx => this.showStatus(ctx));

    // Callback handlers
    this.setupCallbacks();

    // Text handler
    this.bot.on('message:text', ctx => this.handleText(ctx));
  }

  private setupCallbacks(): void {
    // Dashboard
    this.bot.callbackQuery('dashboard', ctx => { ctx.answerCallbackQuery(); this.showDashboard(ctx); });

    // Wallets
    this.bot.callbackQuery('wallets', ctx => { ctx.answerCallbackQuery(); this.showWallets(ctx); });
    this.bot.callbackQuery(/^gen_(\d+)$/, async ctx => {
      await ctx.answerCallbackQuery();
      const count = parseInt(ctx.match![1]);
      await this.generateWallets(ctx, count);
    });
    this.bot.callbackQuery('export_keys', ctx => { ctx.answerCallbackQuery(); this.exportWallets(ctx); });
    this.bot.callbackQuery('refresh_bal', ctx => { ctx.answerCallbackQuery(); this.refreshBalances(ctx); });
    this.bot.callbackQuery('delete_wallets', ctx => { ctx.answerCallbackQuery(); this.confirmDeleteWallets(ctx); });
    this.bot.callbackQuery('confirm_delete', ctx => { ctx.answerCallbackQuery(); this.deleteAllWallets(ctx); });

    // Funding
    this.bot.callbackQuery('fund_menu', ctx => { ctx.answerCallbackQuery(); this.showFundMenu(ctx); });
    this.bot.callbackQuery('fund_cex', ctx => {
      ctx.answerCallbackQuery();
      ctx.session.step = 'fund_amount';
      ctx.session.data.mode = 'cex';
      ctx.reply('Enter total SOL amount to distribute:');
    });
    this.bot.callbackQuery('fund_quick', ctx => {
      ctx.answerCallbackQuery();
      ctx.session.step = 'fund_amount';
      ctx.session.data.mode = 'quick';
      ctx.reply('Enter SOL amount per wallet:');
    });
    this.bot.callbackQuery('collect_all', ctx => { ctx.answerCallbackQuery(); this.collectFunds(ctx); });

    // Buy
    this.bot.callbackQuery('buy_menu', ctx => { ctx.answerCallbackQuery(); this.showBuyMenu(ctx); });
    this.bot.callbackQuery('buy_start', ctx => {
      ctx.answerCallbackQuery();
      ctx.session.step = 'buy_token';
      ctx.reply('Enter token address (CA):');
    });
    this.bot.callbackQuery(/^buy_wallets_(\d+)$/, async ctx => {
      await ctx.answerCallbackQuery();
      ctx.session.data.walletCount = parseInt(ctx.match![1]);
      await this.confirmBuy(ctx);
    });
    this.bot.callbackQuery('confirm_buy', ctx => { ctx.answerCallbackQuery(); this.executeBuy(ctx); });

    // Sell
    this.bot.callbackQuery('sell_menu', ctx => { ctx.answerCallbackQuery(); this.showSellMenu(ctx); });
    this.bot.callbackQuery('sell_all', ctx => { ctx.answerCallbackQuery(); this.executeSellAll(ctx); });
    this.bot.callbackQuery('sell_50', ctx => { ctx.answerCallbackQuery(); this.executeSellPercent(ctx, 50); });
    this.bot.callbackQuery('sell_25', ctx => { ctx.answerCallbackQuery(); this.executeSellPercent(ctx, 25); });

    // Token Management
    this.bot.callbackQuery('token_menu', ctx => { ctx.answerCallbackQuery(); this.showTokenMenu(ctx); });
    this.bot.callbackQuery('burn_lp', ctx => {
      ctx.answerCallbackQuery();
      ctx.session.step = 'burn_lp_mint';
      ctx.reply('Enter LP token mint address:');
    });
    this.bot.callbackQuery('edit_meta', ctx => {
      ctx.answerCallbackQuery();
      ctx.session.step = 'edit_meta_mint';
      ctx.reply('Enter token mint address to edit:');
    });
    this.bot.callbackQuery('revoke_mint', ctx => {
      ctx.answerCallbackQuery();
      ctx.session.step = 'revoke_mint_address';
      ctx.reply('Enter token mint address:');
    });

    // Cancel
    this.bot.callbackQuery('cancel', ctx => {
      ctx.answerCallbackQuery();
      ctx.session.step = '';
      ctx.session.data = {};
      ctx.reply('Cancelled.');
    });
  }

  // ==================== DASHBOARD ====================
  private async showDashboard(ctx: BotContext): Promise<void> {
    const masterBal = await this.solanaService.getBalanceSol(this.masterWallet.publicKey);
    const walletCounts = this.walletManager.getWalletCount();
    const totalBal = lamportsToSol(this.walletManager.getTotalBalance());
    const holdings = this.pumpFunBuyer.getHoldingsState();

    let msg = `
**PUMPFUN BOT**

**Master Wallet**
\`${shortenAddress(this.masterWallet.publicKey.toBase58(), 6)}\`
Balance: ${masterBal.toFixed(4)} SOL

**Sub Wallets**
Total: ${walletCounts.total} | Funded: ${walletCounts.funded}
Combined Balance: ${totalBal.toFixed(4)} SOL
`;

    if (holdings.token) {
      msg += `
**Current Holdings**
Token: \`${shortenAddress(holdings.token, 6)}\`
Wallets: ${holdings.totalWallets}
Invested: ${holdings.totalSolSpent.toFixed(4)} SOL
`;
    }

    const kb = new InlineKeyboard()
      .text('Wallets', 'wallets').text('Fund', 'fund_menu').row()
      .text('Buy', 'buy_menu').text('Sell', 'sell_menu').row()
      .text('Token Tools', 'token_menu').text('Refresh', 'dashboard');

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
  }

  // ==================== WALLETS ====================
  private async showWallets(ctx: BotContext): Promise<void> {
    await this.walletManager.updateAllBalances();
    const wallets = this.walletManager.getAllWallets();
    const counts = this.walletManager.getWalletCount();

    let msg = `**WALLETS** (${counts.total})\n\n`;

    if (wallets.length > 0) {
      const display = wallets.slice(0, 10);
      display.forEach((w, i) => {
        const bal = lamportsToSol(w.info.balance).toFixed(4);
        const status = w.info.funded ? '' : '';
        msg += `${i + 1}. \`${shortenAddress(w.info.publicKey, 4)}\` ${bal} SOL ${status}\n`;
      });
      if (wallets.length > 10) {
        msg += `\n_...and ${wallets.length - 10} more_`;
      }
    } else {
      msg += '_No wallets yet. Generate some!_';
    }

    const kb = new InlineKeyboard()
      .text('+5', 'gen_5').text('+10', 'gen_10').text('+20', 'gen_20').row()
      .text('Refresh', 'refresh_bal').text('Export', 'export_keys').row()
      .text('Delete All', 'delete_wallets').text('Back', 'dashboard');

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
  }

  private async generateWallets(ctx: BotContext, count: number): Promise<void> {
    const wallets = this.walletManager.generateWallets(count);
    const addresses = wallets.slice(0, 3).map(w => `\`${shortenAddress(w.info.publicKey, 6)}\``).join('\n');
    await ctx.reply(`Generated ${count} wallets\n\n${addresses}${count > 3 ? '\n...' : ''}`, { parse_mode: 'Markdown' });
  }

  private async exportWallets(ctx: BotContext): Promise<void> {
    const data = this.walletManager.exportWallets();
    await ctx.replyWithDocument(new InputFile(Buffer.from(data), 'wallets.json'));
    await ctx.reply('Keep this file secure!');
  }

  private async refreshBalances(ctx: BotContext): Promise<void> {
    await ctx.reply('Refreshing...');
    await this.walletManager.updateAllBalances();
    await this.showWallets(ctx);
  }

  private async confirmDeleteWallets(ctx: BotContext): Promise<void> {
    const kb = new InlineKeyboard()
      .text('Yes, Delete All', 'confirm_delete')
      .text('Cancel', 'wallets');
    await ctx.reply('Delete ALL wallets? This cannot be undone!', { reply_markup: kb });
  }

  private async deleteAllWallets(ctx: BotContext): Promise<void> {
    this.walletManager.deleteAllWallets();
    await ctx.reply('All wallets deleted.');
  }

  // ==================== FUNDING ====================
  private async showFundMenu(ctx: BotContext): Promise<void> {
    const masterBal = await this.solanaService.getBalanceSol(this.masterWallet.publicKey);
    const unfunded = this.walletManager.getWalletCount().unfunded;

    const msg = `
**FUND WALLETS**

Master Balance: ${masterBal.toFixed(4)} SOL
Unfunded Wallets: ${unfunded}

**CEX Style** - Mimics exchange withdrawals
- Hot wallet pool
- Random amounts & timing
- Multiple hops
- Anti-Bubblemaps

**Quick** - Direct transfers (detectable)
`;

    const kb = new InlineKeyboard()
      .text('CEX Style (Stealth)', 'fund_cex').row()
      .text('Quick (Not Stealth)', 'fund_quick').row()
      .text('Collect All Back', 'collect_all').row()
      .text('Back', 'dashboard');

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
  }

  private async executeFunding(ctx: BotContext): Promise<void> {
    const mode = ctx.session.data.mode as string;
    const amount = ctx.session.data.amount as number;
    const unfunded = this.walletManager.getUnfundedWallets();

    ctx.session.step = '';
    ctx.session.data = {};

    if (unfunded.length === 0) {
      await ctx.reply('No unfunded wallets!');
      return;
    }

    await ctx.reply(`Starting ${mode === 'cex' ? 'CEX-style stealth' : 'quick'} funding...`);

    try {
      if (mode === 'cex') {
        const result = await this.stealthFunder.fundWalletsCEXStyle(
          this.masterWallet,
          unfunded,
          amount,
          async (curr, total, wallet, eta) => {
            if (curr % 3 === 0 || curr === total) {
              await ctx.reply(`[${curr}/${total}] ${shortenAddress(wallet, 4)} (ETA: ${eta})`);
            }
          }
        );
        await ctx.reply(`Funded ${result.funded}/${unfunded.length} wallets`);
      } else {
        const perWallet = amount;
        const result = await this.stealthFunder.quickFund(this.masterWallet, unfunded, perWallet);
        await ctx.reply(`Funded ${result.funded}/${unfunded.length} wallets`);
      }
    } catch (err) {
      await ctx.reply(`Error: ${err}`);
    }
  }

  private async collectFunds(ctx: BotContext): Promise<void> {
    const funded = this.walletManager.getFundedWallets();
    if (funded.length === 0) {
      await ctx.reply('No funded wallets to collect from.');
      return;
    }

    await ctx.reply(`Collecting from ${funded.length} wallets...`);

    const result = await this.stealthFunder.collectFunds(funded, this.masterWallet.publicKey);
    await ctx.reply(`Collected ${lamportsToSol(result.totalAmount).toFixed(4)} SOL from ${result.collected} wallets`);
  }

  // ==================== BUY ====================
  private async showBuyMenu(ctx: BotContext): Promise<void> {
    const funded = this.walletManager.getWalletCount().funded;
    const holdings = this.pumpFunBuyer.getHoldingsState();

    let msg = `
**BUY TOKENS**

Funded Wallets: ${funded}
`;

    if (holdings.token) {
      msg += `
Current Holdings:
Token: \`${shortenAddress(holdings.token, 6)}\`
Invested: ${holdings.totalSolSpent.toFixed(4)} SOL
`;
    }

    msg += `
Spread buy mode - buys from each wallet with delays to avoid magic node detection.
`;

    const kb = new InlineKeyboard()
      .text('Start Buy', 'buy_start').row()
      .text('Back', 'dashboard');

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
  }

  private async confirmBuy(ctx: BotContext): Promise<void> {
    const token = ctx.session.data.token as string;
    const amount = ctx.session.data.amount as number;
    const wallets = ctx.session.data.walletCount as number;
    const perWallet = amount / wallets;

    const msg = `
**CONFIRM BUY**

Token: \`${token}\`
Total: ${amount} SOL
Wallets: ${wallets}
Per Wallet: ~${perWallet.toFixed(4)} SOL

Spread mode with 3-10s delays between buys.
`;

    const kb = new InlineKeyboard()
      .text('Execute Buy', 'confirm_buy')
      .text('Cancel', 'cancel');

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
  }

  private async executeBuy(ctx: BotContext): Promise<void> {
    const token = ctx.session.data.token as string;
    const amount = ctx.session.data.amount as number;
    const walletCount = ctx.session.data.walletCount as number;

    ctx.session.step = '';
    ctx.session.data = {};

    const wallets = this.walletManager.getRandomWallets(walletCount, true);

    if (wallets.length < walletCount) {
      await ctx.reply(`Not enough funded wallets. Have ${wallets.length}, need ${walletCount}`);
      return;
    }

    await ctx.reply('Executing spread buy...');

    const result = await this.pumpFunBuyer.executeSpreadBuy(
      new PublicKey(token),
      wallets,
      amount,
      500, // 5% slippage
      3000,
      10000,
      async (curr, total, wallet, status) => {
        if (curr % 3 === 0 || curr === total) {
          await ctx.reply(`[${curr}/${total}] ${shortenAddress(wallet, 4)} - ${status}`);
        }
      }
    );

    await ctx.reply(`Buy complete! ${result.signatures?.length || 0} successful`);
    await this.showSellMenu(ctx);
  }

  // ==================== SELL ====================
  private async showSellMenu(ctx: BotContext): Promise<void> {
    const holdings = this.pumpFunBuyer.getHoldingsState();

    if (!holdings.token) {
      await ctx.reply('No current holdings to sell.', {
        reply_markup: new InlineKeyboard().text('Back', 'dashboard'),
      });
      return;
    }

    const msg = `
**SELL**

Token: \`${shortenAddress(holdings.token, 6)}\`
Wallets Holding: ${holdings.totalWallets}
Total Invested: ${holdings.totalSolSpent.toFixed(4)} SOL
`;

    const kb = new InlineKeyboard()
      .text('SELL ALL', 'sell_all').row()
      .text('Sell 50%', 'sell_50').text('Sell 25%', 'sell_25').row()
      .text('Back', 'dashboard');

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
  }

  private async executeSellAll(ctx: BotContext): Promise<void> {
    const holdings = this.pumpFunBuyer.getHoldingsState();
    if (!holdings.token) {
      await ctx.reply('Nothing to sell');
      return;
    }

    await ctx.reply('Selling all positions...');

    const result = await this.pumpFunBuyer.sellAll(
      new PublicKey(holdings.token),
      1000,
      async (curr, total, wallet, status) => {
        if (curr % 3 === 0 || curr === total) {
          await ctx.reply(`[${curr}/${total}] ${shortenAddress(wallet, 4)} - ${status}`);
        }
      }
    );

    await ctx.reply(`Sold from ${result.walletsold} wallets\nReceived: ${result.totalSolReceived.toFixed(4)} SOL`);
  }

  private async executeSellPercent(ctx: BotContext, percent: number): Promise<void> {
    await ctx.reply(`Selling ${percent}% not yet implemented. Use Sell All.`);
  }

  // ==================== TOKEN TOOLS ====================
  private async showTokenMenu(ctx: BotContext): Promise<void> {
    const msg = `
**TOKEN TOOLS**

Burn LP - Burn LP tokens (after graduation)
Edit Metadata - Change name/symbol/image
Revoke Authorities - Remove mint/freeze auth
`;

    const kb = new InlineKeyboard()
      .text('Burn LP', 'burn_lp').row()
      .text('Edit Metadata', 'edit_meta').row()
      .text('Revoke Mint Auth', 'revoke_mint').row()
      .text('Back', 'dashboard');

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
  }

  // ==================== STATUS ====================
  private async showStatus(ctx: BotContext): Promise<void> {
    await this.showDashboard(ctx);
  }

  // ==================== TEXT HANDLER ====================
  private async handleText(ctx: BotContext): Promise<void> {
    const text = ctx.message?.text || '';
    const step = ctx.session.step;

    switch (step) {
      case 'fund_amount':
        const fundAmt = parseFloat(text);
        if (isNaN(fundAmt) || fundAmt <= 0) {
          await ctx.reply('Invalid amount');
          return;
        }
        ctx.session.data.amount = fundAmt;
        ctx.session.step = '';
        await this.executeFunding(ctx);
        break;

      case 'buy_token':
        if (!isValidPublicKey(text)) {
          await ctx.reply('Invalid address');
          return;
        }
        ctx.session.data.token = text;
        ctx.session.step = 'buy_amount';

        // Try to get token info
        const info = await this.pumpFunBuyer.getTokenInfo(new PublicKey(text));
        if (info) {
          await ctx.reply(`Token: ${info.name} (${info.symbol})\n\nEnter total SOL amount:`);
        } else {
          await ctx.reply('Enter total SOL amount:');
        }
        break;

      case 'buy_amount':
        const buyAmt = parseFloat(text);
        if (isNaN(buyAmt) || buyAmt <= 0) {
          await ctx.reply('Invalid amount');
          return;
        }
        ctx.session.data.amount = buyAmt;
        ctx.session.step = '';

        const funded = this.walletManager.getWalletCount().funded;
        const kb = new InlineKeyboard()
          .text('5', 'buy_wallets_5').text('10', 'buy_wallets_10').row()
          .text('15', 'buy_wallets_15').text('20', 'buy_wallets_20').row()
          .text('Cancel', 'cancel');
        await ctx.reply(`Select wallet count (${funded} available):`, { reply_markup: kb });
        break;

      case 'burn_lp_mint':
        if (!isValidPublicKey(text)) {
          await ctx.reply('Invalid address');
          return;
        }
        ctx.session.step = '';
        await ctx.reply('Burning LP tokens...');
        const burnResult = await this.tokenManager.burnLPTokens(this.masterWallet, new PublicKey(text));
        await ctx.reply(burnResult.success ? `Burned! ${burnResult.signature}` : `Failed: ${burnResult.error}`);
        break;

      case 'revoke_mint_address':
        if (!isValidPublicKey(text)) {
          await ctx.reply('Invalid address');
          return;
        }
        ctx.session.step = '';
        await ctx.reply('Revoking mint authority...');
        const revokeResult = await this.tokenManager.revokeMintAuthority(this.masterWallet, new PublicKey(text));
        await ctx.reply(revokeResult.success ? `Revoked! ${revokeResult.signature}` : `Failed: ${revokeResult.error}`);
        break;

      default:
        // Check if it's a token address
        if (isValidPublicKey(text) && text.length > 30) {
          const tokenInfo = await this.pumpFunBuyer.getTokenInfo(new PublicKey(text));
          if (tokenInfo) {
            const kb = new InlineKeyboard().text('Buy This Token', 'buy_start');
            await ctx.reply(
              `**${tokenInfo.name}** (${tokenInfo.symbol})\n\`${text}\``,
              { parse_mode: 'Markdown', reply_markup: kb }
            );
            ctx.session.data.token = text;
          } else {
            await ctx.reply('Token not found on PumpFun');
          }
        }
    }
  }

  async start(): Promise<void> {
    console.log('Bot starting...');
    await this.bot.start();
  }

  async stop(): Promise<void> {
    await this.bot.stop();
  }
}
