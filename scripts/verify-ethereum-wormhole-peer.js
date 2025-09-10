#!/usr/bin/env node

/**
 * Script to verify Wormhole peer configuration on Ethereum Mainnet Transceiver
 * 
 * This script checks if the Ethereum Transceiver has the correct peer
 * relationship established with the Sei EVM Transceiver.
 * 
 * Usage: node verify-ethereum-wormhole-peer.js
 */

const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Load deployment configuration
const deploymentPath = path.join(__dirname, '..', 'deployment.json');
const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

// Contract configuration from deployment.json
const ETHEREUM_TRANSCEIVER_ADDRESS = deployment.chains.Ethereum.transceiver;

// Chain IDs (Wormhole format)
const ETHEREUM_WORMHOLE_CHAIN_ID = 2;
const SEI_EVM_WORMHOLE_CHAIN_ID = 40;

// Expected Sei EVM Transceiver address (from deployment.json)
const EXPECTED_SEI_EVM_TRANSCEIVER = deployment.chains.Seievm.transceiver;

// Ethereum RPC endpoints (mainnet only)
const ETHEREUM_RPCS = [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com',
    'https://eth-mainnet.public.blastapi.io',
    'https://ethereum-rpc.publicnode.com'
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
    },
    {
        "inputs": [],
        "name": "WORMHOLE_TRANSCEIVER_VERSION",
        "outputs": [
            {"internalType": "string", "name": "", "type": "string"}
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
    for (const rpc of ETHEREUM_RPCS) {
        try {
            console.log(`🔗 Testing RPC: ${rpc}`);
            const provider = new ethers.JsonRpcProvider(rpc);
            
            // Test the connection with a timeout
            const blockNumberPromise = provider.getBlockNumber();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );
            
            const blockNumber = await Promise.race([blockNumberPromise, timeoutPromise]);
            console.log(`✅ Connected to ${rpc} (block: ${blockNumber})`);
            return provider;
        } catch (error) {
            console.log(`❌ Failed to connect to ${rpc}: ${error.message}`);
            continue;
        }
    }
    
    throw new Error('❌ All Ethereum RPC endpoints failed');
}

/**
 * Main function to verify Wormhole peer configuration on Ethereum
 */
async function verifyEthereumWormholePeer() {
    try {
        console.log('🔍 Verifying Ethereum Mainnet Wormhole Peer Configuration');
        console.log('======================================================');
        
        console.log('📋 Deployment Configuration:');
        console.log(`   Network: ${deployment.network}`);
        console.log(`   Config loaded from: deployment.json`);
        
        console.log('\n📋 Expected Configuration:');
        console.log(`   Ethereum Transceiver: ${ETHEREUM_TRANSCEIVER_ADDRESS}`);
        console.log(`   Sei EVM Chain ID: ${SEI_EVM_WORMHOLE_CHAIN_ID}`);
        console.log(`   Expected Sei EVM Transceiver: ${EXPECTED_SEI_EVM_TRANSCEIVER}`);
        console.log(`   Expected bytes32: ${addressToBytes32(EXPECTED_SEI_EVM_TRANSCEIVER)}`);
        
        // Create provider
        console.log('\n🔗 Connecting to Ethereum Mainnet...');
        const provider = await createReliableProvider();
        
        // Get network info
        const network = await provider.getNetwork();
        console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
        
        if (network.chainId !== 1n) {
            console.log('⚠️  Warning: Not connected to Ethereum Mainnet');
        }
        
        // Create contract instance (read-only)
        const contract = new ethers.Contract(ETHEREUM_TRANSCEIVER_ADDRESS, WORMHOLE_TRANSCEIVER_READ_ABI, provider);
        
        // Check contract basic info
        console.log('\n📊 Contract Information:');
        
        try {
            const version = await contract.WORMHOLE_TRANSCEIVER_VERSION();
            console.log(`   Version: ${version}`);
        } catch (error) {
            console.log(`   Version: Could not retrieve (${error.message})`);
        }
        
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
        
        // Check Wormhole peer for Sei EVM (chain ID 40)
        console.log('\n🎯 Wormhole Peer Verification:');
        console.log(`   Querying peer for chain ID ${SEI_EVM_WORMHOLE_CHAIN_ID} (Sei EVM)...`);
        
        try {
            const seiEvmPeer = await contract.getWormholePeer(SEI_EVM_WORMHOLE_CHAIN_ID);
            console.log(`   Raw result: ${seiEvmPeer}`);
            
            if (seiEvmPeer === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                console.log('❌ No peer set for Sei EVM (chain ID 40)');
                console.log('   Status: PEER NOT CONFIGURED');
                return false;
            } else {
                const peerAddress = bytes32ToAddress(seiEvmPeer);
                console.log(`   Peer address: ${peerAddress}`);
                
                // Verify it matches expected address
                const expectedBytes32 = addressToBytes32(EXPECTED_SEI_EVM_TRANSCEIVER);
                if (seiEvmPeer.toLowerCase() === expectedBytes32.toLowerCase()) {
                    console.log('✅ Sei EVM peer is correctly configured!');
                    console.log(`   Status: PEER CORRECTLY SET`);
                } else {
                    console.log('❌ Sei EVM peer address does not match expected value');
                    console.log(`   Expected: ${EXPECTED_SEI_EVM_TRANSCEIVER}`);
                    console.log(`   Expected bytes32: ${expectedBytes32}`);
                    console.log(`   Actual: ${peerAddress}`);
                    console.log(`   Actual bytes32: ${seiEvmPeer}`);
                    console.log('   Status: PEER MISCONFIGURED');
                    return false;
                }
            }
        } catch (error) {
            console.log(`❌ Failed to get Sei EVM peer: ${error.message}`);
            return false;
        }
        
        // Check relaying configuration for Sei EVM
        console.log('\n⚙️  Relaying Configuration:');
        
        try {
            const isWormholeRelayingEnabled = await contract.isWormholeRelayingEnabled(SEI_EVM_WORMHOLE_CHAIN_ID);
            console.log(`   Wormhole relaying to Sei EVM: ${isWormholeRelayingEnabled}`);
        } catch (error) {
            console.log(`   Wormhole relaying: Could not retrieve (${error.message})`);
        }
        
        try {
            const isSpecialRelayingEnabled = await contract.isSpecialRelayingEnabled(SEI_EVM_WORMHOLE_CHAIN_ID);
            console.log(`   Special relaying to Sei EVM: ${isSpecialRelayingEnabled}`);
        } catch (error) {
            console.log(`   Special relaying: Could not retrieve (${error.message})`);
        }
        
        // Additional peer checks for other chains (optional)
        console.log('\n🔍 Additional Peer Checks:');
        
        // Common Wormhole chain IDs (excluding Ethereum=2 and Sei EVM=40)
        const commonChainIds = [1, 3, 4, 5, 6, 10, 13, 14, 16, 18, 19, 21, 22, 23, 24, 30];
        let foundPeers = 0;
        
        for (const chainId of commonChainIds) {
            if (chainId === ETHEREUM_WORMHOLE_CHAIN_ID || chainId === SEI_EVM_WORMHOLE_CHAIN_ID) continue;
            
            try {
                const peer = await contract.getWormholePeer(chainId);
                if (peer !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    console.log(`   Chain ${chainId}: ${bytes32ToAddress(peer)}`);
                    foundPeers++;
                }
            } catch (error) {
                // Ignore errors for optional checks
            }
        }
        
        if (foundPeers === 0) {
            console.log('   No additional peers configured');
        }
        
        console.log('\n📋 Summary:');
        console.log('   ✅ Ethereum Transceiver successfully configured');
        console.log(`   ✅ Sei EVM peer (chain ${SEI_EVM_WORMHOLE_CHAIN_ID}): ${EXPECTED_SEI_EVM_TRANSCEIVER}`);
        console.log('   ✅ Ready for cross-chain communication');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ Error verifying Ethereum Wormhole peer:');
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
    verifyEthereumWormholePeer,
    addressToBytes32,
    bytes32ToAddress,
    ETHEREUM_TRANSCEIVER_ADDRESS,
    EXPECTED_SEI_EVM_TRANSCEIVER,
    SEI_EVM_WORMHOLE_CHAIN_ID
};

// Run if called directly
if (require.main === module) {
    verifyEthereumWormholePeer().then(success => {
        process.exit(success ? 0 : 1);
    });
}
