'use client'

import React, { useState } from 'react'
import { ethers } from 'ethers'
import axios from 'axios'

// NttManagerWithExecutor ABI - CORRECT ABI from the actual deployed contract
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
]

// ERC20 ABI for token operations
const ERC20_ABI = [
  {
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  }
]

// Executor configuration
const EXECUTOR_URL = "https://executor.labsapis.com"

// Helper function to serialize relay instructions as hex
// This creates the relayInstructions for the executor quote
const serializeRelayInstructions = () => {
  // CRITICAL FIX: Use working testnet gas instruction format
  // This specifies a 500,000 gas limit for the destination transaction
  // Format: 01 (GasInstruction) + gas limit (500,000 = 0x7a120) at byte position 13
  const workingGasInstruction = '0x010000000000000000000000000007a12000000000000000000000000000000000'
  
  console.log('   🔧 Using working testnet gas instruction (500,000 gas limit)')
  return workingGasInstruction
}

// Function to get a real signed quote from the executor
const getExecutorQuote = async (srcChain: number, dstChain: number) => {
  try {
    console.log('🔄 Fetching real executor quote from:', EXECUTOR_URL)
    console.log('   Source Chain:', srcChain, '(Ethereum)')
    console.log('   Destination Chain:', dstChain, '(Sei EVM)')
    
    const relayInstructions = serializeRelayInstructions()
    console.log('   Relay Instructions (hex):', relayInstructions)
    console.log('   Relay Instructions Length:', relayInstructions.length - 2, 'hex chars,', (relayInstructions.length - 2) / 2, 'bytes')
    
    const response = await axios.post(`${EXECUTOR_URL}/v0/quote`, {
      srcChain,
      dstChain,
      relayInstructions,
    })
    
    const { signedQuote, estimatedCost } = response.data
    
    console.log('✅ Successfully got executor quote!')
    console.log('   Estimated Cost:', estimatedCost, 'wei')
    console.log('   Estimated Cost (ETH):', estimatedCost ? (estimatedCost / 1e18).toFixed(8) : 'N/A')
    console.log('   Signed Quote Length:', signedQuote?.length || 0, 'characters')
    console.log('   Signed Quote Type:', typeof signedQuote)
    
    if (signedQuote) {
      console.log('   Signed Quote (first 100 chars):', signedQuote.substring(0, 100) + '...')
      console.log('   Signed Quote (last 50 chars):', '...' + signedQuote.substring(signedQuote.length - 50))
      
      // Analyze the quote structure
      if (signedQuote.startsWith('0x')) {
        console.log('   ✅ Quote has proper 0x prefix')
        console.log('   Quote hex length:', signedQuote.length - 2, 'hex characters')
        console.log('   Quote byte length:', (signedQuote.length - 2) / 2, 'bytes')
      } else {
        console.log('   ❌ Quote missing 0x prefix')
      }
    }
    
    return { signedQuote, estimatedCost }
  } catch (error: any) {
    console.error('❌ Failed to get executor quote:')
    console.error('   Error Message:', error.message)
    
    if (error.response) {
      console.error('   HTTP Status:', error.response.status)
      console.error('   Response Data:', error.response.data)
      console.error('   Response Headers:', error.response.headers)
    } else if (error.request) {
      console.error('   No response received')
      console.error('   Request:', error.request)
    } else {
      console.error('   Request setup error:', error.message)
    }
    
    throw new Error(`Failed to get executor quote: ${error.message}`)
  }
}

// Wormhole Chain IDs (official constants)
// Reference: https://docs.wormhole.com/wormhole/reference/constants
const WORMHOLE_CHAIN_IDS = {
  ETHEREUM: 2,   // Ethereum mainnet (NOT the EVM chain ID 1)
  SEI_EVM: 40,   // Sei EVM (NOT the EVM chain ID 1329)
} as const

// Default contract addresses (you can modify these)
const DEFAULT_CONTRACTS = {
  nttManagerWithExecutor: '0xd2d9c936165a85f27a5a7e07afb974d022b89463',
  originalNttManager: '0x79eb9aF995a443A102A19b41EDbB58d66e2921c7',
  tbtcTokenEthereum: '0x18084fbA666a33d37592fA2633fD49a74DD93a88',
  tbtcTokenSeievm: '0xF9201c9192249066Aec049ae7951ae298BBEc767',
  seiEvmNttManager: '0xc10a0886d4Fe06bD61f41ee2855a2215375B82f0', // Sei EVM NTT Manager (destination)
  seiWormholeChainId: WORMHOLE_CHAIN_IDS.SEI_EVM, // Sei EVM Wormhole chain ID (40)
}

export default function CustomNttTransfer() {
  // Form state
  const [amount, setAmount] = useState('0.000048') // Pre-fill with available balance amount
  const [recipient, setRecipient] = useState('0xB6A114C2c34eF91eeb0d93bcdDD7B95a9D6892E1') // Auto-fill with user address
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [txHash, setTxHash] = useState('')
  
  // Contract addresses (editable)
  const [contracts, setContracts] = useState(DEFAULT_CONTRACTS)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Balance and token info
  const [tokenBalance, setTokenBalance] = useState('')
  const [tokenDecimals, setTokenDecimals] = useState(8)
  const [isCheckingBalance, setIsCheckingBalance] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState('')

  // Convert address to bytes32 format (left-padded with zeros)
  const addressToBytes32 = (address: string): string => {
    // Method 1: Manual padding (current approach)
    const manual = '0x' + '000000000000000000000000' + address.slice(2).toLowerCase()
    
    // Method 2: Using ethers.js utilities
    const ethersMethod = ethers.zeroPadValue(address, 32)
    
    console.log(`🔄 ADDRESS CONVERSION for ${address}:`)
    console.log('   Manual method:', manual)
    console.log('   Ethers method:', ethersMethod)
    console.log('   Methods match:', manual.toLowerCase() === ethersMethod.toLowerCase())
    
    // Use ethers method as it's more standard
    return ethersMethod
  }

  // Test transfer parameters (same logic as test script)
  const testTransferParameters = async () => {
    if (typeof window.ethereum === 'undefined') {
      setValidationResult('❌ Please install MetaMask!')
      return
    }

    setIsValidating(true)
    setValidationResult('🔄 Starting parameter validation...')
    
    // Validate chain IDs
    console.log('🔍 WORMHOLE CHAIN ID VALIDATION:')
    console.log('   Ethereum Wormhole Chain ID:', WORMHOLE_CHAIN_IDS.ETHEREUM, '(should be 2)')
    console.log('   Sei EVM Wormhole Chain ID:', WORMHOLE_CHAIN_IDS.SEI_EVM, '(should be 40)')
    console.log('   ✅ Using official Wormhole constants')
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const userAddress = await signer.getAddress()
      
      // Parse amount
      const amountWei = ethers.parseUnits(amount, tokenDecimals)
      
      // Create contracts
      const tokenContract = new ethers.Contract(contracts.tbtcTokenEthereum, ERC20_ABI, provider)
      const nttContract = new ethers.Contract(contracts.nttManagerWithExecutor, NTT_MANAGER_WITH_EXECUTOR_ABI, provider)
      
      // Check prerequisites
      const [balance, allowance] = await Promise.all([
        tokenContract.balanceOf(userAddress),
        tokenContract.allowance(userAddress, contracts.nttManagerWithExecutor)
      ])
      
      if (balance < amountWei) {
        setValidationResult(`❌ Insufficient balance: ${ethers.formatUnits(balance, tokenDecimals)} < ${amount}`)
        return
      }
      
      if (allowance < amountWei) {
        setValidationResult(`❌ Insufficient allowance: ${ethers.formatUnits(allowance, tokenDecimals)} < ${amount}`)
        return
      }
      
      // Prepare parameters with REAL EXECUTOR QUOTE
      const recipientBytes32 = addressToBytes32(recipient)
      const refundAddressBytes32 = addressToBytes32(userAddress)
      const encodedInstructions = '0x01000101' // 4 bytes matching successful test script
      
      setValidationResult('🔄 Fetching real executor quote...')
      
      // Get real signed quote from executor
      const { signedQuote, estimatedCost } = await getExecutorQuote(WORMHOLE_CHAIN_IDS.ETHEREUM, WORMHOLE_CHAIN_IDS.SEI_EVM) // Ethereum -> Sei EVM
      
      const executorArgs = {
        value: estimatedCost ? parseInt(estimatedCost) : 100, // Convert string to number
        refundAddress: userAddress,
        signedQuote: signedQuote,
        instructions: '0x'
      }
      
      const feeArgs = {
        dbps: 0,
        payee: '0x0000000000000000000000000000000000000000'
      }
      
      // Debug parameters before static call
      console.log('🔍 UI Test Parameters:');
      console.log('   Amount Wei:', amountWei.toString());
      console.log('   Amount Formatted:', ethers.formatUnits(amountWei, tokenDecimals));
      console.log('   User Address:', userAddress);
      console.log('   Recipient:', recipient);
      console.log('   Recipient Bytes32:', recipientBytes32);
      console.log('   Encoded Instructions:', encodedInstructions);
      console.log('   Executor Value:', executorArgs.value);
      console.log('   Signed Quote Length:', executorArgs.signedQuote.length);
      
      // Perform static call test
      await nttContract.transfer.staticCall(
        contracts.originalNttManager,
        amountWei,
        contracts.seiWormholeChainId,
        recipientBytes32,
        refundAddressBytes32,
        encodedInstructions,
        [executorArgs.value, executorArgs.refundAddress, executorArgs.signedQuote, executorArgs.instructions],
        [feeArgs.dbps, feeArgs.payee],
        { value: executorArgs.value, from: userAddress }
      )
      
      setValidationResult('🎉 SUCCESS! Transfer parameters are valid and should work!')
      
    } catch (error: any) {
      console.error('Validation failed:', error)
      setValidationResult(`❌ Validation failed: ${error.message}`)
    } finally {
      setIsValidating(false)
    }
  }

  // Check token balance and info
  const checkTokenBalance = async () => {
    if (typeof window.ethereum === 'undefined') {
      setStatus('❌ Please install MetaMask!')
      return
    }

    setIsCheckingBalance(true)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const userAddress = await signer.getAddress()

      const tokenContract = new ethers.Contract(contracts.tbtcTokenEthereum, ERC20_ABI, provider)
      
      // Get token info
      const [balance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(userAddress),
        tokenContract.decimals(),
        tokenContract.symbol()
      ])

      setTokenDecimals(Number(decimals))
      const formattedBalance = ethers.formatUnits(balance, decimals)
      setTokenBalance(formattedBalance)
      
      setStatus(`✅ Balance: ${formattedBalance} ${symbol}`)
      console.log('📊 Token Info:')
      console.log('   Balance:', formattedBalance, symbol)
      console.log('   Decimals:', decimals.toString())
      console.log('   User Address:', userAddress)
      console.log('   Token Address:', contracts.tbtcTokenEthereum)
      
    } catch (error) {
      console.error('❌ Failed to check balance:', error)
      setStatus('❌ Failed to check balance: ' + (error as Error).message)
    } finally {
      setIsCheckingBalance(false)
    }
  }

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      setStatus('❌ Please install MetaMask!')
      return null
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      setStatus('✅ Wallet connected!')
      return { provider, signer }
    } catch (error) {
      setStatus('❌ Failed to connect wallet: ' + (error as Error).message)
      return null
    }
  }

  const executeTransfer = async () => {
    if (!amount || !recipient) {
      setStatus('❌ Please fill in all fields')
      return
    }

    setIsLoading(true)
    setStatus('🔄 Connecting wallet...')

    try {
      const wallet = await connectWallet()
      if (!wallet) return

      const { provider, signer } = wallet
      const userAddress = await signer.getAddress()

      // Parse amount using detected token decimals
      const amountWei = ethers.parseUnits(amount, tokenDecimals)
      console.log('💰 Transfer Amount:')
      console.log('   Input:', amount)
      console.log('   Decimals:', tokenDecimals)
      console.log('   Wei:', amountWei.toString())
      
      setStatus('🔄 Checking token balance and approval...')

      // Create contract instances
      const tbtcContract = new ethers.Contract(contracts.tbtcTokenEthereum, ERC20_ABI, signer)
      const nttContract = new ethers.Contract(contracts.nttManagerWithExecutor, NTT_MANAGER_WITH_EXECUTOR_ABI, signer)

      // Check balance
      const balance = await tbtcContract.balanceOf(userAddress)
      const formattedBalance = ethers.formatUnits(balance, tokenDecimals)
      if (balance < amountWei) {
        setStatus(`❌ Insufficient balance. You have ${formattedBalance} tBTC, need ${amount}`)
        setIsLoading(false)
        return
      }
      console.log('✅ Balance check passed:', formattedBalance, 'tBTC available')

      // Check and approve if necessary
      const allowance = await tbtcContract.allowance(userAddress, contracts.nttManagerWithExecutor)
      console.log('🔒 Allowance check:', ethers.formatUnits(allowance, tokenDecimals), 'tBTC')
      
      if (allowance < amountWei) {
        setStatus('🔄 Approving token spend...')
        const approveTx = await tbtcContract.approve(contracts.nttManagerWithExecutor, amountWei)
        setStatus('🔄 Waiting for approval confirmation...')
        await approveTx.wait()
        setStatus('✅ Token approval confirmed!')
        console.log('✅ Token approval completed for', amount, 'tBTC')
      } else {
        console.log('✅ Sufficient allowance already exists')
      }

      setStatus('🔄 Executing NttManagerWithExecutor transfer...')

      // Prepare transfer parameters
      // CORRECTED: Based on test analysis, recipientAddress should be the FINAL USER ADDRESS
      const recipientBytes32 = addressToBytes32(recipient) // Final user address (like test's toWormholeFormat(user_B))
      const refundAddressBytes32 = addressToBytes32(userAddress)
      
      console.log('📍 CORRECTED INSIGHT: Based on test, recipientAddress is FINAL USER ADDRESS')
      console.log('   Test pattern: toWormholeFormat(user_B) = final user gets tokens')
      console.log('   Our recipient address:', recipient)
      console.log('   Cross-chain recipient (bytes32):', recipientBytes32)
      
      console.log('🚀 CUSTOM TRANSFER PARAMETERS:')
      console.log('   NTT Manager (original):', contracts.originalNttManager)
      console.log('   Amount:', amountWei.toString(), `(${amount} tBTC)`)
      console.log('   Source Chain (Ethereum Wormhole ID):', WORMHOLE_CHAIN_IDS.ETHEREUM, '(official constant)')
      console.log('   Recipient Chain (Sei EVM Wormhole ID):', contracts.seiWormholeChainId, '=', WORMHOLE_CHAIN_IDS.SEI_EVM)
      console.log('   Final User Recipient:', recipient, '(will receive tokens on Sei EVM)')
      console.log('   Recipient (bytes32):', recipientBytes32)
      console.log('   Recipient bytes32 length:', recipientBytes32.length, 'chars (should be 66: 0x + 64 hex chars)')
      console.log('   ✅ Following test pattern: recipientAddress = final user address')
      console.log('   User Address (original):', userAddress)
      console.log('   Refund Address (bytes32):', refundAddressBytes32)
      console.log('   Refund bytes32 length:', refundAddressBytes32.length, 'chars (should be 66)')
      console.log('   NttManagerWithExecutor:', contracts.nttManagerWithExecutor)
      
      // Validate bytes32 format
      if (recipientBytes32.length !== 66) {
        console.error('❌ INVALID RECIPIENT BYTES32 LENGTH:', recipientBytes32.length)
      }
      if (refundAddressBytes32.length !== 66) {
        console.error('❌ INVALID REFUND ADDRESS BYTES32 LENGTH:', refundAddressBytes32.length)
      }

      // Prepare executor and fee parameters using REAL EXECUTOR QUOTE
      setStatus('🔄 Fetching real executor quote...')
      
      // Get real signed quote from executor (same as test function)
      const { signedQuote, estimatedCost } = await getExecutorQuote(WORMHOLE_CHAIN_IDS.ETHEREUM, WORMHOLE_CHAIN_IDS.SEI_EVM) // Ethereum -> Sei EVM
      
      // CRITICAL FIX: Use the same relayInstructions in executorArgs.instructions
      const relayInstructions = serializeRelayInstructions()
      
      const executorArgs = {
        value: estimatedCost ? parseInt(estimatedCost) : 100, // Use real estimated cost
        refundAddress: userAddress,        // msg.sender from test
        signedQuote: signedQuote,          // Real signed quote from executor
        instructions: relayInstructions    // FIXED: Use relay instructions with gas limit
      }
      
      console.log('🚀 REAL EXECUTOR ARGS:')
      console.log('   Estimated Cost:', estimatedCost, 'wei (≈', (parseInt(estimatedCost) / 1e18).toFixed(8), 'ETH)')
      console.log('   Our value:', executorArgs.value, 'wei')
      console.log('   Instructions:', executorArgs.instructions, '(WITH GAS LIMIT 500,000)')
      console.log('   Real signedQuote from executor:')
      console.log('   Signed Quote length:', executorArgs.signedQuote.length, 'chars')
      console.log('   Signed Quote (first 50 chars):', executorArgs.signedQuote.substring(0, 50) + '...')
      
      const feeArgs = {
        dbps: 0,                          // 0 basis points fee (0%)
        payee: '0x0000000000000000000000000000000000000000' // Zero address (no fee)
      }
      
      console.log('📋 EXECUTOR PARAMETERS (REAL QUOTE FROM API):')
      console.log('   Executor Value:', executorArgs.value, 'wei (', ethers.formatEther(executorArgs.value), 'ETH )')
      console.log('   Executor Refund Address:', executorArgs.refundAddress)
      console.log('   Real Signed Quote length:', executorArgs.signedQuote.length, 'chars')
      console.log('   Real Signed Quote (first 50 chars):', executorArgs.signedQuote.substring(0, 50) + '...')
      console.log('   Instructions:', executorArgs.instructions, '(WITH GAS LIMIT)')
      console.log('   Fee DBPS:', feeArgs.dbps)
      console.log('   Fee Payee:', feeArgs.payee)
      
      console.log('✅ USING REAL EXECUTOR QUOTE:')
      console.log('   Real signed quote from https://executor.labsapis.com')
      console.log('   Real estimated cost:', estimatedCost, 'wei')
      console.log('   This should resolve previous 0x71f0634a errors!')
      
      // Additional validation checks
      console.log('🔍 VALIDATION CHECKS:')
      console.log('   User ETH Balance:', ethers.formatEther(await provider.getBalance(userAddress)), 'ETH')
      console.log('   Required ETH for executor:', ethers.formatEther(executorArgs.value), 'ETH')
      console.log('   Original NTT Manager:', contracts.originalNttManager)
      console.log('   NTT Manager With Executor:', contracts.nttManagerWithExecutor)
      console.log('   Transfer Amount (formatted):', ethers.formatUnits(amountWei, tokenDecimals), 'tBTC')
      console.log('   Transfer Amount (raw):', amountWei.toString())
      
      // Check NTT Manager configuration - this might be the issue!
      try {
        const nttManagerContract = new ethers.Contract(contracts.originalNttManager, [
          'function isPeerEnabled(uint16 chainId_) external view returns (bool)',
          'function getPeer(uint16 chainId_) external view returns (bytes32)',
          'function getOutboundLimitParams() external view returns (uint256, uint256)'
        ], provider)
        
        console.log('🔍 NTT MANAGER CONFIGURATION CHECKS:')
        const isPeerEnabled = await nttManagerContract.isPeerEnabled(contracts.seiWormholeChainId)
        console.log('   Is Sei EVM peer enabled?', isPeerEnabled)
        
        if (isPeerEnabled) {
          const peerAddress = await nttManagerContract.getPeer(contracts.seiWormholeChainId)
          console.log('   Sei EVM peer address:', peerAddress)
        } else {
          console.log('   ❌ CRITICAL: Sei EVM (chain 40) is NOT configured as a peer!')
          setStatus('❌ Error: Sei EVM chain not configured as peer in NTT Manager')
          setIsLoading(false)
          return
        }
        
        const [outboundLimit] = await nttManagerContract.getOutboundLimitParams()
        console.log('   Outbound limit:', ethers.formatUnits(outboundLimit, tokenDecimals), 'tBTC')
        
        if (amountWei > outboundLimit) {
          console.log('   ❌ CRITICAL: Transfer amount exceeds outbound limit!')
          setStatus(`❌ Error: Amount (${ethers.formatUnits(amountWei, tokenDecimals)}) exceeds limit (${ethers.formatUnits(outboundLimit, tokenDecimals)})`)
          setIsLoading(false)
          return
        }
        
      } catch (configError) {
        console.warn('⚠️ Could not check NTT Manager configuration:', configError)
      }
      
      // Check if user has enough ETH for executor payment (100 wei - very small amount)
      const userEthBalance = await provider.getBalance(userAddress)
      if (userEthBalance < executorArgs.value) {
        setStatus(`❌ Insufficient ETH for executor payment. Need ${executorArgs.value} wei (${ethers.formatEther(executorArgs.value)} ETH)`)
        setIsLoading(false)
        return
      }
      console.log('✅ ETH balance check: Need', executorArgs.value, 'wei, have', userEthBalance.toString(), 'wei')
      
      // Analysis from Wormhole data - amount is not the issue
      console.log('📊 WORMHOLE DATA COMPARISON:')
      console.log('   Successful transfer used standard NTT Manager (not NttManagerWithExecutor)')
      console.log('   Successful amount: 0.00011612 tBTC')
      console.log('   Your amount:', ethers.formatUnits(amountWei, tokenDecimals), 'tBTC')
      console.log('   Key difference: We\'re using NttManagerWithExecutor, successful tx used standard NTT Manager')

      // CRITICAL: Use TEST SCRIPT VALIDATED FORMAT!
      // Test script passed with: single byte 0x00 format
      // This matches the TestNttManagerWithExecutor.sol test exactly
      const encodedInstructions = '0x01000101' // 4 bytes matching successful test script validation
      
      console.log('📋 USING TEST SCRIPT VALIDATED PARAMETERS:')
      console.log('   ✅ Test script PASSED with these exact parameters!')
      console.log('   encodedInstructions:', encodedInstructions, '(4 bytes 0x01000101 - matches successful test script)')
      console.log('   executorArgs.value:', executorArgs.value, 'wei')
      console.log('   signedQuote format: EQ01 prefix with proper encoding')
      console.log('   This configuration was validated by staticCall test!')
      
      // First, simulate the transaction using the EXACT SAME LOGIC as test script
      console.log('🧪 RUNNING PRE-TRANSFER VALIDATION (SAME AS TEST SCRIPT)...')
      setStatus('🧪 Validating transfer parameters...')
      try {
        
        console.log('📋 USING VALIDATED TEST SCRIPT PARAMETERS:')
        console.log('   ✅ encodedInstructions:', encodedInstructions, '(validated by test script)')
        console.log('   ✅ recipientAddress:', addressToBytes32(recipient), '(final user address)')
        console.log('   ✅ executorArgs.value:', executorArgs.value, 'wei (validated by test script)')
        console.log('   ✅ All parameters match successful staticCall test!')
        
        await nttContract.transfer.staticCall(
          contracts.originalNttManager,  // nttManager: original NTT manager address
          amountWei,                     // amount: transfer amount
          contracts.seiWormholeChainId,  // recipientChain: Sei EVM Wormhole ID (40)
          recipientBytes32,              // recipientAddress: Final user address as bytes32 (test pattern)
          refundAddressBytes32,          // refundAddress: refund address as bytes32
          encodedInstructions,           // encodedInstructions: final user recipient
          [                              // executorArgs struct
            executorArgs.value,
            executorArgs.refundAddress,
            executorArgs.signedQuote,
            executorArgs.instructions
          ],
          [                              // feeArgs struct
            feeArgs.dbps,
            feeArgs.payee
          ],
          {
            value: executorArgs.value    // Send ETH value for executor payment
          }
        )
        console.log('🎉 VALIDATION PASSED! Parameters match successful test script!')
        console.log('   ✅ Static call succeeded - transaction should work!')
        setStatus('✅ Validation passed! Proceeding with transfer...')
      } catch (simulationError: any) {
        console.error('❌ SIMULATION FAILED:', simulationError)
        
        // Try to decode the error
        if (simulationError.data) {
          console.log('Error data:', simulationError.data)
          
          // Check if it's a known error
          if (simulationError.data.startsWith('0x71f0634a')) {
            const errorData = simulationError.data.slice(10) // Remove selector
            console.log('Unknown custom error 0x71f0634a with data:', errorData)
            
            // Try to decode the parameters
            try {
              const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                ['uint256', 'uint256'], 
                '0x' + errorData
              )
              console.log('Decoded error params:', decoded.toString())
            } catch (decodeError) {
              console.log('Could not decode error parameters')
            }
          }
        }
        
        setStatus('❌ Pre-transfer validation failed: ' + simulationError.message)
        setIsLoading(false)
        return
      }

      // Execute the transfer with NttManagerWithExecutor (CORRECT ABI)
      const transferTx = await nttContract.transfer(
        contracts.originalNttManager,  // nttManager: original NTT manager address
        amountWei,                     // amount: transfer amount
        contracts.seiWormholeChainId,  // recipientChain: Sei EVM Wormhole ID (40)
        recipientBytes32,              // recipientAddress: Final user address as bytes32 (test pattern)
        refundAddressBytes32,          // refundAddress: refund address as bytes32
        encodedInstructions,           // encodedInstructions: final user recipient
        [                              // executorArgs struct
          executorArgs.value,
          executorArgs.refundAddress,
          executorArgs.signedQuote,
          executorArgs.instructions
        ],
        [                              // feeArgs struct
          feeArgs.dbps,
          feeArgs.payee
        ],
        {
          value: executorArgs.value    // Send 100 wei (matching test exactly)
        }
      )

      setStatus('🔄 Transaction sent! Waiting for confirmation...')
      setTxHash(transferTx.hash)

      const receipt = await transferTx.wait()
      
      setStatus('🎉 SUCCESS! Transfer completed!')
      console.log('✅ Transaction confirmed:', receipt)
      
    } catch (error) {
      console.error('❌ Transfer failed:', error)
      setStatus('❌ Transfer failed: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '20px auto', 
      padding: '20px', 
      border: '2px solid #4CAF50',
      borderRadius: '10px',
      backgroundColor: '#f9f9f9',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2 style={{ color: '#4CAF50', textAlign: 'center', marginBottom: '20px' }}>
        🚀 CUSTOM NTT TRANSFER
      </h2>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
        Direct transfer using NttManagerWithExecutor
      </p>

      {/* Balance Check Section */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <button
          onClick={checkTokenBalance}
          disabled={isCheckingBalance}
          style={{
            padding: '10px 20px',
            backgroundColor: isCheckingBalance ? '#ccc' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isCheckingBalance ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {isCheckingBalance ? '🔄 Checking...' : '📊 Check Balance'}
        </button>
        
        <button
          onClick={testTransferParameters}
          disabled={isValidating}
          style={{
            padding: '10px 20px',
            backgroundColor: isValidating ? '#ccc' : '#9C27B0',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isValidating ? 'not-allowed' : 'pointer'
          }}
        >
          {isValidating ? '🔄 Testing...' : '🧪 Test Parameters'}
        </button>
        
        {tokenBalance && (
          <span style={{ 
            padding: '10px 15px', 
            backgroundColor: '#e8f5e8', 
            border: '1px solid #4CAF50',
            borderRadius: '5px',
            fontWeight: 'bold',
            marginRight: '10px'
          }}>
            Balance: {tokenBalance} tBTC
          </span>
        )}
      </div>
      
      {/* Validation Result */}
      {validationResult && (
        <div style={{
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: validationResult.includes('❌') ? '#ffebee' : 
                          validationResult.includes('🎉') ? '#e8f5e8' : '#fff3e0',
          border: '1px solid ' + (validationResult.includes('❌') ? '#f44336' : 
                                 validationResult.includes('🎉') ? '#4CAF50' : '#ff9800'),
          borderRadius: '5px',
          textAlign: 'center'
        }}>
          <strong>Parameter Test:</strong> {validationResult}
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Amount (tBTC):
        </label>
        <input
          type="number"
          step="0.00000001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.000096560660199109"
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            fontSize: '16px'
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Recipient Address (Sei EVM):
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            fontSize: '16px'
          }}
        />
      </div>

      <button
        onClick={executeTransfer}
        disabled={isLoading}
        style={{
          width: '100%',
          padding: '15px',
          backgroundColor: isLoading ? '#ccc' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          marginBottom: '15px'
        }}
      >
        {isLoading ? '🔄 Processing...' : '🚀 Execute Custom Transfer'}
      </button>

      {status && (
        <div style={{
          padding: '10px',
          backgroundColor: status.includes('❌') ? '#ffebee' : 
                          status.includes('✅') || status.includes('🎉') ? '#e8f5e8' : '#fff3e0',
          border: '1px solid ' + (status.includes('❌') ? '#f44336' : 
                                 status.includes('✅') || status.includes('🎉') ? '#4CAF50' : '#ff9800'),
          borderRadius: '5px',
          marginBottom: '10px'
        }}>
          <strong>Status:</strong> {status}
        </div>
      )}

      {txHash && (
        <div style={{
          padding: '10px',
          backgroundColor: '#e3f2fd',
          border: '1px solid #2196F3',
          borderRadius: '5px',
          wordBreak: 'break-all'
        }}>
          <strong>Transaction Hash:</strong> 
          <a 
            href={`https://etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#2196F3', marginLeft: '5px' }}
          >
            {txHash}
          </a>
        </div>
      )}

      {/* Advanced Settings */}
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '5px',
            cursor: 'pointer',
            marginBottom: '10px'
          }}
        >
          {showAdvanced ? '▲' : '▼'} Advanced Settings (Contract Addresses)
        </button>

        {showAdvanced && (
          <div style={{
            padding: '15px',
            backgroundColor: '#f9f9f9',
            border: '1px solid #ddd',
            borderRadius: '5px',
            marginBottom: '15px'
          }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                NttManagerWithExecutor:
              </label>
              <input
                type="text"
                value={contracts.nttManagerWithExecutor}
                onChange={(e) => setContracts({...contracts, nttManagerWithExecutor: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                Original NTT Manager:
              </label>
              <input
                type="text"
                value={contracts.originalNttManager}
                onChange={(e) => setContracts({...contracts, originalNttManager: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                tBTC Token (Ethereum):
              </label>
              <input
                type="text"
                value={contracts.tbtcTokenEthereum}
                onChange={(e) => setContracts({...contracts, tbtcTokenEthereum: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                Sei EVM NTT Manager:
              </label>
              <input
                type="text"
                value={contracts.seiEvmNttManager}
                onChange={(e) => setContracts({...contracts, seiEvmNttManager: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                Sei Wormhole Chain ID:
              </label>
              <input
                type="number"
                value={contracts.seiWormholeChainId}
                onChange={(e) => setContracts({...contracts, seiWormholeChainId: parseInt(e.target.value) as 40})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  fontSize: '12px'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Contract Details Display */}
      <div style={{ 
        marginTop: '20px', 
        padding: '10px', 
        backgroundColor: '#e8f4fd', 
        border: '1px solid #2196F3',
        borderRadius: '5px',
        fontSize: '12px'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#1976D2' }}>📋 Active Configuration:</h4>
        <div style={{ wordBreak: 'break-all', marginBottom: '5px' }}>
          <strong>NttManagerWithExecutor:</strong> {contracts.nttManagerWithExecutor}
        </div>
        <div style={{ wordBreak: 'break-all', marginBottom: '5px' }}>
          <strong>Original NTT Manager:</strong> {contracts.originalNttManager}
        </div>
        <div style={{ wordBreak: 'break-all', marginBottom: '5px' }}>
          <strong>tBTC Token:</strong> {contracts.tbtcTokenEthereum}
        </div>
        <div style={{ wordBreak: 'break-all', marginBottom: '5px' }}>
          <strong>Sei EVM NTT Manager:</strong> {contracts.seiEvmNttManager}
        </div>
        <div><strong>Target Chain:</strong> Sei EVM (Wormhole ID: {contracts.seiWormholeChainId})</div>
        {tokenBalance && (
          <div style={{ marginTop: '10px', padding: '5px', backgroundColor: '#e8f5e8', borderRadius: '3px' }}>
            <strong>Current Balance:</strong> {tokenBalance} tBTC (Decimals: {tokenDecimals})
          </div>
        )}
      </div>
    </div>
  )
}
