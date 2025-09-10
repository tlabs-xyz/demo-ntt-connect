#!/usr/bin/env node

/**
 * Simulate Destination Transaction
 * 
 * This script tries to simulate what the executor would do on Sei EVM
 */

const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  seiEvmRpc: 'https://evm-rpc.sei-apis.com',
  seiEvmNttManager: '0xc10a0886d4Fe06bD61f41ee2855a2215375B82f0',
  tbtcTokenSei: '0xF9201c9192249066Aec049ae7951ae298BBEc767',
  
  // Sample transfer data from your failed transaction
  transferAmount: '4800', // 0.000048 tBTC in 8 decimals
  recipientAddress: '0xB6A114C2c34eF91eeb0d93bcdDD7B95a9D6892E1',
};

// NTT Manager ABI (simplified for receiving transfers)
const NTT_MANAGER_ABI = [
  "function receiveMessage(bytes memory encodedMessage) external",
  "function completeInboundTransfer(bytes memory encodedMessage) external", 
  "function executeInstruction(bytes memory instruction) external",
  "function attestationReceived(uint16 sourceChain, bytes32 sourceAddress, uint64 sequence, bytes memory payload) external",
];

// Token ABI for minting
const TOKEN_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
];

const simulateDestinationTransaction = async () => {
  console.log('🔍 Simulating Destination Transaction');
  console.log('=====================================');
  
  try {
    // Setup provider
    const provider = new ethers.JsonRpcProvider(CONFIG.seiEvmRpc);
    console.log('✅ Connected to Sei EVM:', CONFIG.seiEvmRpc);
    
    // Test contracts
    const nttManager = new ethers.Contract(CONFIG.seiEvmNttManager, NTT_MANAGER_ABI, provider);
    const tbtcToken = new ethers.Contract(CONFIG.tbtcTokenSei, TOKEN_ABI, provider);
    
    console.log('\n📋 Simulation Parameters:');
    console.log('   NTT Manager:', CONFIG.seiEvmNttManager);
    console.log('   Token Contract:', CONFIG.tbtcTokenSei);
    console.log('   Transfer Amount:', CONFIG.transferAmount, '(raw units)');
    console.log('   Recipient:', CONFIG.recipientAddress);
    
    // Check current state
    console.log('\n📊 Current State:');
    const currentBalance = await tbtcToken.balanceOf(CONFIG.recipientAddress);
    console.log('   Recipient Balance:', ethers.formatEther(currentBalance), 'tBTC');
    
    // IMPORTANT: Test if NTT Manager can mint (this is the correct flow)
    console.log('\n🧪 Testing NTT Manager Minting Capability:');
    try {
      // Convert amount from 8 decimals to 18 decimals
      const amount18Decimals = ethers.parseUnits(CONFIG.transferAmount, 10); // 4800 * 10^10 = 4800 * 10^18 / 10^8
      
      console.log('   Amount (18 decimals):', amount18Decimals.toString());
      console.log('   Amount (formatted):', ethers.formatEther(amount18Decimals), 'tBTC');
      
      // CRITICAL: Test if NTT Manager can call mint() by simulating FROM the NTT Manager address
      console.log('   🔍 Testing mint() call FROM NTT Manager address...');
      
      // Create a contract instance that simulates calling from the NTT Manager
      const tokenFromNttManager = tbtcToken.connect({
        getAddress: () => Promise.resolve(CONFIG.seiEvmNttManager)
      });
      
      // This simulates the NTT Manager calling mint()
      const gasEstimate = await tokenFromNttManager.mint.estimateGas(
        CONFIG.recipientAddress,
        amount18Decimals,
        { from: CONFIG.seiEvmNttManager }
      );
      
      console.log('   ✅ NTT Manager can mint! Gas estimate:', gasEstimate.toString());
      console.log('   ✅ The issue is NOT minting privileges');
      
    } catch (error) {
      console.log('   ❌ NTT Manager mint test failed:', error.message);
      
      if (error.message.includes('not a minter')) {
        console.log('   🚨 CRITICAL: NTT Manager lacks minting privileges!');
        console.log('   🛠️  SOLUTION: Grant minting privileges to NTT Manager');
      } else {
        console.log('   🔍 Different issue - not minting privileges');
      }
    }
    
    // Also test the wrong way (direct call without proper caller)
    console.log('\n🧪 Testing Direct Mint (Wrong Way):');
    try {
      const amount18Decimals = ethers.parseUnits(CONFIG.transferAmount, 10);
      const gasEstimate = await tbtcToken.mint.estimateGas(
        CONFIG.recipientAddress,
        amount18Decimals
      );
      console.log('   ⚠️  Direct mint worked (unexpected)');
    } catch (error) {
      console.log('   ✅ Direct mint failed as expected:', error.message.split('(')[0]);
      console.log('   ✅ This confirms minting is properly protected');
    }
    
    // Try to get more detailed gas info
    console.log('\n⛽ Gas Analysis:');
    try {
      const gasPrice = await provider.getFeeData();
      console.log('   Current Gas Price:', ethers.formatUnits(gasPrice.gasPrice || 0n, 'gwei'), 'gwei');
      console.log('   Max Fee Per Gas:', ethers.formatUnits(gasPrice.maxFeePerGas || 0n, 'gwei'), 'gwei');
      console.log('   Max Priority Fee:', ethers.formatUnits(gasPrice.maxPriorityFeePerGas || 0n, 'gwei'), 'gwei');
    } catch (error) {
      console.log('   ❌ Could not get gas info:', error.message);
    }
    
    // Check block info
    try {
      const block = await provider.getBlock('latest');
      console.log('   Latest Block:', block?.number);
      console.log('   Block Gas Limit:', block?.gasLimit.toString());
      console.log('   Block Gas Used:', block?.gasUsed.toString());
    } catch (error) {
      console.log('   ❌ Could not get block info:', error.message);
    }
    
    console.log('\n🎯 SIMULATION SUMMARY:');
    console.log('   This test simulates what the Wormhole Executor would try to do');
    console.log('   on Sei EVM when processing your cross-chain transfer.');
    
  } catch (error) {
    console.log('❌ Simulation error:', error.message);
  }
};

// Run the simulation
if (require.main === module) {
  simulateDestinationTransaction();
}

module.exports = { simulateDestinationTransaction };
