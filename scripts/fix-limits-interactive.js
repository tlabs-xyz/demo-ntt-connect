#!/usr/bin/env node

/**
 * Interactive script to fix inbound limits
 * Prompts for private key if not set in environment
 */

const readline = require('readline');
const { updateLimitsViaPeer } = require('./update-limits-setpeer.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log('🔧 NTT Manager Inbound Limit Fixer');
  console.log('==================================');
  
  if (!process.env.OWNER_PRIVATE_KEY) {
    console.log('\n🔑 Private key not found in environment.');
    console.log('Please enter your private key (starts with 0x):');
    
    const privateKey = await new Promise((resolve) => {
      rl.question('Private Key: ', (answer) => {
        resolve(answer.trim());
      });
    });
    
    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      console.log('❌ Invalid private key format. Should be 0x followed by 64 hex characters.');
      process.exit(1);
    }
    
    // Set the environment variable
    process.env.OWNER_PRIVATE_KEY = privateKey;
    console.log('✅ Private key set successfully.\n');
  }
  
  rl.close();
  
  // Now run the update
  console.log('🚀 Starting limit update process...\n');
  const success = await updateLimitsViaPeer();
  
  if (success) {
    console.log('\n🎉 Inbound limits successfully updated!');
    process.exit(0);
  } else {
    console.log('\n❌ Failed to update inbound limits.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
});
