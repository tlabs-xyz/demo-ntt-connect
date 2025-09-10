#!/usr/bin/env node

/**
 * Debug Sei EVM Contract State
 * 
 * This script checks if the Sei EVM NTT Manager can receive transfers
 */

const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  seiEvmRpc: 'https://evm-rpc.sei-apis.com',
  seiEvmNttManager: '0xc10a0886d4Fe06bD61f41ee2855a2215375B82f0',
  tbtcTokenSei: '0xF9201c9192249066Aec049ae7951ae298BBEc767',
  ethereumWormholeId: 2,
};

// NTT Manager ABI (simplified)
const NTT_MANAGER_ABI = [
  "function isPaused() external view returns (bool)",
  "function getInboundLimitParams(uint16 chainId_) external view returns (uint256 limit, uint256 currentCapacity)",
  "function getPeer(uint16 chainId_) external view returns (tuple(bytes32 peerAddress, uint8 tokenDecimals))",
  "function owner() external view returns (address)",
  "function getMode() external view returns (uint8)",
];

// ERC20 ABI (simplified)
const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
];

const debugSeiContract = async () => {
  console.log('🔍 Debugging Sei EVM Contract State');
  console.log('===================================');
  
  try {
    // Setup provider
    const provider = new ethers.JsonRpcProvider(CONFIG.seiEvmRpc);
    console.log('✅ Connected to Sei EVM:', CONFIG.seiEvmRpc);
    
    // Test contracts
    const nttManager = new ethers.Contract(CONFIG.seiEvmNttManager, NTT_MANAGER_ABI, provider);
    const tbtcToken = new ethers.Contract(CONFIG.tbtcTokenSei, ERC20_ABI, provider);
    
    console.log('\n🔍 NTT Manager State:');
    console.log('   Address:', CONFIG.seiEvmNttManager);
    
    // Check if paused
    const isPaused = await nttManager.isPaused();
    console.log('   Is Paused:', isPaused);
    
    // Check owner
    const owner = await nttManager.owner();
    console.log('   Owner:', owner);
    
    // Check mode (0=locking, 1=burning)
    const mode = await nttManager.getMode();
    console.log('   Mode:', mode === 0n ? 'Locking' : 'Burning');
    
    // Check peer configuration
    const peer = await nttManager.getPeer(CONFIG.ethereumWormholeId);
    console.log('   Ethereum Peer:', ethers.getAddress('0x' + peer.peerAddress.slice(26)));
    console.log('   Peer Decimals:', peer.tokenDecimals);
    
    // Check inbound limits
    const inboundLimit = await nttManager.getInboundLimitParams(CONFIG.ethereumWormholeId);
    console.log('   Inbound Limit:', ethers.formatUnits(inboundLimit.limit, 18), 'tBTC');
    console.log('   Current Capacity:', ethers.formatUnits(inboundLimit.currentCapacity, 18), 'tBTC');
    
    console.log('\n🪙 Token Contract State:');
    console.log('   Address:', CONFIG.tbtcTokenSei);
    
    // Check token details
    const symbol = await tbtcToken.symbol();
    const decimals = await tbtcToken.decimals();
    const totalSupply = await tbtcToken.totalSupply();
    
    console.log('   Symbol:', symbol);
    console.log('   Decimals:', decimals);
    console.log('   Total Supply:', ethers.formatUnits(totalSupply, decimals));
    
    // Check NTT Manager token balance
    const managerBalance = await tbtcToken.balanceOf(CONFIG.seiEvmNttManager);
    console.log('   NTT Manager Balance:', ethers.formatUnits(managerBalance, decimals), symbol);
    
    console.log('\n🎯 DIAGNOSIS:');
    if (isPaused) {
      console.log('❌ ISSUE: NTT Manager is PAUSED');
    } else {
      console.log('✅ NTT Manager is not paused');
    }
    
    if (mode === 1n) {
      console.log('✅ Mode is BURNING (correct for destination chain)');
    } else {
      console.log('❌ ISSUE: Mode is LOCKING (should be BURNING for destination)');
    }
    
    if (totalSupply > 0n) {
      console.log('✅ Token has supply (can receive transfers)');
    } else {
      console.log('❌ ISSUE: Token has zero supply');
    }
    
    console.log('\n✅ Sei EVM contract debugging completed');
    
  } catch (error) {
    console.log('❌ Error debugging Sei contract:', error.message);
  }
};

// Run the debug
if (require.main === module) {
  debugSeiContract();
}

module.exports = { debugSeiContract };
