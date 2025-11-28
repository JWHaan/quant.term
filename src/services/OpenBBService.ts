
export interface MacroIndicator {
    date: string;
    value: number;
}

export interface MacroData {
    gdp: MacroIndicator[];
    cpi: MacroIndicator[];
    fedRate: MacroIndicator[];
    unemployment: MacroIndicator[];
}

/**
 * Mock Service to simulate OpenBB integration.
 * In a real app, this would connect to a local OpenBB REST API or Python backend.
 */
export const OpenBBService = {
    /**
     * Fetches macro data (mocked for now).
     */
    getMacroData: async (): Promise<MacroData> => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        // Generate 12 months of mock data
        const months = Array.from({ length: 12 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (11 - i));
            return d.toISOString().split('T')[0];
        }) as string[];

        return {
            gdp: months.map((date, i) => ({
                date,
                value: 2.5 + (Math.sin(i / 2) * 0.5) + (Math.random() * 0.1)
            })),
            cpi: months.map((date, i) => ({
                date,
                value: 3.0 + (Math.cos(i / 3) * 0.4) + (Math.random() * 0.1)
            })),
            fedRate: months.map((date, i) => ({
                date,
                value: 5.25 + (i > 6 ? 0.25 : 0) // Simulate a hike
            })),
            unemployment: months.map((date) => ({
                date,
                value: 3.7 + (Math.random() * 0.2)
            }))
        };
    },

    /**
     * Fetches correlation data between Crypto and Macro (mocked).
     */
    getCorrelations: async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return [
            { asset: 'BTC', macro: 'CPI', correlation: -0.45 },
            { asset: 'BTC', macro: 'M2 Supply', correlation: 0.82 },
            { asset: 'ETH', macro: 'Nasdaq', correlation: 0.75 },
            { asset: 'SOL', macro: 'Fed Rate', correlation: -0.30 },
        ];
    }
};
