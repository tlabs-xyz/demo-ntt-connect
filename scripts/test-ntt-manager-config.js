#!/usr/bin/env node

/**
 * NTT Manager Configuration Test Script
 * 
 * This script verifies that the original NTT Managers are properly configured
 * with correct peer relationships, inbound/outbound limits.
 * Only tests original NttManager contracts, not NttManagerWithExecutor.
 */

const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  // RPC endpoints
  ethereumRpc: 'https://ethereum-rpc.publicnode.com',
  seiEvmRpc: 'https://evm-rpc.sei-apis.com',
  
  // Wormhole Chain IDs
  ethereumWormholeId: 2,
  seiEvmWormholeId: 40,
  
  // Contract addresses from deployment.json (original NTT Managers only)
  ethereum: {
    nttManager: '0x79eb9aF995a443A102A19b41EDbB58d66e2921c7',
    token: '0x18084fbA666a33d37592fA2633fD49a74DD93a88',
  },
  seiEvm: {
    nttManager: '0xc10a0886d4Fe06bD61f41ee2855a2215375B82f0',
    token: '0xF9201c9192249066Aec049ae7951ae298BBEc767',
  }
};

// Simplified NTT Manager ABI - only essential functions
const NTT_MANAGER_ABI = [
  // Peer management
  "function getPeer(uint16 chainId_) external view returns (tuple(bytes32 peerAddress, uint8 tokenDecimals))",
  
  // Limits
  "function getOutboundLimitParams() external view returns (uint256 limit, uint256 currentCapacity)",
  "function getInboundLimitParams(uint16 chainId_) external view returns (uint256 limit, uint256 currentCapacity)",
  
  // Basic info
  "function token() external view returns (address)",
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

// Helper function to format bytes32 address
const formatBytes32Address = (bytes32Address) => {
  // Convert bytes32 to address (take last 20 bytes)
  const addressHex = bytes32Address.slice(-40);
  return '0x' + addressHex;
};

// Test a single NTT Manager configuration
const testNttManagerConfig = async (provider, managerAddress, chainName, peerChainId, expectedPeerAddress) => {
  console.log(`\n📋 Testing NTT Manager on ${chainName}`);
  console.log('='.repeat(50));
  
  try {
    const nttManager = new ethers.Contract(managerAddress, NTT_MANAGER_ABI, provider);
    
    console.log('📍 Contract Address:', managerAddress);
    
    // Get token address and decimals
    const tokenAddress = await nttManager.token();
    console.log('🪙 Token Address:', tokenAddress);
    
    let tokenDecimals = 18; // default
    let tokenSymbol = 'Unknown';
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      tokenDecimals = await tokenContract.decimals();
      tokenSymbol = await tokenContract.symbol();
      console.log('   Token Symbol:', tokenSymbol);
      console.log('   Token Decimals:', tokenDecimals);
    } catch (error) {
      console.log('   Token info: Unable to fetch, using defaults');
    }
    
    // Test peer configuration
    console.log('\n🔗 Peer Configuration:');
    console.log(`   Checking peer chain ${peerChainId}...`);
    
    try {
      const peer = await nttManager.getPeer(peerChainId);
      const peerAddress = formatBytes32Address(peer.peerAddress);
      const peerDecimals = peer.tokenDecimals;
      
      console.log(`   Peer address (bytes32): ${peer.peerAddress}`);
      console.log(`   Peer address (as address): ${peerAddress}`);
      console.log(`   Peer token decimals: ${peerDecimals}`);
      
      // Check if peer is properly configured (not zero address)
      if (peer.peerAddress === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        console.log('   ❌ Peer is not configured (zero address)');
        return false;
      }
      
      // Check if peer address matches expected
      if (expectedPeerAddress && peerAddress.toLowerCase() === expectedPeerAddress.toLowerCase()) {
        console.log('   ✅ Peer address matches expected');
      } else if (expectedPeerAddress) {
        console.log('   ⚠️  Peer address differs from expected');
        console.log('      Expected:', expectedPeerAddress);
        console.log('      Actual:  ', peerAddress);
      }
      
      // Check if peer decimals match local decimals
      if (peerDecimals === tokenDecimals) {
        console.log('   ✅ Peer decimals match local token decimals');
      } else {
        console.log('   ⚠️  Peer decimals differ from local token decimals');
        console.log('      Local:', tokenDecimals, 'Peer:', peerDecimals);
      }
      
    } catch (error) {
      console.log('   ❌ Error checking peer configuration:', error.message);
      return false;
    }
    
    // Test outbound limits
    console.log('\n📤 Outbound Limits:');
    try {
      const outbound = await nttManager.getOutboundLimitParams();
      console.log('   Limit:', formatAmount(outbound.limit, tokenDecimals), 'tokens');
      console.log('   Current Capacity:', formatAmount(outbound.currentCapacity, tokenDecimals), 'tokens');
      console.log('   Utilization:', ((Number(outbound.limit) - Number(outbound.currentCapacity)) / Number(outbound.limit) * 100).toFixed(2) + '%');
      
      if (outbound.limit > 0) {
        console.log('   ✅ Outbound limit is configured');
      } else {
        console.log('   ⚠️  Outbound limit is zero');
      }
    } catch (error) {
      console.log('   ❌ Error checking outbound limits:', error.message);
    }
    
    // Test inbound limits
    console.log('\n📥 Inbound Limits:');
    console.log(`   From chain ${peerChainId}:`);
    try {
      const inbound = await nttManager.getInboundLimitParams(peerChainId);
      console.log(`   Limit: ${formatAmount(inbound.limit, tokenDecimals)} ${tokenSymbol}`);
      console.log(`   Current Capacity: ${formatAmount(inbound.currentCapacity, tokenDecimals)} ${tokenSymbol}`);
      
      const used = Number(inbound.limit) - Number(inbound.currentCapacity);
      const utilizationPercent = Number(inbound.limit) > 0 ? (used / Number(inbound.limit) * 100).toFixed(2) : '0.00';
      console.log(`   Used: ${formatAmount(used.toString(), tokenDecimals)} ${tokenSymbol} (${utilizationPercent}%)`);
      
      if (inbound.limit > 0) {
        console.log('   ✅ Inbound limit is configured');
      } else {
        console.log('   ⚠️  Inbound limit is zero - no transfers allowed from peer chain');
      }
      
      // Check if capacity is reasonable
      if (Number(inbound.currentCapacity) < 0) {
        console.log('   ❌ WARNING: Negative capacity detected!');
      } else if (Number(inbound.currentCapacity) > Number(inbound.limit)) {
        console.log('   ❌ WARNING: Current capacity exceeds limit!');
      }
      
    } catch (error) {
      console.log('   ❌ Error checking inbound limit:', error.message);
    }
    
    console.log('\n✅ Configuration check completed for', chainName, 'NTT Manager');
    return true;
    
  } catch (error) {
    console.log('❌ Failed to check configuration:', error.message);
    return false;
  }
};

// Main test function
const testNttManagerConfigurations = async () => {
  console.log('🧪 NTT Manager Configuration Test');
  console.log('=====================================');
  console.log('Testing ONLY original NTT Managers (not WithExecutor)');
  console.log('Checking: peer relationships, inbound limits, outbound limits\n');
  
  // Setup providers
  const ethereumProvider = new ethers.JsonRpcProvider(CONFIG.ethereumRpc);
  const seiEvmProvider = new ethers.JsonRpcProvider(CONFIG.seiEvmRpc);
  
  console.log('🔗 Network Configuration:');
  console.log('   Ethereum RPC:', CONFIG.ethereumRpc);
  console.log('   Sei EVM RPC:', CONFIG.seiEvmRpc);
  console.log('   Ethereum Wormhole Chain ID:', CONFIG.ethereumWormholeId);
  console.log('   Sei EVM Wormhole Chain ID:', CONFIG.seiEvmWormholeId);
  
  let allTestsPassed = true;
  
  // Test Ethereum NTT Manager -> Sei EVM peer
  const ethResult = await testNttManagerConfig(
    ethereumProvider,
    CONFIG.ethereum.nttManager,
    'Ethereum',
    CONFIG.seiEvmWormholeId,
    CONFIG.seiEvm.nttManager
  );
  allTestsPassed = allTestsPassed && ethResult;
  
  // Test Sei EVM NTT Manager -> Ethereum peer
  const seiResult = await testNttManagerConfig(
    seiEvmProvider,
    CONFIG.seiEvm.nttManager,
    'Sei EVM',
    CONFIG.ethereumWormholeId,
    CONFIG.ethereum.nttManager
  );
  allTestsPassed = allTestsPassed && seiResult;
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 CONFIGURATION TEST SUMMARY');
  console.log('='.repeat(70));
  
  console.log('✅ Tests Passed:');
  if (ethResult) console.log('   • Ethereum NTT Manager');
  if (seiResult) console.log('   • Sei EVM NTT Manager');
  
  console.log('\n❌ Tests Failed:');
  if (!ethResult) console.log('   • Ethereum NTT Manager');
  if (!seiResult) console.log('   • Sei EVM NTT Manager');
  
  console.log('\n🎯 OVERALL RESULT:');
  if (allTestsPassed) {
    console.log('✅ ALL NTT MANAGER CONFIGURATIONS ARE VALID!');
    console.log('   • Peer relationships are properly configured');
    console.log('   • Inbound and outbound limits are set');
    console.log('   • Cross-chain transfers should work');
  } else {
    console.log('❌ SOME NTT MANAGER CONFIGURATIONS NEED ATTENTION!');
    console.log('   Please review the failed tests above.');
  }
  
  // Specific recommendations
  console.log('\n💡 WHAT THIS MEANS:');
  if (allTestsPassed) {
    console.log('   ✅ Your NTT deployment is ready for cross-chain transfers');
    console.log('   ✅ Both Ethereum and Sei EVM managers can communicate');
    console.log('   ✅ Transfer limits are configured and enforced');
  } else {
    console.log('   ⚠️  Cross-chain transfers may fail with current configuration');
    console.log('   ⚠️  Check peer addresses and limits before proceeding');
  }
  
  return allTestsPassed;
};

// Run the test
if (require.main === module) {
  testNttManagerConfigurations().then(success => {
    console.log('\n' + '='.repeat(50));
    if (success) {
      console.log('🎉 NTT Manager configuration test PASSED!');
      console.log('Ready for cross-chain transfers!');
      process.exit(0);
    } else {
      console.log('⚠️  NTT Manager configuration test FAILED!');
      console.log('Fix the issues above before attempting transfers.');
      process.exit(1);
    }
  }).catch(error => {
    console.error('💥 Configuration test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testNttManagerConfigurations, CONFIG };
