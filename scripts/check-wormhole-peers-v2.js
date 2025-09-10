#!/usr/bin/env node

const { ethers } = require('ethers')

// Network configuration
const ETHEREUM_RPC = 'https://ethereum-rpc.publicnode.com'
const SEI_EVM_RPC = 'https://evm-rpc.sei-apis.com'

// Wormhole chain IDs
const ETHEREUM_WORMHOLE_CHAIN_ID = 2
const SEI_EVM_WORMHOLE_CHAIN_ID = 40

// Wormhole Transceiver addresses (from deployment data)
const ETHEREUM_WORMHOLE_TRANSCEIVER = '0x73D19b20B374bFE4105c2b0De55504512f0C2AA7'
const SEI_EVM_WORMHOLE_TRANSCEIVER = '0x83849F9c2EB47Ce0D59524a43CB101533bc1b6A6'

// More comprehensive Wormhole Transceiver ABI
const WORMHOLE_TRANSCEIVER_ABI = [
  {
    "inputs": [{"name": "chainId", "type": "uint16"}],
    "name": "getPeer",
    "outputs": [{"name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "chainId", "type": "uint16"}],
    "name": "isPeerValid",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "chainId", "type": "uint16"}],
    "name": "getRegisteredPeer",
    "outputs": [{"name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getWormholeRelayerContract",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "wormhole",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
]

async function checkWormholePeersV2() {
  console.log('🔍 WORMHOLE TRANSCEIVER PEER CHECK V2')
  console.log('=====================================')
  console.log('Trying different function names to check peer configuration')
  console.log('')

  try {
    // Setup providers
    const ethereumProvider = new ethers.JsonRpcProvider(ETHEREUM_RPC)
    const seiEvmProvider = new ethers.JsonRpcProvider(SEI_EVM_RPC)

    // Setup contracts
    const ethereumTransceiver = new ethers.Contract(
      ETHEREUM_WORMHOLE_TRANSCEIVER,
      WORMHOLE_TRANSCEIVER_ABI,
      ethereumProvider
    )
    
    const seiEvmTransceiver = new ethers.Contract(
      SEI_EVM_WORMHOLE_TRANSCEIVER,
      WORMHOLE_TRANSCEIVER_ABI,
      seiEvmProvider
    )

    console.log('📍 Contract Addresses:')
    console.log(`   Ethereum Transceiver: ${ETHEREUM_WORMHOLE_TRANSCEIVER}`)
    console.log(`   Sei EVM Transceiver: ${SEI_EVM_WORMHOLE_TRANSCEIVER}`)
    console.log('')

    // Try to get basic contract info first
    console.log('🔍 BASIC CONTRACT INFO')
    console.log('======================')
    
    try {
      const ethWormhole = await ethereumTransceiver.wormhole()
      console.log(`   Ethereum Wormhole Core: ${ethWormhole}`)
    } catch (error) {
      console.log('   ❌ Could not get Ethereum Wormhole Core address')
    }
    
    try {
      const seiWormhole = await seiEvmTransceiver.wormhole()
      console.log(`   Sei EVM Wormhole Core: ${seiWormhole}`)
    } catch (error) {
      console.log('   ❌ Could not get Sei EVM Wormhole Core address')
    }

    console.log('')

    // Try different peer checking functions
    const peerFunctions = ['getPeer', 'getRegisteredPeer']
    
    for (const funcName of peerFunctions) {
      console.log(`🔗 TESTING FUNCTION: ${funcName}`)
      console.log('='.repeat(30 + funcName.length))
      
      // Check Ethereum -> Sei EVM peer
      try {
        const ethereumPeerForSei = await ethereumTransceiver[funcName](SEI_EVM_WORMHOLE_CHAIN_ID)
        console.log(`   Ethereum → Sei EVM (chain ${SEI_EVM_WORMHOLE_CHAIN_ID}):`)
        console.log(`      Peer (bytes32): ${ethereumPeerForSei}`)
        console.log(`      Peer (address): 0x${ethereumPeerForSei.slice(-40)}`)
        console.log(`      Expected: ${SEI_EVM_WORMHOLE_TRANSCEIVER}`)
        
        const expectedBytes32 = '0x' + '0'.repeat(24) + SEI_EVM_WORMHOLE_TRANSCEIVER.slice(2).toLowerCase()
        if (ethereumPeerForSei.toLowerCase() === expectedBytes32) {
          console.log('      ✅ MATCH!')
        } else {
          console.log('      ❌ MISMATCH!')
        }
      } catch (error) {
        console.log(`   ❌ Ethereum ${funcName} failed: ${error.message}`)
      }
      
      // Check Sei EVM -> Ethereum peer
      try {
        const seiPeerForEthereum = await seiEvmTransceiver[funcName](ETHEREUM_WORMHOLE_CHAIN_ID)
        console.log(`   Sei EVM → Ethereum (chain ${ETHEREUM_WORMHOLE_CHAIN_ID}):`)
        console.log(`      Peer (bytes32): ${seiPeerForEthereum}`)
        console.log(`      Peer (address): 0x${seiPeerForEthereum.slice(-40)}`)
        console.log(`      Expected: ${ETHEREUM_WORMHOLE_TRANSCEIVER}`)
        
        const expectedBytes32 = '0x' + '0'.repeat(24) + ETHEREUM_WORMHOLE_TRANSCEIVER.slice(2).toLowerCase()
        if (seiPeerForEthereum.toLowerCase() === expectedBytes32) {
          console.log('      ✅ MATCH!')
        } else {
          console.log('      ❌ MISMATCH!')
        }
      } catch (error) {
        console.log(`   ❌ Sei EVM ${funcName} failed: ${error.message}`)
      }
      
      console.log('')
    }

    console.log('======================================================================')
    console.log('💡 DIAGNOSIS')
    console.log('======================================================================')
    console.log('If all functions fail, the Wormhole Transceiver might use different')
    console.log('function names or the peer configuration is not set up correctly.')
    console.log('')
    console.log('The InvalidWormholePeer error suggests that when the Sei EVM')
    console.log('transceiver receives a message from Ethereum, it cannot validate')
    console.log('that the message came from a trusted peer.')

  } catch (error) {
    console.error('❌ Error during Wormhole peer check:', error)
  }
}

// Run the check
checkWormholePeersV2().catch(console.error)
