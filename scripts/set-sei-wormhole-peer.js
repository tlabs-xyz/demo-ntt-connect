#!/usr/bin/env node

/**
 * Script to set Wormhole peer on Sei EVM Transceiver
 * 
 * This script calls setWormholePeer on the Sei EVM Transceiver contract
 * to establish the peer relationship with the Ethereum Transceiver.
 * 
 * Usage: node set-sei-wormhole-peer.js
 * 
 * Environment variables required:
 * - OWNER_PRIVATE_KEY: Private key of the contract owner
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

// Ethereum Transceiver address from deployment.json
const ETHEREUM_TRANSCEIVER_ADDRESS = deployment.chains.Ethereum.transceiver;

// Sei EVM RPC endpoints (mainnet only)
const SEI_EVM_RPCS = [
    'https://evm-rpc.sei-apis.com',
    'https://evm-rpc-arctic-1.sei-apis.com', // alternative mainnet RPC
];

// ABI for setWormholePeer function
const WORMHOLE_TRANSCEIVER_ABI = [
    {
        "inputs": [
            {"internalType": "uint16", "name": "peerChainId", "type": "uint16"},
            {"internalType": "bytes32", "name": "peerContract", "type": "bytes32"}
        ],
        "name": "setWormholePeer",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
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
 * Execute the setWormholePeer transaction with retry logic
 */
async function executeTransactionWithRetry(contract, peerChainId, peerContract, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Attempt ${attempt}/${maxRetries}: Executing setWormholePeer...`);
            
            // Estimate gas with fallback
            console.log('⛽ Estimating gas...');
            let gasLimit;
            try {
                const gasEstimate = await contract.setWormholePeer.estimateGas(peerChainId, peerContract);
                gasLimit = Math.ceil(Number(gasEstimate) * 1.2); // Add 20% buffer, convert BigInt to Number
                console.log(`   Estimated gas: ${gasEstimate}`);
                console.log(`   Gas limit (with buffer): ${gasLimit}`);
            } catch (gasError) {
                console.log(`   ⚠️  Gas estimation failed: ${gasError.message}`);
                console.log(`   🔧 Using fallback gas limit: 200000`);
                gasLimit = 200000; // Fallback gas limit for setWormholePeer
            }
            
            // Execute transaction
            const tx = await contract.setWormholePeer(peerChainId, peerContract, {
                gasLimit: gasLimit,
                value: 0 // Explicit value for payable function
            });
            
            console.log(`📤 Transaction submitted: ${tx.hash}`);
            console.log('⏳ Waiting for confirmation...');
            
            const receipt = await tx.wait();
            
            console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
            console.log(`   Gas used: ${receipt.gasUsed}`);
            
            return receipt;
            
        } catch (error) {
            console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Wait before retry
            console.log('⏳ Waiting 5 seconds before retry...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

/**
 * Main function to set Wormhole peer
 */
async function setSeiWormholePeer() {
    try {
        console.log('🚀 Starting Sei EVM Wormhole Peer Setup');
        console.log('=====================================');
        
        console.log('📋 Deployment Configuration:');
        console.log(`   Network: ${deployment.network}`);
        console.log(`   Config loaded from: deployment.json`);
        
        // Check for private key
        const privateKey = process.env.OWNER_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('❌ OWNER_PRIVATE_KEY environment variable is required');
        }
        
        console.log('\n📋 Transaction Configuration:');
        console.log(`   Sei EVM Transceiver: ${SEI_EVM_TRANSCEIVER_ADDRESS}`);
        console.log(`   Ethereum Chain ID: ${ETHEREUM_WORMHOLE_CHAIN_ID}`);
        console.log(`   Ethereum Transceiver: ${ETHEREUM_TRANSCEIVER_ADDRESS}`);
        console.log(`   Peer bytes32: ${addressToBytes32(ETHEREUM_TRANSCEIVER_ADDRESS)}`);
        
        // Create provider and wallet
        console.log('\n🔗 Connecting to Sei EVM...');
        const provider = await createReliableProvider();
        const wallet = new ethers.Wallet(privateKey, provider);
        
        console.log(`👤 Wallet address: ${wallet.address}`);
        
        // Check wallet balance
        const balance = await provider.getBalance(wallet.address);
        console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} SEI`);
        
        if (balance === 0n) {
            throw new Error('❌ Wallet has no SEI for gas fees');
        }
        
        // Create contract instance
        const contract = new ethers.Contract(SEI_EVM_TRANSCEIVER_ADDRESS, WORMHOLE_TRANSCEIVER_ABI, wallet);
        
        // Check current owner
        console.log('\n🔍 Checking contract owner...');
        const owner = await contract.owner();
        console.log(`   Contract owner: ${owner}`);
        console.log(`   Wallet address: ${wallet.address}`);
        
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            throw new Error(`❌ Wallet is not the contract owner. Owner: ${owner}`);
        }
        
        // Check if contract is paused
        console.log('\n🔍 Checking contract state...');
        try {
            const isPaused = await contract.isPaused();
            console.log(`   Contract paused: ${isPaused}`);
            if (isPaused) {
                throw new Error('❌ Contract is currently paused. Cannot execute setWormholePeer.');
            }
        } catch (error) {
            console.log(`   Could not check pause state: ${error.message}`);
        }
        
        // Check current peer (if any)
        console.log('\n🔍 Checking current Wormhole peer...');
        let currentPeer;
        try {
            currentPeer = await contract.getWormholePeer(ETHEREUM_WORMHOLE_CHAIN_ID);
            console.log(`   Current peer for chain ${ETHEREUM_WORMHOLE_CHAIN_ID}: ${currentPeer}`);
            
            if (currentPeer !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                console.log(`   Current peer address: ${bytes32ToAddress(currentPeer)}`);
                
                // Check if peer is already set to the target address
                const targetPeerBytes32 = addressToBytes32(ETHEREUM_TRANSCEIVER_ADDRESS);
                if (currentPeer.toLowerCase() === targetPeerBytes32.toLowerCase()) {
                    console.log('✅ Peer is already set correctly! No action needed.');
                    return;
                }
            }
        } catch (error) {
            console.log(`   Could not get current peer: ${error.message}`);
        }
        
        // Prepare parameters
        const peerChainId = ETHEREUM_WORMHOLE_CHAIN_ID;
        const peerContract = addressToBytes32(ETHEREUM_TRANSCEIVER_ADDRESS);
        
        console.log('\n🎯 Transaction Parameters:');
        console.log(`   Function: setWormholePeer`);
        console.log(`   peerChainId: ${peerChainId} (Ethereum)`);
        console.log(`   peerContract: ${peerContract}`);
        console.log(`   peerContract (address): ${bytes32ToAddress(peerContract)}`);
        
        // Execute the transaction
        console.log('\n🚀 Executing setWormholePeer transaction...');
        const receipt = await executeTransactionWithRetry(contract, peerChainId, peerContract);
        
        // Verify the result
        console.log('\n✅ Verifying peer was set...');
        const newPeer = await contract.getWormholePeer(ETHEREUM_WORMHOLE_CHAIN_ID);
        console.log(`   New peer for chain ${ETHEREUM_WORMHOLE_CHAIN_ID}: ${newPeer}`);
        console.log(`   New peer address: ${bytes32ToAddress(newPeer)}`);
        
        if (newPeer.toLowerCase() === peerContract.toLowerCase()) {
            console.log('🎉 SUCCESS: Wormhole peer set correctly!');
        } else {
            console.log('⚠️  WARNING: Peer value does not match expected value');
        }
        
        console.log('\n📊 Summary:');
        console.log(`   ✅ Sei EVM Transceiver now recognizes Ethereum Transceiver`);
        console.log(`   ✅ Chain ${ETHEREUM_WORMHOLE_CHAIN_ID} peer: ${bytes32ToAddress(newPeer)}`);
        console.log(`   ✅ Transaction: ${receipt.transactionHash}`);
        console.log(`   ✅ Gas used: ${receipt.gasUsed}`);
        
    } catch (error) {
        console.error('\n❌ Error setting Wormhole peer:');
        console.error(error.message);
        
        if (error.code) {
            console.error(`Error code: ${error.code}`);
        }
        
        if (error.data) {
            console.error(`Error data: ${error.data}`);
        }
        
        process.exit(1);
    }
}

// Export for testing
module.exports = {
    setSeiWormholePeer,
    addressToBytes32,
    bytes32ToAddress,
    SEI_EVM_TRANSCEIVER_ADDRESS,
    ETHEREUM_TRANSCEIVER_ADDRESS,
    ETHEREUM_WORMHOLE_CHAIN_ID
};

// Run if called directly
if (require.main === module) {
    setSeiWormholePeer();
}
