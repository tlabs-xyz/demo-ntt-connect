#!/usr/bin/env node

const { ethers } = require('ethers')

// Network configuration
const ETHEREUM_RPC = 'https://ethereum-rpc.publicnode.com'
const SEI_EVM_RPC = 'https://evm-rpc.sei-apis.com'

// Mainnet contract addresses
const ETHEREUM_NTT_MANAGER = '0x79eb9aF995a443A102A19b41EDbB58d66e2921c7'
const SEI_EVM_NTT_MANAGER = 'c10a0886d4Fe06bD61f41ee2855a2215375B82f0'

// Wormhole chain IDs
const ETHEREUM_WORMHOLE_CHAIN_ID = 2
const SEI_EVM_WORMHOLE_CHAIN_ID = 40

// Wormhole Transceiver addresses (from deployment data)
const ETHEREUM_WORMHOLE_TRANSCEIVER = '0x73D19b20B374bFE4105c2b0De55504512f0C2AA7'
const SEI_EVM_WORMHOLE_TRANSCEIVER = '0x83849F9c2EB47Ce0D59524a43CB101533bc1b6A6'

// Minimal ABI for Wormhole Transceiver
const WORMHOLE_TRANSCEIVER_ABI = [
  {
    "inputs": [{"name": "chainId", "type": "uint16"}],
    "name": "getWormholePeer",
    "outputs": [{"name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "chainId", "type": "uint16"}],
    "name": "isWormholePeerValid",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
]

async function checkWormholePeers() {
  console.log('🔍 WORMHOLE TRANSCEIVER PEER CHECK')
  console.log('=====================================')
  console.log('Checking Wormhole Transceiver peer configuration')
  console.log('This is critical for cross-chain message validation')
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

    // Check Ethereum -> Sei EVM peer
    console.log('🔗 ETHEREUM TRANSCEIVER → SEI EVM')
    console.log('=================================')
    
    try {
      const ethereumPeerForSei = await ethereumTransceiver.getWormholePeer(SEI_EVM_WORMHOLE_CHAIN_ID)
      const ethereumPeerValidForSei = await ethereumTransceiver.isWormholePeerValid(SEI_EVM_WORMHOLE_CHAIN_ID)
      
      console.log(`   Chain ID: ${SEI_EVM_WORMHOLE_CHAIN_ID} (Sei EVM)`)
      console.log(`   Configured Peer (bytes32): ${ethereumPeerForSei}`)
      console.log(`   Peer Address (as address): 0x${ethereumPeerForSei.slice(-40)}`)
      console.log(`   Expected Peer: ${SEI_EVM_WORMHOLE_TRANSCEIVER}`)
      console.log(`   Is Valid: ${ethereumPeerValidForSei}`)
      
      const expectedSeiBytes32 = '0x' + '0'.repeat(24) + SEI_EVM_WORMHOLE_TRANSCEIVER.slice(2).toLowerCase()
      const actualSeiBytes32 = ethereumPeerForSei.toLowerCase()
      
      if (actualSeiBytes32 === expectedSeiBytes32) {
        console.log('   ✅ Peer address matches expected')
      } else {
        console.log('   ❌ Peer address MISMATCH!')
        console.log(`      Expected: ${expectedSeiBytes32}`)
        console.log(`      Actual:   ${actualSeiBytes32}`)
      }
      
      if (ethereumPeerValidForSei) {
        console.log('   ✅ Peer is valid')
      } else {
        console.log('   ❌ Peer is INVALID!')
      }
    } catch (error) {
      console.log('   ❌ Error checking Ethereum transceiver peer:', error.message)
    }
    
    console.log('')

    // Check Sei EVM -> Ethereum peer
    console.log('🔗 SEI EVM TRANSCEIVER → ETHEREUM')
    console.log('=================================')
    
    try {
      const seiPeerForEthereum = await seiEvmTransceiver.getWormholePeer(ETHEREUM_WORMHOLE_CHAIN_ID)
      const seiPeerValidForEthereum = await seiEvmTransceiver.isWormholePeerValid(ETHEREUM_WORMHOLE_CHAIN_ID)
      
      console.log(`   Chain ID: ${ETHEREUM_WORMHOLE_CHAIN_ID} (Ethereum)`)
      console.log(`   Configured Peer (bytes32): ${seiPeerForEthereum}`)
      console.log(`   Peer Address (as address): 0x${seiPeerForEthereum.slice(-40)}`)
      console.log(`   Expected Peer: ${ETHEREUM_WORMHOLE_TRANSCEIVER}`)
      console.log(`   Is Valid: ${seiPeerValidForEthereum}`)
      
      const expectedEthBytes32 = '0x' + '0'.repeat(24) + ETHEREUM_WORMHOLE_TRANSCEIVER.slice(2).toLowerCase()
      const actualEthBytes32 = seiPeerForEthereum.toLowerCase()
      
      if (actualEthBytes32 === expectedEthBytes32) {
        console.log('   ✅ Peer address matches expected')
      } else {
        console.log('   ❌ Peer address MISMATCH!')
        console.log(`      Expected: ${expectedEthBytes32}`)
        console.log(`      Actual:   ${actualEthBytes32}`)
      }
      
      if (seiPeerValidForEthereum) {
        console.log('   ✅ Peer is valid')
      } else {
        console.log('   ❌ Peer is INVALID!')
      }
    } catch (error) {
      console.log('   ❌ Error checking Sei EVM transceiver peer:', error.message)
    }

    console.log('')
    console.log('======================================================================')
    console.log('📊 WORMHOLE TRANSCEIVER PEER CHECK SUMMARY')
    console.log('======================================================================')
    console.log('This check verifies that Wormhole Transceivers can validate')
    console.log('cross-chain messages from each other.')
    console.log('')
    console.log('If peers are invalid, the InvalidWormholePeer error will occur')
    console.log('during cross-chain message processing.')

  } catch (error) {
    console.error('❌ Error during Wormhole peer check:', error)
  }
}

// Run the check
checkWormholePeers().catch(console.error)
