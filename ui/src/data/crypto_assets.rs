//! Port of `src/data/cryptoAssets.ts` — top-40 Binance spot assets and the
//! category → symbol grouping used by tests and any category-filtered UI.

use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize)]
pub struct CryptoAsset {
    pub symbol: &'static str,
    pub name: &'static str,
    pub category: &'static str,
}

/// TOP_CRYPTOS — top 40 cryptocurrencies by market cap on Binance Spot.
pub const TOP_CRYPTOS: &[CryptoAsset] = &[
    CryptoAsset { symbol: "BTCUSDT", name: "Bitcoin", category: "Layer 1" },
    CryptoAsset { symbol: "ETHUSDT", name: "Ethereum", category: "Layer 1" },
    CryptoAsset { symbol: "BNBUSDT", name: "BNB", category: "Exchange" },
    CryptoAsset { symbol: "SOLUSDT", name: "Solana", category: "Layer 1" },
    CryptoAsset { symbol: "XRPUSDT", name: "XRP", category: "Payments" },
    CryptoAsset { symbol: "ADAUSDT", name: "Cardano", category: "Layer 1" },
    CryptoAsset { symbol: "AVAXUSDT", name: "Avalanche", category: "Layer 1" },
    CryptoAsset { symbol: "DOGEUSDT", name: "Dogecoin", category: "Meme" },
    CryptoAsset { symbol: "DOTUSDT", name: "Polkadot", category: "Layer 0" },
    CryptoAsset { symbol: "POLUSDT", name: "Polygon", category: "Layer 2" },
    CryptoAsset { symbol: "LINKUSDT", name: "Chainlink", category: "Oracle" },
    CryptoAsset { symbol: "TRXUSDT", name: "TRON", category: "Layer 1" },
    CryptoAsset { symbol: "ATOMUSDT", name: "Cosmos", category: "Layer 0" },
    CryptoAsset { symbol: "UNIUSDT", name: "Uniswap", category: "DeFi" },
    CryptoAsset { symbol: "LTCUSDT", name: "Litecoin", category: "Layer 1" },
    CryptoAsset { symbol: "ETCUSDT", name: "Ethereum Classic", category: "Layer 1" },
    CryptoAsset { symbol: "APTUSDT", name: "Aptos", category: "Layer 1" },
    CryptoAsset { symbol: "NEARUSDT", name: "NEAR Protocol", category: "Layer 1" },
    CryptoAsset { symbol: "ARBUSDT", name: "Arbitrum", category: "Layer 2" },
    CryptoAsset { symbol: "OPUSDT", name: "Optimism", category: "Layer 2" },
    CryptoAsset { symbol: "SHIBUSDT", name: "Shiba Inu", category: "Meme" },
    CryptoAsset { symbol: "SUIUSDT", name: "Sui", category: "Layer 1" },
    CryptoAsset { symbol: "FILUSDT", name: "Filecoin", category: "Storage" },
    CryptoAsset { symbol: "ICPUSDT", name: "Internet Computer", category: "Layer 1" },
    CryptoAsset { symbol: "INJUSDT", name: "Injective", category: "DeFi" },
    CryptoAsset { symbol: "AAVEUSDT", name: "Aave", category: "DeFi" },
    CryptoAsset { symbol: "LDOUSDT", name: "Lido DAO", category: "DeFi" },
    CryptoAsset { symbol: "RENDERUSDT", name: "Render", category: "AI/GPU" },
    CryptoAsset { symbol: "SKYUSDT", name: "Sky", category: "DeFi" },
    CryptoAsset { symbol: "GRTUSDT", name: "The Graph", category: "Indexing" },
    CryptoAsset { symbol: "VETUSDT", name: "VeChain", category: "Supply Chain" },
    CryptoAsset { symbol: "ALGOUSDT", name: "Algorand", category: "Layer 1" },
    CryptoAsset { symbol: "SUSDT", name: "Sonic", category: "Layer 1" },
    CryptoAsset { symbol: "MANAUSDT", name: "Decentraland", category: "Metaverse" },
    CryptoAsset { symbol: "SANDUSDT", name: "The Sandbox", category: "Metaverse" },
    CryptoAsset { symbol: "AXSUSDT", name: "Axie Infinity", category: "Gaming" },
    CryptoAsset { symbol: "EGLDUSDT", name: "MultiversX", category: "Layer 1" },
    CryptoAsset { symbol: "FLOWUSDT", name: "Flow", category: "Layer 1" },
    CryptoAsset { symbol: "XTZUSDT", name: "Tezos", category: "Layer 1" },
    CryptoAsset { symbol: "THETAUSDT", name: "Theta Network", category: "Media" },
];

/// CRYPTO_CATEGORIES — category name → member symbols (mirrors the TS record).
pub const CRYPTO_CATEGORIES: &[(&str, &[&str])] = &[
    ("Layer 1", &[
        "BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "AVAXUSDT", "DOTUSDT", "TRXUSDT",
        "LTCUSDT", "ETCUSDT", "APTUSDT", "NEARUSDT", "SUIUSDT", "ICPUSDT", "ALGOUSDT",
        "SUSDT", "EGLDUSDT", "FLOWUSDT", "XTZUSDT",
    ]),
    ("Layer 2", &["POLUSDT", "ARBUSDT", "OPUSDT"]),
    ("Layer 0", &["DOTUSDT", "ATOMUSDT"]),
    ("DeFi", &["UNIUSDT", "AAVEUSDT", "INJUSDT", "LDOUSDT", "SKYUSDT"]),
    ("Meme", &["DOGEUSDT", "SHIBUSDT"]),
    ("Infrastructure", &["LINKUSDT", "GRTUSDT", "FILUSDT", "RENDERUSDT"]),
    ("Gaming/Metaverse", &["MANAUSDT", "SANDUSDT", "AXSUSDT", "THETAUSDT"]),
    ("Other", &["BNBUSDT", "XRPUSDT", "VETUSDT"]),
];

/// Look up an asset by its Binance symbol.
pub fn find_asset(symbol: &str) -> Option<&'static CryptoAsset> {
    TOP_CRYPTOS.iter().find(|a| a.symbol == symbol)
}

/// All TOP_CRYPTOS symbols — the default watchlist seed (watchlist.ts).
pub fn watchlist_symbols() -> Vec<String> {
    TOP_CRYPTOS.iter().map(|a| a.symbol.to_string()).collect()
}

/// encodeURIComponent for the ASCII JSON symbol list.
fn encode_uri_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'!' | b'~'
            | b'*' | b'\'' | b'(' | b')' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// 24hr mini-ticker seed URL for a symbol list (watchlist.ts).
pub fn build_watchlist_seed_url(symbols: &[String]) -> String {
    let list: Vec<&str> = symbols.iter().map(|s| s.as_str()).collect();
    let json = serde_json::to_string(&list).unwrap_or_else(|_| "[]".to_string());
    format!(
        "{}/api/v3/ticker/24hr?symbols={}&type=MINI",
        crate::stores::BINANCE_REST_URL,
        encode_uri_component(&json)
    )
}
