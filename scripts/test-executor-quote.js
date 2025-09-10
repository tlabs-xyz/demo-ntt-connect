#!/usr/bin/env node

/**
 * Test Executor Quote Script
 * 
 * This script tests getting a real signed quote from the Wormhole executor
 * for use with NttManagerWithExecutor transfers.
 */

const axios = require('axios');

// Configuration
const EXECUTOR_URL = "https://executor.labsapis.com";
const SRC_CHAIN = 2;  // Ethereum
const DST_CHAIN = 40; // Sei EVM

// Helper function to serialize relay instructions as hex
// This creates the relayInstructions for the executor quote
const serializeRelayInstructions = () => {
  // CRITICAL FIX: Use exact working testnet gas instruction
  // This specifies 500,000 gas limit at byte position 13 (0x7a120)
  const workingGasInstruction = '0x010000000000000000000000000007a12000000000000000000000000000000000';
  console.log('   🔧 Using working testnet gas instruction (500,000 gas limit)');
  return workingGasInstruction;
};

// Function to get a real signed quote from the executor
const getExecutorQuote = async (srcChain, dstChain) => {
  try {
    console.log('🔄 Fetching executor quote from:', EXECUTOR_URL);
    console.log('   Source Chain:', srcChain, '(Ethereum)');
    console.log('   Destination Chain:', dstChain, '(Sei EVM)');
    
    const relayInstructions = serializeRelayInstructions();
    console.log('   Relay Instructions (hex):', relayInstructions);
    console.log('   Relay Instructions Length:', relayInstructions.length - 2, 'hex chars,', (relayInstructions.length - 2) / 2, 'bytes');
    
    const requestPayload = {
      srcChain,
      dstChain,
      relayInstructions,
    };
    
    console.log('\n📤 Request Payload:');
    console.log(JSON.stringify(requestPayload, null, 2));
    
    const response = await axios.post(`${EXECUTOR_URL}/v0/quote`, requestPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });
    
    console.log('\n📥 Response Status:', response.status);
    console.log('📥 Response Headers:', response.headers);
    
    const { signedQuote, estimatedCost } = response.data;
    
    console.log('\n✅ Successfully got executor quote!');
    console.log('   Estimated Cost:', estimatedCost, 'wei');
    console.log('   Estimated Cost (ETH):', estimatedCost ? (estimatedCost / 1e18).toFixed(8) : 'N/A');
    console.log('   Signed Quote Length:', signedQuote?.length || 0, 'characters');
    console.log('   Signed Quote Type:', typeof signedQuote);
    
    if (signedQuote) {
      console.log('   Signed Quote (first 100 chars):', signedQuote.substring(0, 100) + '...');
      console.log('   Signed Quote (last 50 chars):', '...' + signedQuote.substring(signedQuote.length - 50));
      
      // Analyze the quote structure
      if (signedQuote.startsWith('0x')) {
        console.log('   ✅ Quote has proper 0x prefix');
        console.log('   Quote hex length:', signedQuote.length - 2, 'hex characters');
        console.log('   Quote byte length:', (signedQuote.length - 2) / 2, 'bytes');
      } else {
        console.log('   ❌ Quote missing 0x prefix');
      }
    }
    
    console.log('\n📋 Full Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return { signedQuote, estimatedCost, fullResponse: response.data };
    
  } catch (error) {
    console.error('\n❌ Failed to get executor quote:');
    console.error('   Error Message:', error.message);
    
    if (error.response) {
      console.error('   HTTP Status:', error.response.status);
      console.error('   Response Data:', error.response.data);
      console.error('   Response Headers:', error.response.headers);
    } else if (error.request) {
      console.error('   No response received');
      console.error('   Request:', error.request);
    } else {
      console.error('   Request setup error:', error.message);
    }
    
    throw error;
  }
};

// Helper function to create different hex-encoded relay instruction formats
const createHexInstructions = (gasLimit, msgValue) => {
  const buffer = Buffer.alloc(65); // 1 + 32 + 32 bytes
  buffer[0] = 0x01; // GasInstruction type
  
  const gasLimitHex = BigInt(gasLimit).toString(16).padStart(64, '0');
  Buffer.from(gasLimitHex, 'hex').copy(buffer, 1);
  
  const msgValueHex = BigInt(msgValue).toString(16).padStart(64, '0');
  Buffer.from(msgValueHex, 'hex').copy(buffer, 33);
  
  return '0x' + buffer.toString('hex');
};

// Test different relay instruction formats
const testDifferentFormats = async () => {
  console.log('\n🧪 Testing different relay instruction formats...\n');
  
  const formats = [
    {
      name: 'Empty instructions',
      instructions: '0x'
    },
    {
      name: 'GasLimit 500000, MsgValue 0',
      instructions: createHexInstructions(500000, 0)
    },
    {
      name: 'GasLimit 1000000, MsgValue 0', 
      instructions: createHexInstructions(1000000, 0)
    },
    {
      name: 'GasLimit 300000, MsgValue 0',
      instructions: createHexInstructions(300000, 0)
    }
  ];
  
  for (const format of formats) {
    console.log(`\n--- Testing: ${format.name} ---`);
    try {
      const response = await axios.post(`${EXECUTOR_URL}/v0/quote`, {
        srcChain: SRC_CHAIN,
        dstChain: DST_CHAIN,
        relayInstructions: format.instructions,
      }, { timeout: 5000 });
      
      console.log('✅ SUCCESS with', format.name);
      console.log('   Estimated Cost:', response.data.estimatedCost);
      console.log('   Quote Length:', response.data.signedQuote?.length || 0);
      
    } catch (error) {
      console.log('❌ FAILED with', format.name);
      console.log('   Error:', error.response?.data || error.message);
    }
  }
};

// Main test function
const testExecutorQuote = async () => {
  console.log('🧪 Executor Quote Test Script');
  console.log('=============================');
  
  try {
    // Test basic quote fetching
    const result = await getExecutorQuote(SRC_CHAIN, DST_CHAIN);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 BASIC TEST RESULT:');
    if (result.signedQuote && result.estimatedCost) {
      console.log('✅ SUCCESS! Got valid quote and cost');
      console.log('   Ready for use in NttManagerWithExecutor');
    } else {
      console.log('❌ INCOMPLETE! Missing quote or cost');
    }
    
    // Test different formats
    await testDifferentFormats();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 EXECUTOR QUOTE TEST COMPLETED!');
    
    return result;
    
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('💥 EXECUTOR QUOTE TEST FAILED!');
    console.log('   Error:', error.message);
    
    return null;
  }
};

// Run the test
if (require.main === module) {
  testExecutorQuote().then(result => {
    if (result) {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    } else {
      console.log('\n❌ Test failed');
      process.exit(1);
    }
  });
}

module.exports = { getExecutorQuote, testExecutorQuote };
