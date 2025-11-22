// Top 40 cryptocurrencies by market cap
// Updated for 2025 market landscape

export interface CryptoAsset {
    symbol: string;
    name: string;
    category: string;
}

export const TOP_CRYPTOS: CryptoAsset[] = [
    { symbol: 'BTCUSDT', name: 'Bitcoin', category: 'Layer 1' },
    { symbol: 'ETHUSDT', name: 'Ethereum', category: 'Layer 1' },
    { symbol: 'BNBUSDT', name: 'BNB', category: 'Exchange' },
    { symbol: 'SOLUSDT', name: 'Solana', category: 'Layer 1' },
    { symbol: 'XRPUSDT', name: 'XRP', category: 'Payments' },
    { symbol: 'ADAUSDT', name: 'Cardano', category: 'Layer 1' },
    { symbol: 'AVAXUSDT', name: 'Avalanche', category: 'Layer 1' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin', category: 'Meme' },
    { symbol: 'DOTUSDT', name: 'Polkadot', category: 'Layer 0' },
    { symbol: 'MATICUSDT', name: 'Polygon', category: 'Layer 2' },
    { symbol: 'LINKUSDT', name: 'Chainlink', category: 'Oracle' },
    { symbol: 'TRXUSDT', name: 'TRON', category: 'Layer 1' },
    { symbol: 'ATOMUSDT', name: 'Cosmos', category: 'Layer 0' },
    { symbol: 'UNIUSDT', name: 'Uniswap', category: 'DeFi' },
    { symbol: 'LTCUSDT', name: 'Litecoin', category: 'Layer 1' },
    { symbol: 'ETCUSDT', name: 'Ethereum Classic', category: 'Layer 1' },
    { symbol: 'APTUSDT', name: 'Aptos', category: 'Layer 1' },
    { symbol: 'NEARUSDT', name: 'NEAR Protocol', category: 'Layer 1' },
    { symbol: 'ARBUSDT', name: 'Arbitrum', category: 'Layer 2' },
    { symbol: 'OPUSDT', name: 'Optimism', category: 'Layer 2' },
    { symbol: 'SHIBUSDT', name: 'Shiba Inu', category: 'Meme' },
    { symbol: 'SUIUSDT', name: 'Sui', category: 'Layer 1' },
    { symbol: 'FILUSDT', name: 'Filecoin', category: 'Storage' },
    { symbol: 'ICPUSDT', name: 'Internet Computer', category: 'Layer 1' },
    { symbol: 'INJUSDT', name: 'Injective', category: 'DeFi' },
    { symbol: 'AAVEUSDT', name: 'Aave', category: 'DeFi' },
    { symbol: 'LDOUSDT', name: 'Lido DAO', category: 'DeFi' },
    { symbol: 'RNDRUSDT', name: 'Render', category: 'AI/GPU' },
    { symbol: 'MKRUSDT', name: 'Maker', category: 'DeFi' },
    { symbol: 'GRTUSDT', name: 'The Graph', category: 'Indexing' },
    { symbol: 'VETUSDT', name: 'VeChain', category: 'Supply Chain' },
    { symbol: 'ALGOUSDT', name: 'Algorand', category: 'Layer 1' },
    { symbol: 'FTMUSDT', name: 'Fantom', category: 'Layer 1' },
    { symbol: 'MANAUSDT', name: 'Decentraland', category: 'Metaverse' },
    { symbol: 'SANDUSDT', name: 'The Sandbox', category: 'Metaverse' },
    { symbol: 'AXSUSDT', name: 'Axie Infinity', category: 'Gaming' },
    { symbol: 'EGLDUSDT', name: 'MultiversX', category: 'Layer 1' },
    { symbol: 'FLOWUSDT', name: 'Flow', category: 'Layer 1' },
    { symbol: 'XTZUSDT', name: 'Tezos', category: 'Layer 1' },
    { symbol: 'THETAUSDT', name: 'Theta Network', category: 'Media' }
];

export const CRYPTO_CATEGORIES: Record<string, string[]> = {
    'Layer 1': ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'TRXUSDT', 'LTCUSDT', 'ETCUSDT', 'APTUSDT', 'NEARUSDT', 'SUIUSDT', 'ICPUSDT', 'ALGOUSDT', 'FTMUSDT', 'EGLDUSDT', 'FLOWUSDT', 'XTZUSDT'],
    'Layer 2': ['MATICUSDT', 'ARBUSDT', 'OPUSDT'],
    'Layer 0': ['DOTUSDT', 'ATOMUSDT'],
    'DeFi': ['UNIUSDT', 'AAVEUSDT', 'INJUSDT', 'LDOUSDT', 'MKRUSDT'],
    'Meme': ['DOGEUSDT', 'SHIBUSDT'],
    'Infrastructure': ['LINKUSDT', 'GRTUSDT', 'FILUSDT', 'RNDRUSDT'],
    'Gaming/Metaverse': ['MANAUSDT', 'SANDUSDT', 'AXSUSDT', 'THETAUSDT'],
    'Other': ['BNBUSDT', 'XRPUSDT', 'VETUSDT']
};

export default TOP_CRYPTOS;
