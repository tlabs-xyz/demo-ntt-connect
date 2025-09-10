#!/usr/bin/env node

/**
 * Explore NTT Contract Functions
 * 
 * This script explores the actual functions available on the NTT Manager contracts
 * to understand how to properly manage inbound/outbound limits.
 */

const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  ethereumRpc: 'https://ethereum-rpc.publicnode.com',
  seiEvmRpc: 'https://evm-rpc.sei-apis.com',
  
  ethereum: {
    nttManager: '0x79eb9aF995a443A102A19b41EDbB58d66e2921c7',
  },
  seiEvm: {
    nttManager: '0xc10a0886d4Fe06bD61f41ee2855a2215375B82f0',
  }
};

// Extended ABI to explore more functions
const EXTENDED_NTT_MANAGER_ABI = [
  // Current functions we know
  "function getOutboundLimitParams() external view returns (uint256 limit, uint256 currentCapacity)",
  "function getInboundLimitParams(uint16 chainId_) external view returns (uint256 limit, uint256 currentCapacity)",
  "function setInboundLimit(uint256 limit, uint16 chainId) external",
  "function setOutboundLimit(uint256 limit) external",
  "function owner() external view returns (address)",
  
  // Additional limit-related functions that might exist
  "function getInboundLimit(uint16 chainId_) external view returns (uint256)",
  "function getOutboundLimit() external view returns (uint256)",
  "function rateLimitDuration() external view returns (uint256)",
  
  // Peer management
  "function setPeer(uint16 peerChainId, bytes32 peerContract, uint8 decimals, uint256 inboundLimit) external",
  "function getPeer(uint16 chainId_) external view returns (tuple(bytes32 peerAddress, uint8 tokenDecimals))",
  
  // Admin functions
  "function pause() external",
  "function unpause() external",
  "function paused() external view returns (bool)",
];

// Function to test which functions actually exist
const testContractFunctions = async (provider, contractAddress, chainName) => {
  console.log(`\n🔍 Exploring ${chainName} NTT Manager: ${contractAddress}`);
  console.log('='.repeat(60));
  
  const contract = new ethers.Contract(contractAddress, EXTENDED_NTT_MANAGER_ABI, provider);
  
  const functionResults = {};
  
  // Test each function
  for (const fragment of EXTENDED_NTT_MANAGER_ABI) {
    try {
      const iface = new ethers.Interface([fragment]);
      const funcName = Object.keys(iface.functions)[0];
      const func = iface.functions[funcName];
      
      console.log(`\n📋 Testing function: ${func.name}`);
      
      if (func.stateMutability === 'view' || func.stateMutability === 'pure') {
        try {
          // For view functions, try to call them
          if (func.name === 'getInboundLimitParams' || func.name === 'getInboundLimit') {
            // Test with both chain IDs
            for (const chainId of [2, 40]) {
              try {
                const result = await contract[func.name](chainId);
                console.log(`   ✅ ${func.name}(${chainId}):`, result.toString());
                functionResults[`${func.name}_${chainId}`] = result;
              } catch (error) {
                console.log(`   ❌ ${func.name}(${chainId}): ${error.message.split('(')[0]}`);
              }
            }
          } else if (func.inputs.length === 0) {
            // No parameters needed
            const result = await contract[func.name]();
            console.log(`   ✅ ${func.name}():`, result.toString());
            functionResults[func.name] = result;
          } else {
            console.log(`   ⚠️  ${func.name}: Requires parameters, skipping`);
          }
        } catch (error) {
          console.log(`   ❌ ${func.name}: ${error.message.split('(')[0]}`);
        }
      } else {
        console.log(`   📝 ${func.name}: Write function (not testing)`);
        functionResults[func.name] = 'write_function';
      }
    } catch (error) {
      console.log(`   💥 Error parsing function: ${error.message}`);
    }
  }
  
  return functionResults;
};

// Check if there's a rate limit duration that affects the limits
const analyzeRateLimiting = async (provider, contractAddress, chainName) => {
  console.log(`\n🕐 Analyzing Rate Limiting for ${chainName}`);
  console.log('-'.repeat(40));
  
  const contract = new ethers.Contract(contractAddress, EXTENDED_NTT_MANAGER_ABI, provider);
  
  try {
    // Try to get rate limit duration
    const duration = await contract.rateLimitDuration();
    console.log(`   Rate Limit Duration: ${duration} seconds (${duration / 3600} hours)`);
    
    // Get current limits for comparison
    const outbound = await contract.getOutboundLimitParams();
    console.log(`   Outbound Limit: ${ethers.formatEther(outbound.limit)} tokens`);
    console.log(`   Outbound Capacity: ${ethers.formatEther(outbound.currentCapacity)} tokens`);
    
    // Check inbound for both peer chains
    for (const peerChainId of [2, 40]) {
      if ((chainName === 'Ethereum' && peerChainId === 40) || 
          (chainName === 'Sei EVM' && peerChainId === 2)) {
        try {
          const inbound = await contract.getInboundLimitParams(peerChainId);
          console.log(`   Inbound from chain ${peerChainId}: ${ethers.formatEther(inbound.limit)} tokens`);
          console.log(`   Inbound capacity: ${ethers.formatEther(inbound.currentCapacity)} tokens`);
          
          // Calculate the ratio
          const ratio = Number(outbound.limit) / Number(inbound.limit);
          console.log(`   📊 Ratio (Outbound/Inbound): ${ratio.toFixed(0)}x`);
          
          if (ratio > 1000) {
            console.log(`   🚨 ISSUE: Inbound limit is ${ratio.toFixed(0)}x smaller than outbound!`);
          }
        } catch (error) {
          console.log(`   ❌ Could not get inbound limit for chain ${peerChainId}`);
        }
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Could not analyze rate limiting: ${error.message}`);
  }
};

// Look for alternative limit management functions
const findLimitManagementFunctions = async () => {
  console.log('\n🔍 Looking for Alternative Limit Management Functions');
  console.log('='.repeat(60));
  
  // These are potential function signatures that might exist
  const potentialFunctions = [
    "function setRateLimit(uint256 limit, uint16 chainId) external",
    "function updateInboundLimit(uint256 limit, uint16 chainId) external", 
    "function configureInboundLimit(uint256 limit, uint16 chainId) external",
    "function setInboundRateLimit(uint256 limit, uint16 chainId) external",
    "function setChainInboundLimit(uint16 chainId, uint256 limit) external",
    "function increaseInboundLimit(uint16 chainId, uint256 amount) external",
    "function resetInboundLimit(uint16 chainId) external",
  ];
  
  console.log('🔍 Potential alternative functions to try:');
  potentialFunctions.forEach((func, index) => {
    console.log(`   ${index + 1}. ${func}`);
  });
  
  console.log('\n💡 If setInboundLimit is not working, the issue might be:');
  console.log('   1. Function exists but has different parameters');
  console.log('   2. Function requires special permissions or conditions');
  console.log('   3. There\'s a rate limiting mechanism preventing updates');
  console.log('   4. The limit needs to be set during setPeer() call');
  console.log('   5. Contract might be paused or have other restrictions');
};

// Main exploration function
const exploreNttContracts = async () => {
  console.log('🔬 NTT Contract Function Explorer');
  console.log('==================================');
  
  try {
    // Setup providers
    const ethereumProvider = new ethers.JsonRpcProvider(CONFIG.ethereumRpc);
    const seiEvmProvider = new ethers.JsonRpcProvider(CONFIG.seiEvmRpc);
    
    // Explore Ethereum contract
    const ethResults = await testContractFunctions(
      ethereumProvider, 
      CONFIG.ethereum.nttManager, 
      'Ethereum'
    );
    
    // Analyze rate limiting for Ethereum
    await analyzeRateLimiting(
      ethereumProvider, 
      CONFIG.ethereum.nttManager, 
      'Ethereum'
    );
    
    // Explore Sei EVM contract  
    const seiResults = await testContractFunctions(
      seiEvmProvider, 
      CONFIG.seiEvm.nttManager, 
      'Sei EVM'
    );
    
    // Analyze rate limiting for Sei EVM
    await analyzeRateLimiting(
      seiEvmProvider, 
      CONFIG.seiEvm.nttManager, 
      'Sei EVM'
    );
    
    // Look for alternatives
    await findLimitManagementFunctions();
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY & RECOMMENDATIONS');
    console.log('='.repeat(80));
    
    console.log('\n🔍 Key Findings:');
    console.log('   • Both contracts have extremely low inbound limits compared to outbound');
    console.log('   • setInboundLimit function exists but updates might not be taking effect');
    console.log('   • Rate limiting mechanism might be involved');
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Check if contracts are paused');
    console.log('   2. Verify owner permissions');
    console.log('   3. Check if setPeer needs to be called with new inbound limit');
    console.log('   4. Look at recent transactions to see successful limit updates');
    console.log('   5. Check if there are governance or timelock mechanisms');
    
  } catch (error) {
    console.error('❌ Exploration failed:', error.message);
  }
};

// Run the exploration
if (require.main === module) {
  exploreNttContracts();
}

module.exports = { exploreNttContracts };
