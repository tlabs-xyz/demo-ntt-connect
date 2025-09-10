'use client';

import WormholeConnect, {
    type config,
    nttWithExecutorRoutes,
  } from '@wormhole-foundation/wormhole-connect';
import {
  nttRoutes,
} from '@wormhole-foundation/wormhole-connect/ntt';
import CustomNttTransfer from '../components/CustomNttTransfer';

// Force mainnet and debug configuration
console.log('🔧 WORMHOLE CONFIG DEBUG:');
console.log('Network: Mainnet (FORCED)');
console.log('Ethereum Manager:', '0x79eb9aF995a443A102A19b41EDbB58d66e2921c7');
console.log('Sei EVM Manager:', '0xc10a0886d4Fe06bD61f41ee2855a2215375B82f0');

const wormholeConfig: config.WormholeConnectConfig = {
  network: 'Mainnet', // EXPLICITLY FORCE MAINNET
  chains: ['Ethereum', 'Seievm'],
  tokens: ['tBTC'],
  ui: {
    title: 'Wormhole NTT UI',
    defaultInputs: {
      fromChain: 'Ethereum',
      toChain: 'Seievm'
    },
    showUSDValue: false, // Disable USD price display to avoid CORS
    // walletConnectProjectId: '', 
  },
  // Add RPC configuration for Seievm chain
  rpcs: {
    Seievm: 'https://evm-rpc.sei-apis.com',
  },
  routes: [
    // Use NttManagerWithExecutor for enhanced functionality
    ...nttWithExecutorRoutes({
      tokens: {
        tBTC: [
          {
            chain: 'Ethereum',
            manager: '0x79eb9aF995a443A102A19b41EDbB58d66e2921c7', // Original NTT manager
            managerWithExecutor: '0xd2d9c936165a85f27a5a7e07afb974d022b89463', // NttManagerWithExecutor wrapper
            token: '0x18084fbA666a33d37592fA2633fD49a74DD93a88',
            transceiver: [
              {
                address: '0x73D19b20B374bFE4105c2b0De55504512f0C2AA7',
                type: 'wormhole',
              },
            ],
          },
          {
            chain: 'Seievm',
            manager: '0xc10a0886d4Fe06bD61f41ee2855a2215375B82f0', // Original NTT manager
            managerWithExecutor: '0x3F2D6441C7a59Dfe80f8e14142F9E28F6D440445', // NttManagerWithExecutor wrapper
            token: '0xF9201c9192249066Aec049ae7951ae298BBEc767',
            transceiver: [
              {
                address: '0x83849F9c2EB47Ce0D59524a43CB101533bc1b6A6',
                type: 'wormhole',
              },
            ],
          },
        ],
      },
    }),
  ],
  tokensConfig: {
    tBTC: {
      symbol: 'tBTC',
      tokenId: {
        chain: 'Ethereum',
        address: '0x18084fbA666a33d37592fA2633fD49a74DD93a88'
      },
      icon: 'https://wormhole.com/token.png',
      decimals: 18
    }
  }
}

export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px'
    }}>
      {/* ✅ FIXED: Wormhole Connect now uses correct mainnet addresses */}
      <div style={{ 
        width: '100%', 
        maxWidth: '480px', 
        padding: '20px',
        border: '2px solid #4caf50',
        borderRadius: '8px',
        backgroundColor: '#2a2a2a',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#4caf50', margin: '0 0 10px 0' }}>✅ Mainnet Addresses Fixed!</h3>
        <p style={{ color: '#fff', margin: '0', fontSize: '14px' }}>
          Wormhole Connect now uses correct mainnet addresses. Both UI options available below.
        </p>
      </div>
      
      {/* Re-enable Wormhole Connect */}
      <div style={{ width: '100%', maxWidth: '480px', marginBottom: '20px' }}>
        <WormholeConnect 
          config={wormholeConfig} 
          theme={{ mode: 'dark', primary: '#78c4b6' }} 
        /> 
      </div>
      
      {/* Alternative: Custom NTT Transfer Component */}
      <CustomNttTransfer />
    </div>
  )
}