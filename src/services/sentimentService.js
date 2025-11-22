import toast from 'react-hot-toast';

/**
 * Fetch Fear & Greed Index from Alternative.me
 * Free API, no key required
 * Updates daily
 */
export async function fetchFearGreedIndex() {
    try {
        // Alternative.me API - free, no key needed
        const response = await fetch('https://api.alternative.me/fng/?limit=30');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data || !data.data || !data.data[0]) {
            throw new Error('Invalid response format');
        }

        const current = data.data[0];
        const history = data.data.slice(0, 30);

        return {
            current: {
                value: parseInt(current.value),
                classification: current.value_classification,
                timestamp: parseInt(current.timestamp) * 1000,
                lastUpdate: new Date(parseInt(current.timestamp) * 1000).toISOString()
            },
            history: history.map(d => ({
                value: parseInt(d.value),
                classification: d.value_classification,
                timestamp: parseInt(d.timestamp) * 1000
            })),
            metadata: {
                source: 'Alternative.me',
                updateFrequency: 'Daily',
                scale: '0-100 (0 = Extreme Fear, 100 = Extreme Greed)'
            }
        };
    } catch (error) {
        console.error('Fear & Greed Index fetch error:', error);
        toast.error(`Sentiment API Error: ${error.message}`);
        return null;
    }
}

/**
 * Get sentiment color based on value
 */
export function getSentimentColor(value) {
    if (value >= 75) return '#00FF9D'; // Extreme Greed - Green
    if (value >= 55) return '#7FFF00'; // Greed - Light Green
    if (value >= 45) return '#FFD700'; // Neutral - Gold
    if (value >= 25) return '#FF8C00'; // Fear - Orange
    return '#FF0055'; // Extreme Fear - Red
}

/**
 * Get sentiment label
 */
export function getSentimentLabel(value) {
    if (value >= 75) return 'Extreme Greed';
    if (value >= 55) return 'Greed';
    if (value >= 45) return 'Neutral';
    if (value >= 25) return 'Fear';
    return 'Extreme Fear';
}

export default fetchFearGreedIndex;
