#!/usr/bin/env node

/**
 * Update Inbound Limits Script
 * 
 * This script helps update the inbound limits on NTT Managers to match
 * the outbound limits for better cross-chain transfer capacity.
 */

const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  // RPC endpoints (using multiple for redundancy)
  ethereumRpcs: [
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.ankr.com/eth',
    'https://eth.llamarpc.com'
  ],
  seiEvmRpc: 'https://evm-rpc.sei-apis.com',
  
  // Wormhole Chain IDs
  ethereumWormholeId: 2,
  seiEvmWormholeId: 40,
  
  // Contract addresses (original NTT Managers only)
  ethereum: {
    nttManager: '0x79eb9aF995a443A102A19b41EDbB58d66e2921c7',
    token: '0x18084fbA666a33d37592fA2633fD49a74DD93a88',
  },
  seiEvm: {
    nttManager: '0xc10a0886d4Fe06bD61f41ee2855a2215375B82f0',
    token: '0xF9201c9192249066Aec049ae7951ae298BBEc767',
  },
  
  // Owner private key (you'll need to provide this)
  // WARNING: Never commit private keys to code! Use environment variables in production
  ownerPrivateKey: process.env.OWNER_PRIVATE_KEY || null
};

// NTT Manager ABI for limit management
const NTT_MANAGER_ABI = [
  // Read functions
  "function getOutboundLimitParams() external view returns (uint256 limit, uint256 currentCapacity)",
  "function getInboundLimitParams(uint16 chainId_) external view returns (uint256 limit, uint256 currentCapacity)",
  "function owner() external view returns (address)",
  "function token() external view returns (address)",
  
  // Write functions (owner only)
  "function setInboundLimit(uint256 limit, uint16 chainId) external",
];

// ERC20 ABI for token info
const ERC20_ABI = [
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

// Helper function to format amounts
const formatAmount = (amount, decimals) => {
  return ethers.formatUnits(amount, decimals);
};

// Helper to get working Ethereum provider
const getEthereumProvider = async () => {
  for (const rpc of CONFIG.ethereumRpcs) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      await provider.getBlockNumber(); // Test connection
      console.log('   ✅ Connected to Ethereum via:', rpc);
      return provider;
    } catch (error) {
      console.log('   ⚠️  Failed to connect to:', rpc);
    }
  }
  throw new Error('No working Ethereum RPC found');
};

// Check current limits and suggest updates
const checkAndSuggestLimits = async () => {
  console.log('🔍 Checking Current Limits and Suggesting Updates');
  console.log('='.repeat(60));
  
  // Setup providers with redundancy
  console.log('\n🔗 Connecting to networks...');
  const ethereumProvider = await getEthereumProvider();
  const seiEvmProvider = new ethers.JsonRpcProvider(CONFIG.seiEvmRpc);
  console.log('   ✅ Connected to Sei EVM via:', CONFIG.seiEvmRpc);
  
  const suggestions = [];
  
  // Check Ethereum NTT Manager
  console.log('\n📋 Ethereum NTT Manager Analysis:');
  try {
    const ethNttManager = new ethers.Contract(CONFIG.ethereum.nttManager, NTT_MANAGER_ABI, ethereumProvider);
    const ethTokenContract = new ethers.Contract(CONFIG.ethereum.token, ERC20_ABI, ethereumProvider);
    
    const [outbound, inbound, decimals, symbol, owner] = await Promise.all([
      ethNttManager.getOutboundLimitParams(),
      ethNttManager.getInboundLimitParams(CONFIG.seiEvmWormholeId),
      ethTokenContract.decimals(),
      ethTokenContract.symbol(),
      ethNttManager.owner()
    ]);
    
    console.log('   Contract:', CONFIG.ethereum.nttManager);
    console.log('   Owner:', owner);
    console.log('   Token:', symbol);
    console.log('   Outbound Limit:', formatAmount(outbound.limit, decimals), symbol);
    console.log('   Inbound Limit (from Sei EVM):', formatAmount(inbound.limit, decimals), symbol);
    
    const ratio = Number(outbound.limit) / Number(inbound.limit);
    console.log(`   Ratio: Outbound is ${ratio.toFixed(0)}x larger than Inbound`);
    
    if (Number(inbound.limit) < Number(outbound.limit)) {
      console.log('   ⚠️  RECOMMENDATION: Increase inbound limit to match outbound limit');
      suggestions.push({
        chain: 'Ethereum',
        contract: CONFIG.ethereum.nttManager,
        currentInbound: inbound.limit,
        suggestedInbound: outbound.limit,
        peerChainId: CONFIG.seiEvmWormholeId,
        owner: owner,
        decimals: decimals,
        symbol: symbol
      });
    } else {
      console.log('   ✅ Inbound limit is adequate');
    }
    
  } catch (error) {
    console.log('   ❌ Error checking Ethereum limits:', error.message);
  }
  
  // Check Sei EVM NTT Manager
  console.log('\n📋 Sei EVM NTT Manager Analysis:');
  try {
    const seiNttManager = new ethers.Contract(CONFIG.seiEvm.nttManager, NTT_MANAGER_ABI, seiEvmProvider);
    const seiTokenContract = new ethers.Contract(CONFIG.seiEvm.token, ERC20_ABI, seiEvmProvider);
    
    const [outbound, inbound, decimals, symbol, owner] = await Promise.all([
      seiNttManager.getOutboundLimitParams(),
      seiNttManager.getInboundLimitParams(CONFIG.ethereumWormholeId),
      seiTokenContract.decimals(),
      seiTokenContract.symbol(),
      seiNttManager.owner()
    ]);
    
    console.log('   Contract:', CONFIG.seiEvm.nttManager);
    console.log('   Owner:', owner);
    console.log('   Token:', symbol);
    console.log('   Outbound Limit:', formatAmount(outbound.limit, decimals), symbol);
    console.log('   Inbound Limit (from Ethereum):', formatAmount(inbound.limit, decimals), symbol);
    
    const ratio = Number(outbound.limit) / Number(inbound.limit);
    console.log(`   Ratio: Outbound is ${ratio.toFixed(0)}x larger than Inbound`);
    
    if (Number(inbound.limit) < Number(outbound.limit)) {
      console.log('   ⚠️  RECOMMENDATION: Increase inbound limit to match outbound limit');
      suggestions.push({
        chain: 'Sei EVM',
        contract: CONFIG.seiEvm.nttManager,
        currentInbound: inbound.limit,
        suggestedInbound: outbound.limit,
        peerChainId: CONFIG.ethereumWormholeId,
        owner: owner,
        decimals: decimals,
        symbol: symbol
      });
    } else {
      console.log('   ✅ Inbound limit is adequate');
    }
    
  } catch (error) {
    console.log('   ❌ Error checking Sei EVM limits:', error.message);
  }
  
  return suggestions;
};

// Generate transaction calls to update limits
const generateUpdateCalls = (suggestions) => {
  console.log('\n🛠️  RECOMMENDED ACTIONS:');
  console.log('='.repeat(50));
  
  if (suggestions.length === 0) {
    console.log('✅ No updates needed - all limits are properly configured!');
    return;
  }
  
  console.log('To update the inbound limits, you need to call setInboundLimit() as the owner:\n');
  
  suggestions.forEach((suggestion, index) => {
    console.log(`${index + 1}. ${suggestion.chain} NTT Manager:`);
    console.log(`   Contract: ${suggestion.contract}`);
    console.log(`   Owner: ${suggestion.owner}`);
    console.log(`   Current Inbound: ${formatAmount(suggestion.currentInbound, suggestion.decimals)} ${suggestion.symbol}`);
    console.log(`   Suggested Inbound: ${formatAmount(suggestion.suggestedInbound, suggestion.decimals)} ${suggestion.symbol}`);
    console.log(`   Peer Chain ID: ${suggestion.peerChainId}`);
    console.log('');
    console.log('   📋 Function Call:');
    console.log(`   setInboundLimit(${suggestion.suggestedInbound.toString()}, ${suggestion.peerChainId})`);
    console.log('');
    console.log('   🔗 Etherscan/Explorer Transaction Data:');
    console.log(`   To: ${suggestion.contract}`);
    console.log(`   Data: ${ethers.Interface.from(NTT_MANAGER_ABI).encodeFunctionData('setInboundLimit', [suggestion.suggestedInbound, suggestion.peerChainId])}`);
    console.log('\n' + '-'.repeat(50) + '\n');
  });
  
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   • Only the contract owner can call setInboundLimit()');
  console.log('   • Make sure you have the owner private key');
  console.log('   • Test on a small amount first');
  console.log('   • These changes take effect immediately');
};

// Execute the limit updates (if private key is provided)
const executeUpdates = async (suggestions) => {
  if (!CONFIG.ownerPrivateKey) {
    console.log('\n💡 To execute updates automatically:');
    console.log('   Set OWNER_PRIVATE_KEY environment variable');
    console.log('   Example: OWNER_PRIVATE_KEY=0x... npm run update-limits');
    return;
  }
  
  console.log('\n🚀 Executing Limit Updates...');
  console.log('='.repeat(40));
  
  for (const suggestion of suggestions) {
    try {
      console.log(`\n📤 Updating ${suggestion.chain} inbound limit...`);
      
      // Setup provider and signer with better error handling
      const provider = suggestion.chain === 'Ethereum' 
        ? await getEthereumProvider()
        : new ethers.JsonRpcProvider(CONFIG.seiEvmRpc);
      
      const signer = new ethers.Wallet(CONFIG.ownerPrivateKey, provider);
      const nttManager = new ethers.Contract(suggestion.contract, NTT_MANAGER_ABI, signer);
      
      // Check if signer is the owner
      const owner = await nttManager.owner();
      if (signer.address.toLowerCase() !== owner.toLowerCase()) {
        console.log(`   ❌ Signer (${signer.address}) is not the owner (${owner})`);
        continue;
      }
      
      // Execute the update with better error handling
      console.log(`   🔄 Sending transaction to update inbound limit...`);
      
      const tx = await nttManager.setInboundLimit(suggestion.suggestedInbound, suggestion.peerChainId, {
        gasLimit: 200000, // Explicit gas limit
        maxFeePerGas: ethers.parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
      });
      
      console.log(`   📋 Transaction sent: ${tx.hash}`);
      console.log(`   🔄 Waiting for confirmation...`);
      
      const receipt = await tx.wait(2); // Wait for 2 confirmations
      console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);
      console.log(`   ✅ Updated inbound limit to ${formatAmount(suggestion.suggestedInbound, suggestion.decimals)} ${suggestion.symbol}`);
      
      // Verify the update
      const newLimit = await nttManager.getInboundLimitParams(suggestion.peerChainId);
      console.log(`   ✅ Verified new limit: ${formatAmount(newLimit.limit, suggestion.decimals)} ${suggestion.symbol}`);
      
    } catch (error) {
      console.log(`   ❌ Failed to update ${suggestion.chain}: ${error.message}`);
    }
  }
};

// Main function
const updateInboundLimits = async () => {
  console.log('🔧 NTT Manager Inbound Limit Update Tool');
  console.log('========================================');
  
  try {
    // Check current limits and get suggestions
    const suggestions = await checkAndSuggestLimits();
    
    // Generate update instructions
    generateUpdateCalls(suggestions);
    
    // Execute updates if private key is provided
    await executeUpdates(suggestions);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 SUMMARY:');
    if (suggestions.length === 0) {
      console.log('✅ All inbound limits are properly configured!');
    } else {
      console.log(`⚠️  ${suggestions.length} inbound limit(s) need to be updated`);
      console.log('Follow the instructions above to update them.');
    }
    
    return suggestions.length === 0;
    
  } catch (error) {
    console.error('❌ Update process failed:', error.message);
    return false;
  }
};

// Run the script
if (require.main === module) {
  updateInboundLimits().then(success => {
    if (success) {
      console.log('\n🎉 Inbound limits are properly configured!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Action required to update inbound limits.');
      process.exit(1);
    }
  });
}

module.exports = { updateInboundLimits, CONFIG };
