#!/usr/bin/env node

/**
 * Check setPeer Function for Inbound Limit Management
 * 
 * This script investigates if inbound limits need to be set via setPeer()
 * rather than a separate setInboundLimit() function.
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

// ABI with setPeer function that includes inbound limit parameter
const NTT_MANAGER_ABI = [
  // The setPeer function often includes inboundLimit as the 4th parameter
  "function setPeer(uint16 peerChainId, bytes32 peerContract, uint8 decimals, uint256 inboundLimit) external",
  
  // Current read functions
  "function getPeer(uint16 chainId_) external view returns (tuple(bytes32 peerAddress, uint8 tokenDecimals))",
  "function getOutboundLimitParams() external view returns (uint256 limit, uint256 currentCapacity)",
  "function getInboundLimitParams(uint16 chainId_) external view returns (uint256 limit, uint256 currentCapacity)",
  
  // Owner and admin functions
  "function owner() external view returns (address)",
  "function paused() external view returns (bool)",
];

// Check current peer configuration and suggest setPeer update
const checkSetPeerSolution = async () => {
  console.log('🔍 Investigating setPeer Function for Inbound Limit Updates');
  console.log('='.repeat(65));
  
  const ethereumProvider = new ethers.JsonRpcProvider(CONFIG.ethereumRpc);
  const seiEvmProvider = new ethers.JsonRpcProvider(CONFIG.seiEvmRpc);
  
  // Check Ethereum NTT Manager
  console.log('\n📋 Ethereum NTT Manager Analysis:');
  try {
    const ethContract = new ethers.Contract(CONFIG.ethereum.nttManager, NTT_MANAGER_ABI, ethereumProvider);
    
    const [owner, outbound, inboundFromSei, peerInfo] = await Promise.all([
      ethContract.owner(),
      ethContract.getOutboundLimitParams(),
      ethContract.getInboundLimitParams(40), // Sei EVM chain ID
      ethContract.getPeer(40)
    ]);
    
    console.log('   Contract:', CONFIG.ethereum.nttManager);
    console.log('   Owner:', owner);
    console.log('   Outbound Limit:', ethers.formatEther(outbound.limit), 'tBTC');
    console.log('   Current Inbound Limit (from Sei EVM):', ethers.formatEther(inboundFromSei.limit), 'tBTC');
    console.log('   Peer Address:', peerInfo.peerAddress);
    console.log('   Peer Decimals:', peerInfo.tokenDecimals);
    
    // Calculate what the setPeer call should look like
    const peerAddressFormatted = '0x' + peerInfo.peerAddress.slice(-40);
    console.log('   Peer Address (formatted):', peerAddressFormatted);
    
    console.log('\n💡 PROPOSED SOLUTION for Ethereum:');
    console.log('   Call setPeer() with updated inbound limit:');
    console.log(`   setPeer(`);
    console.log(`     40,                                    // Sei EVM Wormhole chain ID`);
    console.log(`     ${peerInfo.peerAddress},               // Current peer address`);
    console.log(`     ${peerInfo.tokenDecimals},             // Current peer decimals`);
    console.log(`     ${outbound.limit.toString()}           // NEW inbound limit (match outbound)`);
    console.log(`   )`);
    
    // Generate transaction data
    const iface = new ethers.Interface(NTT_MANAGER_ABI);
    const txData = iface.encodeFunctionData('setPeer', [
      40,
      peerInfo.peerAddress,
      peerInfo.tokenDecimals,
      outbound.limit
    ]);
    
    console.log('\n🔗 Transaction Data for Ethereum:');
    console.log('   To:', CONFIG.ethereum.nttManager);
    console.log('   Data:', txData);
    
  } catch (error) {
    console.log('   ❌ Error checking Ethereum:', error.message);
  }
  
  // Check Sei EVM NTT Manager
  console.log('\n📋 Sei EVM NTT Manager Analysis:');
  try {
    const seiContract = new ethers.Contract(CONFIG.seiEvm.nttManager, NTT_MANAGER_ABI, seiEvmProvider);
    
    const [owner, outbound, inboundFromEth, peerInfo] = await Promise.all([
      seiContract.owner(),
      seiContract.getOutboundLimitParams(),
      seiContract.getInboundLimitParams(2), // Ethereum chain ID
      seiContract.getPeer(2)
    ]);
    
    console.log('   Contract:', CONFIG.seiEvm.nttManager);
    console.log('   Owner:', owner);
    console.log('   Outbound Limit:', ethers.formatEther(outbound.limit), 'tBTC');
    console.log('   Current Inbound Limit (from Ethereum):', ethers.formatEther(inboundFromEth.limit), 'tBTC');
    console.log('   Peer Address:', peerInfo.peerAddress);
    console.log('   Peer Decimals:', peerInfo.tokenDecimals);
    
    console.log('\n💡 PROPOSED SOLUTION for Sei EVM:');
    console.log('   Call setPeer() with updated inbound limit:');
    console.log(`   setPeer(`);
    console.log(`     2,                                     // Ethereum Wormhole chain ID`);
    console.log(`     ${peerInfo.peerAddress},               // Current peer address`);
    console.log(`     ${peerInfo.tokenDecimals},             // Current peer decimals`);
    console.log(`     ${outbound.limit.toString()}           // NEW inbound limit (match outbound)`);
    console.log(`   )`);
    
    // Generate transaction data
    const iface = new ethers.Interface(NTT_MANAGER_ABI);
    const txData = iface.encodeFunctionData('setPeer', [
      2,
      peerInfo.peerAddress,
      peerInfo.tokenDecimals,
      outbound.limit
    ]);
    
    console.log('\n🔗 Transaction Data for Sei EVM:');
    console.log('   To:', CONFIG.seiEvm.nttManager);
    console.log('   Data:', txData);
    
  } catch (error) {
    console.log('   ❌ Error checking Sei EVM:', error.message);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 CONCLUSION');
  console.log('='.repeat(80));
  
  console.log('\n🔍 Key Discovery:');
  console.log('   • The inbound limit is likely set as part of the setPeer() function');
  console.log('   • setInboundLimit() might not exist or might not work as expected');
  console.log('   • setPeer() takes: (chainId, peerAddress, decimals, inboundLimit)');
  
  console.log('\n✅ RECOMMENDED APPROACH:');
  console.log('   1. Use setPeer() instead of setInboundLimit()');
  console.log('   2. Keep existing peer address and decimals');
  console.log('   3. Update only the inboundLimit parameter');
  console.log('   4. Set inbound limit to match outbound limit (~4722 tBTC)');
  
  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('   • This will re-establish the peer relationship');
  console.log('   • Make sure peer address and decimals are correct');
  console.log('   • Only the owner can call setPeer()');
  console.log('   • Test on a small amount first if possible');
};

// Run the check
if (require.main === module) {
  checkSetPeerSolution().catch(error => {
    console.error('❌ Check failed:', error.message);
    process.exit(1);
  });
}

module.exports = { checkSetPeerSolution };
