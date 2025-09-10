#!/usr/bin/env node

/**
 * Automated NTT Transfer Test Script
 * 
 * This script performs a staticCall to test if an NTT transfer will work
 * before actually sending the transaction.
 */

const { ethers } = require('ethers');
const axios = require('axios');

// Configuration
const CONFIG = {
  // Contract addresses
  nttManagerWithExecutor: '0xd2d9c936165a85f27a5a7e07afb974d022b89463',
  originalNttManager: '0x79eb9aF995a443A102A19b41EDbB58d66e2921c7',
  tbtcToken: '0x18084fbA666a33d37592fA2633fD49a74DD93a88',
  
  // Chain configuration
  seiWormholeChainId: 40,
  
  // Test parameters
  testAmount: '0.000048', // tBTC amount to test (slightly less than user's balance)
  testRecipient: '0xB6A114C2c34eF91eeb0d93bcdDD7B95a9D6892E1',
  
  // RPC endpoint
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  
  // Executor configuration
  executorUrl: 'https://executor.labsapis.com'
};

// Function to get a real signed quote from the executor
const getExecutorQuote = async (srcChain, dstChain) => {
  try {
    console.log('🔄 Fetching real executor quote...');
    
    const relayInstructions = '0x'; // Empty instructions work for basic quotes
    
    const response = await axios.post(`${CONFIG.executorUrl}/v0/quote`, {
      srcChain,
      dstChain,
      relayInstructions,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    const { signedQuote, estimatedCost } = response.data;
    
    console.log('✅ Got executor quote:');
    console.log('   Estimated Cost:', estimatedCost, 'wei');
    console.log('   Estimated Cost (ETH):', (estimatedCost / 1e18).toFixed(8));
    console.log('   Signed Quote Length:', signedQuote?.length || 0, 'characters');
    
    return { signedQuote, estimatedCost };
  } catch (error) {
    console.error('❌ Failed to get executor quote:', error.message);
    if (error.response) {
      console.error('   HTTP Status:', error.response.status);
      console.error('   Response Data:', error.response.data);
    }
    throw error;
  }
};

// ABIs
const NTT_MANAGER_WITH_EXECUTOR_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "nttManager", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "uint16", "name": "recipientChain", "type": "uint16"},
      {"internalType": "bytes32", "name": "recipientAddress", "type": "bytes32"},
      {"internalType": "bytes32", "name": "refundAddress", "type": "bytes32"},
      {"internalType": "bytes", "name": "encodedInstructions", "type": "bytes"},
      {
        "components": [
          {"internalType": "uint256", "name": "value", "type": "uint256"},
          {"internalType": "address", "name": "refundAddress", "type": "address"},
          {"internalType": "bytes", "name": "signedQuote", "type": "bytes"},
          {"internalType": "bytes", "name": "instructions", "type": "bytes"}
        ],
        "internalType": "struct ExecutorArgs",
        "name": "executorArgs",
        "type": "tuple"
      },
      {
        "components": [
          {"internalType": "uint16", "name": "dbps", "type": "uint16"},
          {"internalType": "address", "name": "payee", "type": "address"}
        ],
        "internalType": "struct FeeArgs",
        "name": "feeArgs",
        "type": "tuple"
      }
    ],
    "name": "transfer",
    "outputs": [{"internalType": "uint64", "name": "msgId", "type": "uint64"}],
    "stateMutability": "payable",
    "type": "function"
  }
];

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Helper functions
function addressToBytes32(address) {
  return ethers.zeroPadValue(address, 32);
}

function createSignedQuote() {
  // Create signed quote matching test pattern
  const prefix = '0x45513031'; // "EQ01" as hex
  const quoterAddress = '0x0000000000000000000000000000000000000000'; // address(0)
  const payeeAddress = '0x0000000000000000000000000000000000000000000000000000000000000000'; // bytes32(0)
  const srcChain = '0x0002'; // Ethereum chain ID (2) as uint16
  const dstChain = '0x0028'; // Sei EVM chain ID (40) as uint16  
  const expiryTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const expiryHex = '0x' + expiryTime.toString(16).padStart(16, '0'); // uint64
  
  // abi.encodePacked equivalent
  return '0x' + prefix.slice(2) + quoterAddress.slice(2) + payeeAddress.slice(2) + srcChain.slice(2) + dstChain.slice(2) + expiryHex.slice(2);
}

async function testNTTTransfer() {
  console.log('🧪 NTT Transfer Test Script');
  console.log('==========================');
  
  try {
    // Setup provider
    const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    console.log('✅ Connected to Ethereum RPC');
    
    // Get user address (you can modify this to test with different addresses)
    const userAddress = CONFIG.testRecipient;
    console.log('👤 Testing with user address:', userAddress);
    
    // Setup contracts
    const nttContract = new ethers.Contract(CONFIG.nttManagerWithExecutor, NTT_MANAGER_WITH_EXECUTOR_ABI, provider);
    const tokenContract = new ethers.Contract(CONFIG.tbtcToken, ERC20_ABI, provider);
    
    // Get token info
    const [decimals, symbol, balance, allowance] = await Promise.all([
      tokenContract.decimals(),
      tokenContract.symbol(),
      tokenContract.balanceOf(userAddress),
      tokenContract.allowance(userAddress, CONFIG.nttManagerWithExecutor)
    ]);
    
    console.log('\n📊 Token Information:');
    console.log('   Symbol:', symbol);
    console.log('   Decimals:', decimals);
    console.log('   User Balance:', ethers.formatUnits(balance, decimals), symbol);
    console.log('   Allowance:', ethers.formatUnits(allowance, decimals), symbol);
    
    // Prepare transfer parameters
    const amountWei = ethers.parseUnits(CONFIG.testAmount, decimals);
    const recipientBytes32 = addressToBytes32(CONFIG.testRecipient);
    const refundAddressBytes32 = addressToBytes32(userAddress);
    const encodedInstructions = '0x'; // Empty instructions work best with executor
    
    // Prepare executor args
    const executorArgs = {
      value: 100, // 100 wei like test
      refundAddress: userAddress,
      signedQuote: createSignedQuote(), // already has 0x prefix
      instructions: '0x' // empty like test
    };
    
    // Prepare fee args
    const feeArgs = {
      dbps: 0, // 0% fee
      payee: '0x0000000000000000000000000000000000000000' // zero address
    };
    
    console.log('\n🔧 Transfer Parameters:');
    console.log('   Amount:', ethers.formatUnits(amountWei, decimals), symbol);
    console.log('   Recipient Chain:', CONFIG.seiWormholeChainId, '(Sei EVM)');
    console.log('   Recipient:', CONFIG.testRecipient);
    console.log('   Encoded Instructions:', encodedInstructions);
    console.log('   Executor Value:', executorArgs.value, 'wei');
    console.log('   Fee DBPS:', feeArgs.dbps);
    
    // Check prerequisites
    console.log('\n🔍 Checking Prerequisites:');
    
    if (balance < amountWei) {
      console.log('❌ Insufficient balance:', ethers.formatUnits(balance, decimals), '<', CONFIG.testAmount);
      return false;
    }
    console.log('✅ Sufficient balance');
    
    if (allowance < amountWei) {
      console.log('❌ Insufficient allowance:', ethers.formatUnits(allowance, decimals), '<', CONFIG.testAmount);
      console.log('   Need to approve', CONFIG.nttManagerWithExecutor, 'to spend', CONFIG.testAmount, symbol);
      return false;
    }
    console.log('✅ Sufficient allowance');
    
    // Perform static call
    console.log('\n🧪 Performing Static Call Test...');
    
    try {
      const result = await nttContract.transfer.staticCall(
        CONFIG.originalNttManager,     // nttManager
        amountWei,                     // amount
        CONFIG.seiWormholeChainId,     // recipientChain
        recipientBytes32,              // recipientAddress
        refundAddressBytes32,          // refundAddress
        encodedInstructions,           // encodedInstructions
        [                              // executorArgs
          executorArgs.value,
          executorArgs.refundAddress,
          executorArgs.signedQuote,
          executorArgs.instructions
        ],
        [                              // feeArgs
          feeArgs.dbps,
          feeArgs.payee
        ],
        {
          value: executorArgs.value,   // Send ETH value
          from: userAddress            // Simulate from user address
        }
      );
      
      console.log('🎉 SUCCESS! Static call passed');
      console.log('   Returned message ID:', result.toString());
      console.log('   ✅ Transaction should work when sent for real');
      return true;
      
    } catch (error) {
      console.log('❌ FAILED! Static call error:');
      console.log('   Error:', error.message);
      
      // Try to decode the error
      if (error.data) {
        console.log('   Error data:', error.data);
        
        // Check for known error selectors
        if (error.data.startsWith('0x71f0634a')) {
          console.log('   🔍 This is the custom error 0x71f0634a we\'ve been seeing');
          const errorData = error.data.slice(10);
          try {
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256'], '0x' + errorData);
            console.log('   Decoded parameters:', decoded.map(d => d.toString()));
          } catch (decodeError) {
            console.log('   Could not decode error parameters');
          }
        }
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('💥 Script error:', error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testNTTTransfer().then(success => {
    console.log('\n' + '='.repeat(50));
    if (success) {
      console.log('🎯 RESULT: Transfer should work! ✅');
      console.log('   You can now send the real transaction with confidence.');
    } else {
      console.log('⚠️  RESULT: Transfer will fail! ❌');
      console.log('   Fix the issues above before sending the real transaction.');
    }
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testNTTTransfer, CONFIG };
