import React, { Suspense, useRef, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useMarketStore } from './stores/marketStore';
import { useConnectionStore } from './stores/connectionStore';
import DashboardPanel from './ui/DashboardPanel';
import MarketGrid from './features/market/MarketGrid';
import LoadingSpinner from './ui/LoadingSpinner';
import PanelErrorBoundary from './ui/PanelErrorBoundary';
import { Wifi, WifiOff, Newspaper, Calendar, BarChart2, Flame, Activity } from 'lucide-react';
import ThemeProvider from './ui/ThemeProvider';
import ErrorBoundary from './ui/ErrorBoundary';
import AlphaPanel from './features/analytics/AlphaPanel';
import NewsTicker from './features/news/NewsTicker';
import NewsFeed from './features/news/NewsFeed';
import EconomicCalendar from './features/news/EconomicCalendar';
import TabPanel from './ui/TabPanel';
import OrderBookDOM from './features/market/OrderBookDOM';
import LiquidationFeed from './features/market/LiquidationFeed';
import OnChainPanel from './features/news/OnChainPanel';
import KeyboardShortcutsModal from './ui/KeyboardShortcutsModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const ChartContainer = React.lazy(() => import('./features/charts/ChartContainer'));

import PerformancePanel from './features/trading/PerformancePanel';
// Lazy Load Secondary/Heavy Analytics
const QuantSignalEngine = React.lazy(() => import('./features/analytics/QuantSignalEngine'));

import { useConnectionLatency } from './hooks/useConnectionLatency';

const App: React.FC = () => {
    const { selectedSymbol, setSymbol } = useMarketStore();
    const connections = useConnectionStore(state => state.connections);
    const { latency, quality, updatesPerSecond } = useConnectionLatency();

    // Panel refs for keyboard focus
    const marketWatchRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<HTMLDivElement>(null);
    const alphaRef = useRef<HTMLDivElement>(null);
    const newsRef = useRef<HTMLDivElement>(null);

    // Calculate overall status
    const isGlobalConnected = Object.values(connections).every(status => status === 'connected');

    // Keyboard shortcuts
    const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts({
        shortcuts: [
            {
                key: '1',
                ctrl: true,
                description: 'Focus Market Watch',
                action: () => marketWatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                category: 'panels'
            },
            {
                key: '2',
                ctrl: true,
                description: 'Focus Chart',
                action: () => chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                category: 'panels'
            },
            {
                key: '3',
                ctrl: true,
                description: 'Focus Alpha Panel',
                action: () => alphaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                category: 'panels'
            },
            {
                key: '4',
                ctrl: true,
                description: 'Focus News',
                action: () => newsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                category: 'panels'
            }
        ]
    });

    const getQualityColor = (q: string) => {
        switch (q) {
            case 'Excellent': return 'var(--accent-primary)'; // Green
            case 'Good': return '#FFD700'; // Gold
            case 'Fair': return '#FFA500'; // Orange
            case 'Poor': return 'var(--accent-danger)'; // Red
            default: return 'var(--text-muted)';
        }
    };

    return (
        <ThemeProvider>
            <ErrorBoundary>
                <div className="app-container">
                    {/* Header */}
                    <header className="app-header">
                        <div className="logo-section">
                            <div className="logo-text">
                                <h1>quant.term</h1>
                                <span className="version">Quantitative Terminal</span>
                            </div>
                        </div>

                        <div className="header-controls">
                            <div className="connection-status" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '0 8px',
                                height: '24px',
                                background: isGlobalConnected ? 'rgba(255, 128, 0, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                                border: `1px solid ${isGlobalConnected ? 'var(--accent-primary)' : 'var(--accent-danger)'}`,
                                color: isGlobalConnected ? 'var(--accent-primary)' : 'var(--accent-danger)'
                            }}>
                                {isGlobalConnected ?
                                    <Wifi size={12} /> :
                                    <WifiOff size={12} />
                                }
                                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                                    {isGlobalConnected ? 'LIVE' : 'OFFLINE'}
                                </span>
                            </div>
                            <div className="user-profile">
                                <div className="avatar">TRADER</div>
                            </div>
                        </div>
                    </header>

                    {/* News Ticker */}
                    <NewsTicker />

                    {/* Main Content Grid - 3 Column Layout */}
                    <div className="main-content">
                        <PanelGroup direction="horizontal">

                            {/* COLUMN 1: Market Watch (15%) */}
                            <Panel defaultSize={15} minSize={10} maxSize={20} collapsible>
                                <div ref={marketWatchRef} style={{ height: '100%' }}>
                                    <DashboardPanel title="Market Watch">
                                        <PanelErrorBoundary>
                                            <MarketGrid onSelectSymbol={setSymbol} />
                                        </PanelErrorBoundary>
                                    </DashboardPanel>
                                </div>
                            </Panel>

                            <PanelResizeHandle className="resize-handle" />

                            {/* COLUMN 2: Chart, Quant Signals & OrderBook (55%) */}
                            <Panel defaultSize={55} minSize={40}>
                                <PanelGroup direction="vertical">
                                    {/* Top: Main Chart (50%) */}
                                    <Panel defaultSize={50}>
                                        <div ref={chartRef} style={{ height: '100%' }}>
                                            <DashboardPanel title={`Chart - ${selectedSymbol}`}>
                                                <PanelErrorBoundary>
                                                    <Suspense fallback={<LoadingSpinner />}>
                                                        <ChartContainer symbol={selectedSymbol} />
                                                    </Suspense>
                                                </PanelErrorBoundary>
                                            </DashboardPanel>
                                        </div>
                                    </Panel>

                                    <PanelResizeHandle className="resize-handle" />

                                    {/* Middle: Quant Signals (25%) */}
                                    <Panel defaultSize={25}>
                                        <DashboardPanel title="Quant Signal Engine">
                                            <PanelErrorBoundary>
                                                <Suspense fallback={<LoadingSpinner />}>
                                                    <QuantSignalEngine />
                                                </Suspense>
                                            </PanelErrorBoundary>
                                        </DashboardPanel>
                                    </Panel>

                                    <PanelResizeHandle className="resize-handle" />

                                    {/* Bottom: Order Book & Liquidations (25%) */}
                                    <Panel defaultSize={25}>
                                        <DashboardPanel title="Market Depth">
                                            <PanelErrorBoundary>
                                                <TabPanel
                                                    tabs={useMemo(() => [
                                                        {
                                                            id: 'orderbook',
                                                            label: 'Order Book',
                                                            icon: <BarChart2 size={12} />,
                                                            content: <OrderBookDOM symbol={selectedSymbol} />
                                                        },
                                                        {
                                                            id: 'liquidations',
                                                            label: 'Liquidations',
                                                            icon: <Flame size={12} />,
                                                            content: <LiquidationFeed symbol={selectedSymbol} />
                                                        }
                                                    ], [selectedSymbol])}
                                                    defaultTab="orderbook"
                                                />
                                            </PanelErrorBoundary>
                                        </DashboardPanel>
                                    </Panel>
                                </PanelGroup>
                            </Panel>

                            <PanelResizeHandle className="resize-handle" />

                            {/* COLUMN 3: Alpha & News (30%) */}
                            <Panel defaultSize={30} minSize={20} maxSize={35}>
                                <PanelGroup direction="vertical">
                                    {/* Top: Alpha Factors (50%) */}
                                    <Panel defaultSize={50}>
                                        <div ref={alphaRef} style={{ height: '100%' }}>
                                            <DashboardPanel title="Alpha Factors">
                                                <PanelErrorBoundary>
                                                    <AlphaPanel symbol={selectedSymbol} />
                                                </PanelErrorBoundary>
                                            </DashboardPanel>
                                        </div>
                                    </Panel>

                                    <PanelResizeHandle className="resize-handle" />

                                    {/* Bottom: News & Calendar (50%) */}
                                    <Panel defaultSize={50}>
                                        <div ref={newsRef} style={{ height: '100%' }}>
                                            <DashboardPanel title="Market Intelligence">
                                                <PanelErrorBoundary>
                                                    <TabPanel
                                                        tabs={useMemo(() => [
                                                            {
                                                                id: 'onchain',
                                                                label: 'On-Chain',
                                                                icon: <Activity size={12} />,
                                                                content: <OnChainPanel />
                                                            },
                                                            {
                                                                id: 'news',
                                                                label: 'News Feed',
                                                                icon: <Newspaper size={12} />,
                                                                content: <NewsFeed symbol={selectedSymbol} />
                                                            },
                                                            {
                                                                id: 'calendar',
                                                                label: 'Economic Calendar',
                                                                icon: <Calendar size={12} />,
                                                                content: <EconomicCalendar />
                                                            }
                                                        ], [selectedSymbol])}
                                                        defaultTab="onchain"
                                                    />
                                                </PanelErrorBoundary>
                                            </DashboardPanel>
                                        </div>
                                    </Panel>
                                </PanelGroup>
                            </Panel>
                        </PanelGroup>
                    </div>

                    {/* Footer Status Bar */}
                    <footer className="app-footer">
                        <div className="status-item">
                            <span className="label">LATENCY</span>
                            <span className="value" style={{ color: getQualityColor(quality) }}>
                                {latency}ms ({quality})
                            </span>
                        </div>
                        <div className="status-item">
                            <span className="label">DATA RATE</span>
                            <span className="value">{updatesPerSecond} msg/s</span>
                        </div>
                        <div className="status-item">
                            <span className="label">STATUS</span>
                            <span className="value good">CONNECTED</span>
                        </div>
                        <div className="status-item">
                            <span className="label">EXCHANGE</span>
                            <span className="value">BINANCE FUTURES</span>
                        </div>
                        <div className="status-item">
                            <span className="label">SYMBOL</span>
                            <span className="value">{selectedSymbol}</span>
                        </div>
                        <div className="status-item right">
                            <span className="value">UTC {new Date().toISOString().slice(11, 19)}</span>
                        </div>
                        <PerformancePanel />
                    </footer>

                    {/* Keyboard Shortcuts Modal */}
                    <KeyboardShortcutsModal
                        shortcuts={shortcuts}
                        isOpen={showHelp}
                        onClose={() => setShowHelp(false)}
                    />
                </div >
            </ErrorBoundary >
        </ThemeProvider >
    );
};

export default App;
