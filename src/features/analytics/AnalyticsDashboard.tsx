import React, { useState } from 'react';
import { CorrelationHeatmap } from '../charts/CorrelationHeatmap';
import { VolatilitySurface3D } from '../charts/VolatilitySurface3D';
import { OrderFlowSankey } from '../charts/OrderFlowSankey';
import { exportDataToCSV } from '../../utils/exportUtils';
import { Download, Activity, Layers, GitMerge } from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'correlations' | 'volatility' | 'orderflow'>('correlations');

    // Mock Data
    const correlationData = [
        [1, 0.8, -0.2],
        [0.8, 1, 0.1],
        [-0.2, 0.1, 1]
    ];
    const correlationLabels = ['BTC', 'ETH', 'SOL'];

    const volData = Array.from({ length: 100 }, (_, i) => ({
        strike: 30000 + (i % 10) * 1000,
        expiry: Math.floor(i / 10) * 30,
        vol: 0.5 + Math.random() * 0.2
    }));

    const sankeyNodes = [
        { name: "Buyers" }, { name: "Sellers" },
        { name: "Limit Orders" }, { name: "Market Orders" },
        { name: "Filled" }
    ];
    const sankeyLinks = [
        { source: 0, target: 3, value: 50 },
        { source: 1, target: 2, value: 30 },
        { source: 3, target: 4, value: 40 },
        { source: 2, target: 4, value: 20 }
    ];

    const handleExport = () => {
        if (activeTab === 'correlations') {
            exportDataToCSV(correlationData, 'correlations.csv');
        }
        // Chart export logic would require ref to the specific chart element
    };

    return (
        <div className="h-full overflow-auto bg-[var(--bg-app)] text-[var(--text-primary)] font-mono p-4">
            <div className="flex justify-between items-center mb-6 border-b border-[var(--border-color)] pb-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Activity size={20} />
                    &gt; ANALYTICS_DASHBOARD
                </h2>
                <div className="space-x-2">
                    <button
                        onClick={handleExport}
                        className="px-4 py-1 bg-[rgba(51,255,0,0.1)] border border-[var(--accent-primary)] text-[var(--accent-primary)] hover:bg-[rgba(51,255,0,0.2)] flex items-center gap-2 text-xs"
                    >
                        <Download size={12} />
                        [EXPORT_DATA]
                    </button>
                </div>
            </div>

            <div className="flex space-x-1 mb-6 border-b border-[var(--border-subtle)]">
                <button
                    className={`px-4 py-2 text-xs flex items-center gap-2 ${activeTab === 'correlations'
                        ? 'bg-[var(--accent-primary)] text-black font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                    onClick={() => setActiveTab('correlations')}
                >
                    <Layers size={12} />
                    [CORRELATIONS]
                </button>
                <button
                    className={`px-4 py-2 text-xs flex items-center gap-2 ${activeTab === 'volatility'
                        ? 'bg-[var(--accent-primary)] text-black font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                    onClick={() => setActiveTab('volatility')}
                >
                    <Activity size={12} />
                    [VOLATILITY_SURFACE]
                </button>
                <button
                    className={`px-4 py-2 text-xs flex items-center gap-2 ${activeTab === 'orderflow'
                        ? 'bg-[var(--accent-primary)] text-black font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                    onClick={() => setActiveTab('orderflow')}
                >
                    <GitMerge size={12} />
                    [ORDER_FLOW]
                </button>
            </div>

            <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 min-h-[500px] flex justify-center items-center relative">
                {/* Corner Decorations */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[var(--accent-primary)]" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[var(--accent-primary)]" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[var(--accent-primary)]" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[var(--accent-primary)]" />

                {activeTab === 'correlations' && (
                    <CorrelationHeatmap data={correlationData} labels={correlationLabels} />
                )}
                {activeTab === 'volatility' && (
                    <VolatilitySurface3D data={volData} />
                )}
                {activeTab === 'orderflow' && (
                    <OrderFlowSankey nodes={sankeyNodes} links={sankeyLinks} />
                )}
            </div>
        </div>
    );
};
