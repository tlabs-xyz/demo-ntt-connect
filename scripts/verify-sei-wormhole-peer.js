#!/usr/bin/env node

/**
 * Script to verify Wormhole peer configuration on Sei EVM Transceiver
 * 
 * This script checks if the Sei EVM Transceiver has the correct peer
 * relationship established with the Ethereum Transceiver.
 * 
 * Usage: node verify-sei-wormhole-peer.js
 */

const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Load deployment configuration
const deploymentPath = path.join(__dirname, '..', 'deployment.json');
const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

// Contract configuration from deployment.json
const SEI_EVM_TRANSCEIVER_ADDRESS = deployment.chains.Seievm.transceiver;

// Chain IDs (Wormhole format)
const ETHEREUM_WORMHOLE_CHAIN_ID = 2;
const SEI_EVM_WORMHOLE_CHAIN_ID = 40;

// Expected Ethereum Transceiver address (from deployment.json)
const EXPECTED_ETHEREUM_TRANSCEIVER = deployment.chains.Ethereum.transceiver;

// Sei EVM RPC endpoints (mainnet only)
const SEI_EVM_RPCS = [
    'https://evm-rpc.sei-apis.com',
    'https://evm-rpc-arctic-1.sei-apis.com', // alternative mainnet RPC
];

// ABI for read-only functions
const WORMHOLE_TRANSCEIVER_READ_ABI = [
    {
        "inputs": [
            {"internalType": "uint16", "name": "chainId", "type": "uint16"}
        ],
        "name": "getWormholePeer",
        "outputs": [
            {"internalType": "bytes32", "name": "", "type": "bytes32"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {"internalType": "address", "name": "", "type": "address"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "isPaused",
        "outputs": [
            {"internalType": "bool", "name": "", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "uint16", "name": "chainId", "type": "uint16"}
        ],
        "name": "isWormholeRelayingEnabled",
        "outputs": [
            {"internalType": "bool", "name": "", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "uint16", "name": "chainId", "type": "uint16"}
        ],
        "name": "isSpecialRelayingEnabled",
        "outputs": [
            {"internalType": "bool", "name": "", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

/**
 * Convert an Ethereum address to bytes32 format (padded with zeros)
 */
function addressToBytes32(address) {
    // Remove 0x prefix if present, then pad to 32 bytes (64 hex characters)
    const cleanAddress = address.replace('0x', '');
    return '0x' + '0'.repeat(24) + cleanAddress.toLowerCase();
}

/**
 * Convert bytes32 back to address format for display
 */
function bytes32ToAddress(bytes32) {
    // Take the last 20 bytes (40 hex characters) and add 0x prefix
    return '0x' + bytes32.slice(-40);
}

/**
 * Create a reliable provider with fallback RPCs
 */
async function createReliableProvider() {
    for (const rpc of SEI_EVM_RPCS) {
        try {
            console.log(`🔗 Testing RPC: ${rpc}`);
            const provider = new ethers.JsonRpcProvider(rpc);
            
            // Test the connection
            const blockNumber = await provider.getBlockNumber();
            console.log(`✅ Connected to ${rpc} (block: ${blockNumber})`);
            return provider;
        } catch (error) {
            console.log(`❌ Failed to connect to ${rpc}: ${error.message}`);
            continue;
        }
    }
    
    throw new Error('❌ All RPC endpoints failed');
}

/**
 * Main function to verify Wormhole peer configuration
 */
async function verifySeiWormholePeer() {
    try {
        console.log('🔍 Verifying Sei EVM Wormhole Peer Configuration');
        console.log('================================================');
        
        console.log('📋 Deployment Configuration:');
        console.log(`   Network: ${deployment.network}`);
        console.log(`   Config loaded from: deployment.json`);
        
        console.log('\n📋 Expected Configuration:');
        console.log(`   Sei EVM Transceiver: ${SEI_EVM_TRANSCEIVER_ADDRESS}`);
        console.log(`   Ethereum Chain ID: ${ETHEREUM_WORMHOLE_CHAIN_ID}`);
        console.log(`   Expected Ethereum Transceiver: ${EXPECTED_ETHEREUM_TRANSCEIVER}`);
        console.log(`   Expected bytes32: ${addressToBytes32(EXPECTED_ETHEREUM_TRANSCEIVER)}`);
        
        // Create provider
        console.log('\n🔗 Connecting to Sei EVM...');
        const provider = await createReliableProvider();
        
        // Create contract instance (read-only)
        const contract = new ethers.Contract(SEI_EVM_TRANSCEIVER_ADDRESS, WORMHOLE_TRANSCEIVER_READ_ABI, provider);
        
        // Check contract basic info
        console.log('\n📊 Contract Information:');
        
        try {
            const owner = await contract.owner();
            console.log(`   Owner: ${owner}`);
        } catch (error) {
            console.log(`   Owner: Could not retrieve (${error.message})`);
        }
        
        try {
            const isPaused = await contract.isPaused();
            console.log(`   Paused: ${isPaused}`);
        } catch (error) {
            console.log(`   Paused: Could not retrieve (${error.message})`);
        }
        
        // Check Wormhole peer for Ethereum (chain ID 2)
        console.log('\n🎯 Wormhole Peer Verification:');
        console.log(`   Querying peer for chain ID ${ETHEREUM_WORMHOLE_CHAIN_ID} (Ethereum)...`);
        
        try {
            const ethereumPeer = await contract.getWormholePeer(ETHEREUM_WORMHOLE_CHAIN_ID);
            console.log(`   Raw result: ${ethereumPeer}`);
            
            if (ethereumPeer === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                console.log('❌ No peer set for Ethereum (chain ID 2)');
                console.log('   Status: PEER NOT CONFIGURED');
                return false;
            } else {
                const peerAddress = bytes32ToAddress(ethereumPeer);
                console.log(`   Peer address: ${peerAddress}`);
                
                // Verify it matches expected address
                const expectedBytes32 = addressToBytes32(EXPECTED_ETHEREUM_TRANSCEIVER);
                if (ethereumPeer.toLowerCase() === expectedBytes32.toLowerCase()) {
                    console.log('✅ Ethereum peer is correctly configured!');
                    console.log(`   Status: PEER CORRECTLY SET`);
                } else {
                    console.log('❌ Ethereum peer address does not match expected value');
                    console.log(`   Expected: ${EXPECTED_ETHEREUM_TRANSCEIVER}`);
                    console.log(`   Expected bytes32: ${expectedBytes32}`);
                    console.log(`   Actual: ${peerAddress}`);
                    console.log(`   Actual bytes32: ${ethereumPeer}`);
                    console.log('   Status: PEER MISCONFIGURED');
                    return false;
                }
            }
        } catch (error) {
            console.log(`❌ Failed to get Ethereum peer: ${error.message}`);
            return false;
        }
        
        // Check relaying configuration
        console.log('\n⚙️  Relaying Configuration:');
        
        try {
            const isWormholeRelayingEnabled = await contract.isWormholeRelayingEnabled(ETHEREUM_WORMHOLE_CHAIN_ID);
            console.log(`   Wormhole relaying to Ethereum: ${isWormholeRelayingEnabled}`);
        } catch (error) {
            console.log(`   Wormhole relaying: Could not retrieve (${error.message})`);
        }
        
        try {
            const isSpecialRelayingEnabled = await contract.isSpecialRelayingEnabled(ETHEREUM_WORMHOLE_CHAIN_ID);
            console.log(`   Special relaying to Ethereum: ${isSpecialRelayingEnabled}`);
        } catch (error) {
            console.log(`   Special relaying: Could not retrieve (${error.message})`);
        }
        
        // Additional peer checks for other chains (optional)
        console.log('\n🔍 Additional Peer Checks:');
        
        const commonChainIds = [1, 3, 4, 5, 6, 10, 23]; // Some common Wormhole chain IDs
        for (const chainId of commonChainIds) {
            if (chainId === ETHEREUM_WORMHOLE_CHAIN_ID) continue; // Already checked
            
            try {
                const peer = await contract.getWormholePeer(chainId);
                if (peer !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    console.log(`   Chain ${chainId}: ${bytes32ToAddress(peer)}`);
                }
            } catch (error) {
                // Ignore errors for optional checks
            }
        }
        
        console.log('\n📋 Summary:');
        console.log('   ✅ Sei EVM Transceiver successfully configured');
        console.log(`   ✅ Ethereum peer (chain ${ETHEREUM_WORMHOLE_CHAIN_ID}): ${EXPECTED_ETHEREUM_TRANSCEIVER}`);
        console.log('   ✅ Ready for cross-chain communication');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ Error verifying Wormhole peer:');
        console.error(error.message);
        
        if (error.code) {
            console.error(`Error code: ${error.code}`);
        }
        
        if (error.data) {
            console.error(`Error data: ${error.data}`);
        }
        
        return false;
    }
}

// Export for testing
module.exports = {
    verifySeiWormholePeer,
    addressToBytes32,
    bytes32ToAddress,
    SEI_EVM_TRANSCEIVER_ADDRESS,
    EXPECTED_ETHEREUM_TRANSCEIVER,
    ETHEREUM_WORMHOLE_CHAIN_ID
};

// Run if called directly
if (require.main === module) {
    verifySeiWormholePeer().then(success => {
        process.exit(success ? 0 : 1);
    });
}
