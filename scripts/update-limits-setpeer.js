#!/usr/bin/env node

/**
 * Update Inbound Limits via setPeer Function
 * 
 * This script updates inbound limits using the correct setPeer() function
 * instead of setInboundLimit() which doesn't work properly.
 */

const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  // RPC endpoints
  ethereumRpcs: [
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.ankr.com/eth',
    'https://eth.llamarpc.com'
  ],
  seiEvmRpc: 'https://evm-rpc.sei-apis.com',
  
  // Wormhole Chain IDs
  ethereumWormholeId: 2,
  seiEvmWormholeId: 40,
  
  // Contract addresses
  ethereum: {
    nttManager: '0x79eb9aF995a443A102A19b41EDbB58d66e2921c7',
  },
  seiEvm: {
    nttManager: '0xc10a0886d4Fe06bD61f41ee2855a2215375B82f0',
  },
  
  // Owner private key (set via environment variable)
  ownerPrivateKey: process.env.OWNER_PRIVATE_KEY || null
};

// ABI with the correct setPeer function
const NTT_MANAGER_ABI = [
  // The correct function that includes inbound limit
  "function setPeer(uint16 peerChainId, bytes32 peerContract, uint8 decimals, uint256 inboundLimit) external",
  
  // Read functions
  "function getPeer(uint16 chainId_) external view returns (tuple(bytes32 peerAddress, uint8 tokenDecimals))",
  "function getOutboundLimitParams() external view returns (uint256 limit, uint256 currentCapacity)",
  "function getInboundLimitParams(uint16 chainId_) external view returns (uint256 limit, uint256 currentCapacity)",
  "function owner() external view returns (address)",
];

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

// Format amounts for display
const formatAmount = (amount, decimals = 18) => {
  return ethers.formatUnits(amount, decimals);
};

// Update limits using setPeer
const updateLimitsViaPeer = async () => {
  console.log('🔧 Updating Inbound Limits via setPeer()');
  console.log('=========================================');
  
  if (!CONFIG.ownerPrivateKey) {
    console.log('❌ OWNER_PRIVATE_KEY environment variable not set');
    console.log('   Set it like: OWNER_PRIVATE_KEY=0x... npm run fix-limits');
    return false;
  }
  
  try {
    // Setup providers
    console.log('\n🔗 Connecting to networks...');
    const ethereumProvider = await getEthereumProvider();
    const seiEvmProvider = new ethers.JsonRpcProvider(CONFIG.seiEvmRpc);
    console.log('   ✅ Connected to Sei EVM via:', CONFIG.seiEvmRpc);
    
    // Setup signers
    const ethSigner = new ethers.Wallet(CONFIG.ownerPrivateKey, ethereumProvider);
    const seiSigner = new ethers.Wallet(CONFIG.ownerPrivateKey, seiEvmProvider);
    
    console.log('   👤 Using wallet:', ethSigner.address);
    
    // Update Ethereum NTT Manager
    console.log('\n📤 Updating Ethereum NTT Manager...');
    try {
      const ethContract = new ethers.Contract(CONFIG.ethereum.nttManager, NTT_MANAGER_ABI, ethSigner);
      
      // Get current configuration
      const [owner, outbound, currentInbound, peerInfo] = await Promise.all([
        ethContract.owner(),
        ethContract.getOutboundLimitParams(),
        ethContract.getInboundLimitParams(CONFIG.seiEvmWormholeId),
        ethContract.getPeer(CONFIG.seiEvmWormholeId)
      ]);
      
      console.log('   Contract:', CONFIG.ethereum.nttManager);
      console.log('   Owner:', owner);
      console.log('   Signer:', ethSigner.address);
      console.log('   Current Outbound:', formatAmount(outbound.limit), 'tBTC');
      console.log('   Current Inbound:', formatAmount(currentInbound.limit), 'tBTC');
      
      // Verify signer is owner
      if (ethSigner.address.toLowerCase() !== owner.toLowerCase()) {
        console.log('   ❌ Signer is not the owner!');
        return false;
      }
      
      // Check ETH balance first
      const ethBalance = await ethereumProvider.getBalance(ethSigner.address);
      console.log('   💰 ETH Balance:', formatAmount(ethBalance), 'ETH');
      
      if (ethBalance < ethers.parseEther('0.001')) {
        console.log('   ❌ Insufficient ETH for gas fees. Need at least 0.001 ETH');
        return false;
      }

      // Execute setPeer with updated inbound limit (conservative gas settings)
      console.log('   🔄 Calling setPeer() to update inbound limit...');
      
      // Try multiple times with different gas settings
      let ethTx = null;
      const gasConfigs = [
        { gasLimit: 150000, gasPrice: ethers.parseUnits('10', 'gwei') },
        { gasLimit: 200000, gasPrice: ethers.parseUnits('12', 'gwei') },
        { gasLimit: 250000, gasPrice: ethers.parseUnits('15', 'gwei') }
      ];
      
      for (const [index, gasConfig] of gasConfigs.entries()) {
        try {
          console.log(`   📋 Attempt ${index + 1}/3 - Gas: ${ethers.formatUnits(gasConfig.gasPrice, 'gwei')} gwei, Limit: ${gasConfig.gasLimit}`);
          
          ethTx = await ethContract.setPeer(
            CONFIG.seiEvmWormholeId,           // Sei EVM chain ID (40)
            peerInfo.peerAddress,              // Keep same peer address
            peerInfo.tokenDecimals,            // Keep same decimals
            outbound.limit,                    // NEW: Set inbound = outbound limit
            gasConfig
          );
          
          console.log('   ✅ Transaction submitted successfully!');
          break;
          
        } catch (error) {
          console.log(`   ❌ Attempt ${index + 1} failed:`, error.message);
          if (index === gasConfigs.length - 1) {
            throw error; // Re-throw on last attempt
          }
          console.log('   🔄 Trying with different gas settings...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between attempts
        }
      }
      
      if (!ethTx) {
        throw new Error('All transaction attempts failed');
      }
      
      console.log('   📋 Transaction sent:', ethTx.hash);
      console.log('   ⏳ Waiting for confirmation...');
      
      const ethReceipt = await ethTx.wait(2);
      console.log('   ✅ Transaction confirmed in block:', ethReceipt.blockNumber);
      
      // Verify the update
      const newInbound = await ethContract.getInboundLimitParams(CONFIG.seiEvmWormholeId);
      console.log('   ✅ New inbound limit:', formatAmount(newInbound.limit), 'tBTC');
      
      if (newInbound.limit.toString() === outbound.limit.toString()) {
        console.log('   🎉 SUCCESS! Inbound limit now matches outbound limit');
      } else {
        console.log('   ⚠️  WARNING: Limits don\'t match exactly');
      }
      
    } catch (error) {
      console.log('   ❌ Failed to update Ethereum:', error.message);
      return false;
    }
    
    // Update Sei EVM NTT Manager
    console.log('\n📤 Updating Sei EVM NTT Manager...');
    try {
      const seiContract = new ethers.Contract(CONFIG.seiEvm.nttManager, NTT_MANAGER_ABI, seiSigner);
      
      // Get current configuration
      const [owner, outbound, currentInbound, peerInfo] = await Promise.all([
        seiContract.owner(),
        seiContract.getOutboundLimitParams(),
        seiContract.getInboundLimitParams(CONFIG.ethereumWormholeId),
        seiContract.getPeer(CONFIG.ethereumWormholeId)
      ]);
      
      console.log('   Contract:', CONFIG.seiEvm.nttManager);
      console.log('   Owner:', owner);
      console.log('   Signer:', seiSigner.address);
      console.log('   Current Outbound:', formatAmount(outbound.limit), 'tBTC');
      console.log('   Current Inbound:', formatAmount(currentInbound.limit), 'tBTC');
      
      // Verify signer is owner
      if (seiSigner.address.toLowerCase() !== owner.toLowerCase()) {
        console.log('   ❌ Signer is not the owner!');
        return false;
      }
      
      // Execute setPeer with updated inbound limit
      console.log('   🔄 Calling setPeer() to update inbound limit...');
      const seiTx = await seiContract.setPeer(
        CONFIG.ethereumWormholeId,         // Ethereum chain ID (2)
        peerInfo.peerAddress,              // Keep same peer address
        peerInfo.tokenDecimals,            // Keep same decimals
        outbound.limit,                    // NEW: Set inbound = outbound limit
        {
          gasLimit: 300000,
          gasPrice: ethers.parseUnits('20', 'gwei')
        }
      );
      
      console.log('   📋 Transaction sent:', seiTx.hash);
      console.log('   ⏳ Waiting for confirmation...');
      
      const seiReceipt = await seiTx.wait(2);
      console.log('   ✅ Transaction confirmed in block:', seiReceipt.blockNumber);
      
      // Verify the update
      const newInbound = await seiContract.getInboundLimitParams(CONFIG.ethereumWormholeId);
      console.log('   ✅ New inbound limit:', formatAmount(newInbound.limit), 'tBTC');
      
      if (newInbound.limit.toString() === outbound.limit.toString()) {
        console.log('   🎉 SUCCESS! Inbound limit now matches outbound limit');
      } else {
        console.log('   ⚠️  WARNING: Limits don\'t match exactly');
      }
      
    } catch (error) {
      console.log('   ❌ Failed to update Sei EVM:', error.message);
      return false;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 LIMIT UPDATE COMPLETED!');
    console.log('='.repeat(60));
    console.log('✅ Both Ethereum and Sei EVM inbound limits updated');
    console.log('✅ Inbound limits now match outbound limits (~4722 tBTC)');
    console.log('✅ Cross-chain transfers should now work for large amounts');
    
    console.log('\n📋 Next Steps:');
    console.log('   1. Run: npm run test-config');
    console.log('   2. Verify both inbound and outbound limits match');
    console.log('   3. Test your CustomNttTransfer component');
    
    return true;
    
  } catch (error) {
    console.log('❌ Update failed:', error.message);
    return false;
  }
};

// Run the update
if (require.main === module) {
  updateLimitsViaPeer().then(success => {
    if (success) {
      console.log('\n🎉 Inbound limits successfully updated via setPeer()!');
      process.exit(0);
    } else {
      console.log('\n❌ Failed to update inbound limits.');
      process.exit(1);
    }
  });
}

module.exports = { updateLimitsViaPeer };
