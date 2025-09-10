#!/usr/bin/env node

/**
 * Decode Relay Instructions
 * 
 * This script decodes the relayInstructionsBytes to understand what they contain
 */

const { ethers } = require('ethers');

// The working relay instructions from testnet
const WORKING_RELAY_INSTRUCTIONS = "0x010000000000000000000000000007a12000000000000000000000000000000000";

const decodeRelayInstructions = (hexData) => {
  console.log('🔍 Decoding Relay Instructions');
  console.log('==============================');
  console.log('Raw hex data:', hexData);
  console.log('Length:', hexData.length - 2, 'hex chars,', (hexData.length - 2) / 2, 'bytes');
  
  // Remove 0x prefix
  const data = hexData.slice(2);
  console.log('\n📊 Byte-by-byte analysis:');
  
  // Split into bytes for analysis
  const bytes = [];
  for (let i = 0; i < data.length; i += 2) {
    bytes.push(data.slice(i, i + 2));
  }
  
  bytes.forEach((byte, index) => {
    console.log(`   Byte ${index.toString().padStart(2, ' ')}: 0x${byte} (${parseInt(byte, 16).toString().padStart(3, ' ')})`);
  });
  
  console.log('\n🔍 Structured Analysis:');
  
  if (data.length >= 2) {
    const instructionType = parseInt(data.slice(0, 2), 16);
    console.log('   Instruction Type (byte 0):', instructionType, instructionType === 1 ? '(GasInstruction)' : '(Unknown)');
  }
  
  if (data.length >= 66) { // 33 bytes = 66 hex chars
    // Assuming this is a GasInstruction based on the format
    const instructionType = parseInt(data.slice(0, 2), 16);
    
    if (instructionType === 1) {
      // Parse as GasInstruction (looking at the actual structure)
      // Let's find where the actual gas limit is encoded
      // Looking at bytes 14-15: 0x07a1 = 1953, bytes 15-16: 0xa120 = 41248
      // The gas limit 500000 = 0x7a120, so it's at bytes 13-16 (4 bytes, big-endian)
      
      // Try different interpretations:
      const gasLimitHex1 = '0x' + data.slice(26, 34); // bytes 13-16 (4 bytes)
      const gasLimitHex2 = '0x' + data.slice(28, 32); // last 2 bytes of the significant part
      const gasLimitFull = '0x' + data.slice(2, 66); // full 32 bytes as originally tried
      
      const gasLimit = BigInt(gasLimitHex);
      const msgValue = msgValueHex.length > 2 ? BigInt(msgValueHex) : 0n;
      
      console.log('\n✅ GasInstruction decoded:');
      console.log('   Type:', instructionType, '(GasInstruction)');
      console.log('   Gas Limit (hex):', gasLimitHex);
      console.log('   Gas Limit (decimal):', gasLimit.toString());
      console.log('   Gas Limit (formatted):', Number(gasLimit).toLocaleString());
      
      if (msgValueHex.length > 2) {
        console.log('   Msg Value (hex):', msgValueHex);
        console.log('   Msg Value (decimal):', msgValue.toString());
        console.log('   Msg Value (ETH):', ethers.formatEther(msgValue));
      } else {
        console.log('   Msg Value: 0 (not specified or truncated)');
      }
      
      // Check if gasLimit makes sense
      if (gasLimit >= 21000n && gasLimit <= 10000000n) {
        console.log('   ✅ Gas limit looks reasonable for smart contract execution');
      } else if (gasLimit < 21000n) {
        console.log('   ⚠️  Gas limit seems low for smart contract execution');
      } else {
        console.log('   ⚠️  Gas limit seems very high');
      }
    }
  }
  
  console.log('\n🎯 SUMMARY:');
  console.log('   This appears to be a GasInstruction telling the executor:');
  console.log('   - Use specific gas limit for destination transaction');
  console.log('   - Optionally include msg.value for payable functions');
  console.log('   - Ensures proper execution parameters on destination chain');
};

const main = () => {
  console.log('🧪 Relay Instructions Decoder');
  console.log('===============================\n');
  
  console.log('📋 Analyzing WORKING testnet relay instructions:');
  decodeRelayInstructions(WORKING_RELAY_INSTRUCTIONS);
  
  console.log('\n' + '='.repeat(60));
  console.log('🔍 Comparison with empty instructions:');
  console.log('   Working (testnet): Has gas limit specification');
  console.log('   Failed (mainnet):  Empty (no gas specification)');
  console.log('   \n   The executor might need explicit gas limits for Sei EVM');
  console.log('   to properly estimate and execute the destination transaction.');
};

if (require.main === module) {
  main();
}

module.exports = { decodeRelayInstructions };
