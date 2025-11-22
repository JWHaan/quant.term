import { useState, useEffect } from 'react';

// Symbol mapping for CoinGecko API
const SYMBOL_MAP = {
    'BTCUSDT': 'bitcoin',
    'ETHUSDT': 'ethereum',
    'SOLUSDT': 'solana',
    'BNBUSDT': 'binancecoin',
    'DOGEUSDT': 'dogecoin'
};

export const useFundamentals = (symbol) => {
    const [data, setData] = useState({
        marketCap: 0,
        volume24h: 0,
        circulatingSupply: 0,
        totalSupply: 0,
        maxSupply: 0,
        ath: 0,
        athChangePercentage: 0,
        atl: 0,
        atlChangePercentage: 0,
        priceChange24h: 0,
        priceChangePercentage24h: 0,
        marketCapRank: 0,
        volumeToMarketCap: 0,
        loading: true,
        error: null
    });

    useEffect(() => {
        const coinId = SYMBOL_MAP[symbol] || 'bitcoin';

        const fetchFundamentals = async () => {
            try {
                const response = await fetch(
                    `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch fundamentals');
                }

                const coin = await response.json();
                const marketData = coin.market_data;

                setData({
                    marketCap: marketData.market_cap.usd,
                    volume24h: marketData.total_volume.usd,
                    circulatingSupply: marketData.circulating_supply,
                    totalSupply: marketData.total_supply,
                    maxSupply: marketData.max_supply,
                    ath: marketData.ath.usd,
                    athChangePercentage: marketData.ath_change_percentage.usd,
                    atl: marketData.atl.usd,
                    atlChangePercentage: marketData.atl_change_percentage.usd,
                    priceChange24h: marketData.price_change_24h,
                    priceChangePercentage24h: marketData.price_change_percentage_24h,
                    marketCapRank: coin.market_cap_rank,
                    volumeToMarketCap: marketData.total_volume.usd / marketData.market_cap.usd,
                    loading: false,
                    error: null
                });
            } catch (error) {
                console.error('Error fetching fundamentals:', error);
                setData(prev => ({
                    ...prev,
                    loading: false,
                    error: error.message
                }));
            }
        };

        fetchFundamentals();
        // Refresh every 60 seconds
        const interval = setInterval(fetchFundamentals, 60000);

        return () => clearInterval(interval);
    }, [symbol]);

    return data;
};
