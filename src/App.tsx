import React, { Suspense } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useMarketStore } from './stores/marketStore';
import { useConnectionStore } from './stores/connectionStore';
import DashboardPanel from './components/DashboardPanel';
import MarketGrid from './components/MarketGrid.jsx';
import LoadingSpinner from './components/LoadingSpinner';
import PanelErrorBoundary from './components/PanelErrorBoundary';
import { Wifi, WifiOff, Newspaper, Calendar, BarChart2, Flame } from 'lucide-react';
import ThemeProvider from './components/ThemeProvider';
import ErrorBoundary from './components/ErrorBoundary';
import AlphaPanel from './components/AlphaPanel.tsx';
import NewsTicker from './components/NewsTicker.tsx';
import NewsFeed from './components/NewsFeed.tsx';
import EconomicCalendar from './components/EconomicCalendar';
import TabPanel from './components/TabPanel';
import OrderBookDOM from './components/OrderBookDOM.tsx';
import LiquidationFeed from './components/LiquidationFeed.tsx';

const ChartContainer = React.lazy(() => import('./components/ChartContainer.jsx'));

import PerformancePanel from './components/PerformancePanel';
// Lazy Load Secondary/Heavy Analytics
const QuantSignalEngine = React.lazy(() => import('./components/QuantSignalEngine'));

const App: React.FC = () => {
    const { selectedSymbol, setSymbol } = useMarketStore();
    const connections = useConnectionStore(state => state.connections);

    // Calculate overall status
    const isGlobalConnected = Object.values(connections).every(status => status === 'connected');

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
                            <Panel defaultSize={15} minSize={10} maxSize={20}>
                                <DashboardPanel title="Market Watch">
                                    <PanelErrorBoundary>
                                        <MarketGrid onSelectSymbol={setSymbol} />
                                    </PanelErrorBoundary>
                                </DashboardPanel>
                            </Panel>

                            <PanelResizeHandle className="resize-handle" />

                            {/* COLUMN 2: Chart, Quant Signals & OrderBook (55%) */}
                            <Panel defaultSize={55} minSize={40}>
                                <PanelGroup direction="vertical">
                                    {/* Top: Main Chart (50%) */}
                                    <Panel defaultSize={50}>
                                        <DashboardPanel title={`Chart - ${selectedSymbol}`}>
                                            <PanelErrorBoundary>
                                                <Suspense fallback={<LoadingSpinner />}>
                                                    <ChartContainer symbol={selectedSymbol} />
                                                </Suspense>
                                            </PanelErrorBoundary>
                                        </DashboardPanel>
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
                                                    tabs={[
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
                                                    ]}
                                                    defaultTab="orderbook"
                                                />
                                            </PanelErrorBoundary>
                                        </DashboardPanel>
                                    </Panel>
                                </PanelGroup>
                            </Panel>

                            <PanelResizeHandle className="resize-handle" />

                            {/* COLUMN 3: Alpha Factors & News (30%) */}
                            <Panel defaultSize={30} minSize={20} maxSize={35}>
                                <PanelGroup direction="vertical">
                                    {/* Top: Alpha Factors (50%) */}
                                    <Panel defaultSize={50}>
                                        <DashboardPanel title="Alpha Factors">
                                            <PanelErrorBoundary>
                                                <AlphaPanel symbol={selectedSymbol} interval="15m" />
                                            </PanelErrorBoundary>
                                        </DashboardPanel>
                                    </Panel>

                                    <PanelResizeHandle className="resize-handle" />

                                    {/* Bottom: News & Calendar (50%) */}
                                    <Panel defaultSize={50}>
                                        <DashboardPanel title="Market Intelligence">
                                            <PanelErrorBoundary>
                                                <TabPanel
                                                    tabs={[
                                                        {
                                                            id: 'news',
                                                            label: 'News',
                                                            icon: <Newspaper size={12} />,
                                                            content: <NewsFeed symbol={selectedSymbol} maxItems={15} />
                                                        },
                                                        {
                                                            id: 'calendar',
                                                            label: 'Calendar',
                                                            icon: <Calendar size={12} />,
                                                            content: <EconomicCalendar />
                                                        }
                                                    ]}
                                                    defaultTab="news"
                                                />
                                            </PanelErrorBoundary>
                                        </DashboardPanel>
                                    </Panel>
                                </PanelGroup>
                            </Panel>

                        </PanelGroup>
                    </div>

                    {/* Footer Status Bar */}
                    <footer className="app-footer">
                        <div className="status-item">
                            <span className="label">LATENCY</span>
                            <span className="value good">12MS</span>
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
                </div>
            </ErrorBoundary>
        </ThemeProvider>
    );
};

export default App;
