#!/usr/bin/env node

/**
 * Analyze Relay Instructions for Mainnet vs Testnet
 * 
 * This script compares relay instructions and tries to generate working ones for mainnet
 */

const { ethers } = require('ethers');

// Working testnet relay instructions
const TESTNET_WORKING = "0x010000000000000000000000000007a12000000000000000000000000000000000";
const MAINNET_FAILED = "0x"; // Empty

// Gas prices and limits for analysis
const GAS_ANALYSIS = {
  testnet: {
    chainId: 10004, // BaseSepolia
    gasPrice: "1000086", // From successful testnet transaction
    gasLimit: 500000, // Common NTT gas limit
  },
  mainnet: {
    chainId: 40, // Sei EVM
    gasPrice: "1100000000", // Current Sei EVM gas price (1.1 gwei)
    gasLimit: 500000, // Try same as testnet first
  }
};

const analyzeRelayInstructions = () => {
  console.log('🔍 Analyzing Relay Instructions');
  console.log('================================');
  
  console.log('\n📋 Testnet (Working):');
  console.log('   Hex:', TESTNET_WORKING);
  console.log('   Length:', TESTNET_WORKING.length - 2, 'hex chars,', (TESTNET_WORKING.length - 2) / 2, 'bytes');
  
  console.log('\n📋 Mainnet (Failed):');
  console.log('   Hex:', MAINNET_FAILED || '(empty)');
  console.log('   Length:', (MAINNET_FAILED?.length || 2) - 2, 'hex chars,', ((MAINNET_FAILED?.length || 2) - 2) / 2, 'bytes');
  
  // Decode the working testnet instructions
  console.log('\n🔍 Decoding Testnet Instructions:');
  const data = TESTNET_WORKING.slice(2); // Remove 0x
  
  // Parse as instruction type + gas parameters
  const instructionType = parseInt(data.slice(0, 2), 16);
  console.log('   Instruction Type:', instructionType, instructionType === 1 ? '(GasInstruction)' : '(Unknown)');
  
  if (instructionType === 1) {
    // Find where the gas limit is encoded
    // Looking at the hex: 010000000000000000000000000007a12000000000000000000000000000000000
    // The value 0x7a120 = 500000 appears at positions 26-30 (bytes 13-15)
    
    console.log('\n   🔍 Parsing gas parameters:');
    
    // Try different interpretations to find the gas limit
    for (let i = 0; i < data.length - 8; i += 2) {
      const slice4 = data.slice(i, i + 8); // 4 bytes
      const value = parseInt(slice4, 16);
      if (value === 500000) {
        console.log(`   ✅ Found gas limit ${value} at byte position ${i/2}: 0x${slice4}`);
      }
    }
    
    // Manual decode of the known structure
    const gasLimitHex = data.slice(26, 34); // bytes 13-16 where 0x7a120 appears
    const gasLimit = parseInt(gasLimitHex, 16);
    console.log('   Gas Limit (hex):', '0x' + gasLimitHex);
    console.log('   Gas Limit (decimal):', gasLimit);
    
    if (gasLimit === 500000) {
      console.log('   ✅ Confirmed: Gas limit is 500,000');
    }
  }
};

const generateMainnetInstructions = () => {
  console.log('\n🛠️  Generating Mainnet Instructions');
  console.log('====================================');
  
  // Option 1: Use exact same as testnet (static)
  const option1 = TESTNET_WORKING;
  console.log('\n📋 Option 1 - Copy Testnet (Static):');
  console.log('   Hex:', option1);
  console.log('   Description: Use exact same gas limit (500,000)');
  
  // Option 2: Adjust for mainnet gas price
  const option2 = generateGasInstruction(500000, 0); // Same gas limit, 0 msg value
  console.log('\n📋 Option 2 - Same Gas Limit:');
  console.log('   Hex:', option2);
  console.log('   Description: 500,000 gas limit, 0 msg value');
  
  // Option 3: Higher gas limit for mainnet
  const option3 = generateGasInstruction(750000, 0); // Higher gas limit
  console.log('\n📋 Option 3 - Higher Gas Limit:');
  console.log('   Hex:', option3);
  console.log('   Description: 750,000 gas limit, 0 msg value');
  
  // Option 4: Very high gas limit
  const option4 = generateGasInstruction(1000000, 0); // Very high gas limit
  console.log('\n📋 Option 4 - Very High Gas Limit:');
  console.log('   Hex:', option4);
  console.log('   Description: 1,000,000 gas limit, 0 msg value');
  
  return { option1, option2, option3, option4 };
};

const generateGasInstruction = (gasLimit, msgValue = 0) => {
  // Based on the testnet pattern: 01 + 32 bytes gas limit + 32 bytes msg value
  // But the actual encoding seems different, let's use the testnet pattern
  
  // Convert gas limit to hex (4 bytes, big-endian)
  const gasLimitHex = gasLimit.toString(16).padStart(8, '0');
  
  // Reconstruct the pattern from testnet, replacing the gas limit part
  // Original: 010000000000000000000000000007a12000000000000000000000000000000000
  // Replace bytes 13-16 (positions 26-33) with new gas limit
  
  let result = "01"; // Instruction type
  result += "0000000000000000000000000"; // Padding to byte 13
  result += gasLimitHex; // Gas limit (4 bytes)
  result += "00000000000000000000000000000000"; // Remaining padding
  
  return "0x" + result;
};

const main = () => {
  console.log('🧪 Relay Instructions Analysis & Generation');
  console.log('===========================================\n');
  
  analyzeRelayInstructions();
  const options = generateMainnetInstructions();
  
  console.log('\n🎯 RECOMMENDATIONS:');
  console.log('===================');
  console.log('1. Try Option 1 first (exact testnet copy)');
  console.log('2. If that fails, try Option 3 (higher gas limit)');
  console.log('3. The gas limit might need to be higher for mainnet Sei EVM');
  console.log('4. Update your CustomNttTransfer component with these options');
  
  console.log('\n📋 CODE TO UPDATE:');
  console.log('==================');
  console.log('In serializeRelayInstructions(), try:');
  console.log(`return '${options.option1}'; // Option 1`);
  console.log(`// or`);
  console.log(`return '${options.option3}'; // Option 3`);
  
  return options;
};

if (require.main === module) {
  main();
}

module.exports = { analyzeRelayInstructions, generateMainnetInstructions, generateGasInstruction };
