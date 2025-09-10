#!/usr/bin/env node

/**
 * Check Minting Privileges
 * 
 * This script checks if the NTT Manager has proper minting privileges on the tBTC token
 */

const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  seiEvmRpc: 'https://evm-rpc.sei-apis.com',
  seiEvmNttManager: '0xc10a0886d4Fe06bD61f41ee2855a2215375B82f0',
  tbtcTokenSei: '0xF9201c9192249066Aec049ae7951ae298BBEc767',
};

// Extended ERC20 ABI with minting functions
const MINTABLE_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
  
  // Minting related functions
  "function isMinter(address account) external view returns (bool)",
  "function getMinter(address account) external view returns (bool)", // Alternative name
  "function minters(address account) external view returns (bool)", // Another alternative
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function MINTER_ROLE() external view returns (bytes32)",
  
  // Owner functions
  "function owner() external view returns (address)",
  
  // Try to call mint function (will fail if no permission, but we can check the error)
  "function mint(address to, uint256 amount) external",
];

const checkMintingPrivileges = async () => {
  console.log('🔍 Checking Minting Privileges');
  console.log('===============================');
  
  try {
    // Setup provider
    const provider = new ethers.JsonRpcProvider(CONFIG.seiEvmRpc);
    console.log('✅ Connected to Sei EVM:', CONFIG.seiEvmRpc);
    
    // Test token contract
    const tbtcToken = new ethers.Contract(CONFIG.tbtcTokenSei, MINTABLE_TOKEN_ABI, provider);
    
    console.log('\n🪙 Token Contract Info:');
    console.log('   Address:', CONFIG.tbtcTokenSei);
    
    // Get basic token info
    const [symbol, decimals, totalSupply, name] = await Promise.allSettled([
      tbtcToken.symbol(),
      tbtcToken.decimals(), 
      tbtcToken.totalSupply(),
      tbtcToken.name()
    ]);
    
    console.log('   Name:', name.status === 'fulfilled' ? name.value : 'N/A');
    console.log('   Symbol:', symbol.status === 'fulfilled' ? symbol.value : 'N/A');
    console.log('   Decimals:', decimals.status === 'fulfilled' ? decimals.value.toString() : 'N/A');
    console.log('   Total Supply:', totalSupply.status === 'fulfilled' ? 
      ethers.formatUnits(totalSupply.value, decimals.status === 'fulfilled' ? decimals.value : 18) : 'N/A');
    
    console.log('\n🔐 Checking Minting Privileges for NTT Manager:');
    console.log('   NTT Manager:', CONFIG.seiEvmNttManager);
    
    // Try different minting privilege check methods
    const methods = [
      { name: 'isMinter', func: () => tbtcToken.isMinter(CONFIG.seiEvmNttManager) },
      { name: 'getMinter', func: () => tbtcToken.getMinter(CONFIG.seiEvmNttManager) },
      { name: 'minters', func: () => tbtcToken.minters(CONFIG.seiEvmNttManager) },
    ];
    
    let hasMintingPrivileges = false;
    
    for (const method of methods) {
      try {
        const result = await method.func();
        console.log(`   ✅ ${method.name}(): ${result}`);
        if (result === true) {
          hasMintingPrivileges = true;
        }
      } catch (error) {
        console.log(`   ❌ ${method.name}(): Not available (${error.message.split('(')[0]})`);
      }
    }
    
    // Try role-based access control
    try {
      const minterRole = await tbtcToken.MINTER_ROLE();
      const hasRole = await tbtcToken.hasRole(minterRole, CONFIG.seiEvmNttManager);
      console.log(`   ✅ hasRole(MINTER_ROLE): ${hasRole}`);
      if (hasRole === true) {
        hasMintingPrivileges = true;
      }
    } catch (error) {
      console.log(`   ❌ Role-based check: Not available (${error.message.split('(')[0]})`);
    }
    
    // Check owner
    try {
      const owner = await tbtcToken.owner();
      console.log(`   📋 Token Owner: ${owner}`);
      if (owner.toLowerCase() === CONFIG.seiEvmNttManager.toLowerCase()) {
        console.log('   ✅ NTT Manager is the token owner (has all privileges)');
        hasMintingPrivileges = true;
      }
    } catch (error) {
      console.log(`   ❌ Owner check: Not available (${error.message.split('(')[0]})`);
    }
    
    console.log('\n🎯 MINTING PRIVILEGES SUMMARY:');
    if (hasMintingPrivileges) {
      console.log('   ✅ NTT Manager HAS minting privileges');
      console.log('   ✅ Should be able to mint tokens for incoming transfers');
    } else {
      console.log('   ❌ NTT Manager DOES NOT have minting privileges');
      console.log('   ❌ This would cause destination transaction failures');
    }
    
    console.log('\n💡 DIAGNOSIS:');
    if (hasMintingPrivileges) {
      console.log('   ✅ Minting privileges are correctly configured');
      console.log('   ✅ Zero supply is normal for mint-and-burn tokens');
      console.log('   🔍 The simulation failure might be due to other factors:');
      console.log('      - Gas estimation issues on Sei EVM');
      console.log('      - Contract interaction problems');
      console.log('      - Network-specific issues');
    } else {
      console.log('   ❌ ISSUE: NTT Manager lacks minting privileges');
      console.log('   🛠️  SOLUTION: Grant minting privileges to NTT Manager');
      console.log(`      Call: token.addMinter("${CONFIG.seiEvmNttManager}")`);
    }
    
  } catch (error) {
    console.log('❌ Error checking minting privileges:', error.message);
  }
};

// Run the check
if (require.main === module) {
  checkMintingPrivileges();
}

module.exports = { checkMintingPrivileges };
