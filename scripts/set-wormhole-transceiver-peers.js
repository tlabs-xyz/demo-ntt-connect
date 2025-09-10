#!/usr/bin/env node

const { ethers } = require('ethers')
const fs = require('fs')
const path = require('path')

// Load deployment configuration
const deploymentPath = path.join(__dirname, '../deployment.json')
const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))

// Network configuration with multiple RPC endpoints for reliability
const ETHEREUM_RPCS = [
  'https://eth.llamarpc.com',
  'https://ethereum.publicnode.com',
  'https://rpc.ankr.com/eth',
  'https://ethereum-rpc.publicnode.com'
]
const SEI_EVM_RPCS = [
  'https://evm-rpc.sei-apis.com',
  'https://evm-rpc-testnet.sei-apis.com'  // fallback if needed
]

// Extract addresses from deployment.json
const ETHEREUM_TRANSCEIVER = deployment.chains.Ethereum.transceiver
const SEI_EVM_TRANSCEIVER = deployment.chains.Seievm.transceiver
const OWNER_ADDRESS = deployment.chains.Ethereum.owner // Same owner for both chains

// Wormhole chain IDs
const ETHEREUM_WORMHOLE_CHAIN_ID = 2
const SEI_EVM_WORMHOLE_CHAIN_ID = 40

// Wormhole Transceiver ABI (minimal for setWormholePeer)
const WORMHOLE_TRANSCEIVER_ABI = [
  {
    "inputs": [
      {"name": "peerChainId", "type": "uint16"},
      {"name": "peerContract", "type": "bytes32"}
    ],
    "name": "setWormholePeer",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "chainId", "type": "uint16"}],
    "name": "getPeer",
    "outputs": [{"name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  }
]

// Helper function to convert address to bytes32 (left-padded with zeros)
function addressToBytes32(address) {
  // Remove 0x prefix if present, convert to lowercase
  const cleanAddress = address.toLowerCase().replace('0x', '')
  
  // Pad with zeros to make it 64 characters (32 bytes)
  const paddedAddress = '0x' + '0'.repeat(24) + cleanAddress
  
  return paddedAddress
}

// Helper function to create provider with retry logic
async function createReliableProvider(rpcUrls, chainName) {
  for (let i = 0; i < rpcUrls.length; i++) {
    try {
      console.log(`   Trying ${chainName} RPC ${i + 1}/${rpcUrls.length}: ${rpcUrls[i]}`)
      const provider = new ethers.JsonRpcProvider(rpcUrls[i])
      
      // Test the connection
      await provider.getNetwork()
      console.log(`   ✅ ${chainName} RPC connection successful`)
      return provider
    } catch (error) {
      console.log(`   ❌ ${chainName} RPC ${i + 1} failed: ${error.message}`)
      if (i === rpcUrls.length - 1) {
        throw new Error(`All ${chainName} RPC endpoints failed`)
      }
    }
  }
}

// Helper function to execute transaction with retry logic
async function executeTransactionWithRetry(contract, functionName, args, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/${maxRetries}...`)
      
      // Estimate gas first
      const gasEstimate = await contract[functionName].estimateGas(...args, options)
      const gasLimit = gasEstimate * 120n / 100n // Add 20% buffer
      
      console.log(`   Gas estimate: ${gasEstimate.toString()}, using: ${gasLimit.toString()}`)
      
      // Execute transaction
      const tx = await contract[functionName](...args, { ...options, gasLimit })
      console.log(`   Transaction sent: ${tx.hash}`)
      
      // Wait for confirmation
      const receipt = await tx.wait()
      console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`)
      
      return { tx, receipt }
    } catch (error) {
      console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`)
      
      if (attempt === maxRetries) {
        throw error
      }
      
      // Wait before retry
      console.log(`   Waiting 5 seconds before retry...`)
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
}

async function setWormholeTransceiverPeers() {
  console.log('🔧 WORMHOLE TRANSCEIVER PEER SETUP')
  console.log('===================================')
  console.log('⚠️  CRITICAL: This script will set Wormhole Transceiver peers')
  console.log('⚠️  This operation can only be done ONCE and requires owner privileges')
  console.log('⚠️  DO NOT RUN without careful review!')
  console.log('')

  console.log('📋 Configuration from deployment.json:')
  console.log(`   Ethereum Transceiver: ${ETHEREUM_TRANSCEIVER}`)
  console.log(`   Sei EVM Transceiver:  ${SEI_EVM_TRANSCEIVER}`)
  console.log(`   Owner Address:        ${OWNER_ADDRESS}`)
  console.log('')

  // Convert addresses to bytes32 format
  const ethereumTransceiverBytes32 = addressToBytes32(ETHEREUM_TRANSCEIVER)
  const seiEvmTransceiverBytes32 = addressToBytes32(SEI_EVM_TRANSCEIVER)

  console.log('🔄 Address Conversion to bytes32:')
  console.log(`   Ethereum Transceiver (bytes32): ${ethereumTransceiverBytes32}`)
  console.log(`   Sei EVM Transceiver (bytes32):  ${seiEvmTransceiverBytes32}`)
  console.log('')

  console.log('📝 REQUIRED TRANSACTIONS:')
  console.log('=========================')
  console.log('')

  console.log('1️⃣  ETHEREUM TRANSCEIVER → SET SEI EVM PEER')
  console.log('   Contract:', ETHEREUM_TRANSCEIVER)
  console.log('   Function: setWormholePeer(uint16 peerChainId, bytes32 peerContract)')
  console.log('   Parameters:')
  console.log(`     peerChainId: ${SEI_EVM_WORMHOLE_CHAIN_ID} (Sei EVM Wormhole Chain ID)`)
  console.log(`     peerContract: ${seiEvmTransceiverBytes32}`)
  console.log('   Call Data:')
  
  const ethereumInterface = new ethers.Interface(WORMHOLE_TRANSCEIVER_ABI)
  const ethereumCallData = ethereumInterface.encodeFunctionData('setWormholePeer', [
    SEI_EVM_WORMHOLE_CHAIN_ID,
    seiEvmTransceiverBytes32
  ])
  console.log(`     ${ethereumCallData}`)
  console.log('')

  console.log('2️⃣  SEI EVM TRANSCEIVER → SET ETHEREUM PEER')
  console.log('   Contract:', SEI_EVM_TRANSCEIVER)
  console.log('   Function: setWormholePeer(uint16 peerChainId, bytes32 peerContract)')
  console.log('   Parameters:')
  console.log(`     peerChainId: ${ETHEREUM_WORMHOLE_CHAIN_ID} (Ethereum Wormhole Chain ID)`)
  console.log(`     peerContract: ${ethereumTransceiverBytes32}`)
  console.log('   Call Data:')
  
  const seiEvmCallData = ethereumInterface.encodeFunctionData('setWormholePeer', [
    ETHEREUM_WORMHOLE_CHAIN_ID,
    ethereumTransceiverBytes32
  ])
  console.log(`     ${seiEvmCallData}`)
  console.log('')

  // Check if we have the owner private key
  const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY
  
  if (!ownerPrivateKey) {
    console.log('⚠️  OWNER_PRIVATE_KEY not provided')
    console.log('   To execute these transactions, run:')
    console.log('   export OWNER_PRIVATE_KEY="your_private_key_here"')
    console.log('   node scripts/set-wormhole-transceiver-peers.js --execute')
    console.log('')
    console.log('📋 MANUAL EXECUTION INSTRUCTIONS:')
    console.log('=================================')
    console.log('If you prefer to execute manually via MetaMask or another wallet:')
    console.log('')
    console.log('1. Connect to Ethereum mainnet with owner wallet')
    console.log(`2. Call setWormholePeer(${SEI_EVM_WORMHOLE_CHAIN_ID}, "${seiEvmTransceiverBytes32}") on ${ETHEREUM_TRANSCEIVER}`)
    console.log('')
    console.log('3. Connect to Sei EVM mainnet with owner wallet')
    console.log(`4. Call setWormholePeer(${ETHEREUM_WORMHOLE_CHAIN_ID}, "${ethereumTransceiverBytes32}") on ${SEI_EVM_TRANSCEIVER}`)
    console.log('')
    return
  }

  // Check if --execute flag is provided
  const shouldExecute = process.argv.includes('--execute')
  
  if (!shouldExecute) {
    console.log('⚠️  DRY RUN MODE - No transactions will be sent')
    console.log('   To execute, add --execute flag:')
    console.log('   node scripts/set-wormhole-transceiver-peers.js --execute')
    console.log('')
    return
  }

  console.log('🚀 EXECUTING TRANSACTIONS...')
  console.log('============================')

  try {
    // Create reliable providers
    console.log('🔌 Connecting to RPC endpoints...')
    const ethereumProvider = await createReliableProvider(ETHEREUM_RPCS, 'Ethereum')
    const seiEvmProvider = await createReliableProvider(SEI_EVM_RPCS, 'Sei EVM')
    
    const ethereumWallet = new ethers.Wallet(ownerPrivateKey, ethereumProvider)
    const seiEvmWallet = new ethers.Wallet(ownerPrivateKey, seiEvmProvider)

    // Setup contracts
    const ethereumTransceiver = new ethers.Contract(
      ETHEREUM_TRANSCEIVER,
      WORMHOLE_TRANSCEIVER_ABI,
      ethereumWallet
    )
    
    const seiEvmTransceiver = new ethers.Contract(
      SEI_EVM_TRANSCEIVER,
      WORMHOLE_TRANSCEIVER_ABI,
      seiEvmWallet
    )

    // Verify ownership
    console.log('🔍 Verifying ownership...')
    const ethereumOwner = await ethereumTransceiver.owner()
    const seiEvmOwner = await seiEvmTransceiver.owner()
    
    console.log(`   Ethereum Transceiver Owner: ${ethereumOwner}`)
    console.log(`   Sei EVM Transceiver Owner:  ${seiEvmOwner}`)
    console.log(`   Our Address:                ${ethereumWallet.address}`)
    
    if (ethereumOwner.toLowerCase() !== ethereumWallet.address.toLowerCase()) {
      throw new Error('❌ Not owner of Ethereum Transceiver!')
    }
    
    if (seiEvmOwner.toLowerCase() !== seiEvmWallet.address.toLowerCase()) {
      throw new Error('❌ Not owner of Sei EVM Transceiver!')
    }
    
    console.log('   ✅ Ownership verified!')
    console.log('')

    // Execute Transaction 1: Set Sei EVM peer on Ethereum Transceiver
    console.log('1️⃣  Setting Sei EVM peer on Ethereum Transceiver...')
    const result1 = await executeTransactionWithRetry(
      ethereumTransceiver,
      'setWormholePeer',
      [SEI_EVM_WORMHOLE_CHAIN_ID, seiEvmTransceiverBytes32],
      { value: 0 } // No message fee for peer setup
    )
    console.log('')

    // Execute Transaction 2: Set Ethereum peer on Sei EVM Transceiver
    console.log('2️⃣  Setting Ethereum peer on Sei EVM Transceiver...')
    const result2 = await executeTransactionWithRetry(
      seiEvmTransceiver,
      'setWormholePeer',
      [ETHEREUM_WORMHOLE_CHAIN_ID, ethereumTransceiverBytes32],
      { value: 0 } // No message fee for peer setup
    )
    console.log('')

    console.log('🎉 SUCCESS!')
    console.log('============')
    console.log('✅ Wormhole Transceiver peers have been set successfully!')
    console.log('✅ Cross-chain NTT transfers should now work without InvalidWormholePeer errors')
    console.log('')
    console.log('📋 Summary:')
    console.log(`   Ethereum Transceiver now recognizes Sei EVM chain ${SEI_EVM_WORMHOLE_CHAIN_ID}`)
    console.log(`   Sei EVM Transceiver now recognizes Ethereum chain ${ETHEREUM_WORMHOLE_CHAIN_ID}`)

  } catch (error) {
    console.error('❌ Error executing transactions:', error.message)
    console.error('   Full error:', error)
  }
}

// Show help if no arguments
if (process.argv.length === 2) {
  console.log('🔧 Wormhole Transceiver Peer Setup Script')
  console.log('==========================================')
  console.log('')
  console.log('This script sets up mutual peer relationships between:')
  console.log('- Ethereum Wormhole Transceiver')
  console.log('- Sei EVM Wormhole Transceiver')
  console.log('')
  console.log('Usage:')
  console.log('  node scripts/set-wormhole-transceiver-peers.js              # Dry run (show what will be done)')
  console.log('  export OWNER_PRIVATE_KEY="0x..." && node scripts/set-wormhole-transceiver-peers.js --execute')
  console.log('')
  console.log('⚠️  WARNING: This can only be done ONCE per transceiver!')
  console.log('')
} else {
  // Run the setup
  setWormholeTransceiverPeers().catch(console.error)
}
