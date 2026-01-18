import { Keypair } from '@solana/web3.js';
import { keypairToBase58, saveToJson } from '../utils/helpers';
import * as path from 'path';

const WALLET_COUNT = parseInt(process.argv[2] || '10');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'generated-wallets.json');

interface GeneratedWallet {
  index: number;
  publicKey: string;
  privateKey: string;
}

function main() {
  console.log(`\n🔑 Generating ${WALLET_COUNT} wallets...\n`);

  const wallets: GeneratedWallet[] = [];

  for (let i = 0; i < WALLET_COUNT; i++) {
    const keypair = Keypair.generate();
    const wallet: GeneratedWallet = {
      index: i,
      publicKey: keypair.publicKey.toBase58(),
      privateKey: keypairToBase58(keypair),
    };
    wallets.push(wallet);
    console.log(`${i + 1}. ${wallet.publicKey}`);
  }

  saveToJson(OUTPUT_FILE, wallets);

  console.log(`\n✅ Generated ${WALLET_COUNT} wallets`);
  console.log(`📁 Saved to: ${OUTPUT_FILE}`);
  console.log('\n⚠️  Keep this file secure! It contains private keys.\n');
}

main();
