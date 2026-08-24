import React, { Suspense, useMemo } from 'react';
import { Activity, BarChart2, Bell, BriefcaseBusiness, Flame, Newspaper, Waves } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import AlertPanel from '@/features/market/AlertPanel';
import AlphaPanel from '@/features/analytics/AlphaPanel';
import DashboardPanel from '@/ui/DashboardPanel';
import LiquidationFeed from '@/features/market/LiquidationFeed';
import LoadingSpinner from '@/ui/LoadingSpinner';
import MarketGrid from '@/features/market/MarketGrid';
import MicrostructureRibbon from '@/features/market/MicrostructureRibbon';
import MarketOverviewBar from '@/ui/MarketOverviewBar';
import NetworkPulsePanel from '@/features/news/NetworkPulsePanel';
import NewsFeed from '@/features/news/NewsFeed';
import NewsTicker from '@/features/news/NewsTicker';
import OrderBookDOM from '@/features/market/OrderBookDOM';
import PanelErrorBoundary from '@/ui/PanelErrorBoundary';
import PaperTradingPanel from '@/features/trading/PaperTradingPanel';
import TabPanel from '@/ui/TabPanel';

const ChartContainer = React.lazy(() => import('@/features/charts/ChartContainer'));
const QuantSignalEngine = React.lazy(() => import('@/features/analytics/QuantSignalEngine'));

interface MonitorWorkspaceProps {
    selectedSymbol: string;
    isGlobalConnected: boolean;
    onSelectSymbol: (symbol: string) => void;
}

const MonitorWorkspace: React.FC<MonitorWorkspaceProps> = ({
    selectedSymbol,
    isGlobalConnected,
    onSelectSymbol,
}) => {
    const marketDepthTabs = useMemo(() => [
        {
            id: 'orderbook',
            label: 'Order Book',
            icon: <BarChart2 size={12} />,
            content: <OrderBookDOM symbol={selectedSymbol} />,
        },
        {
            id: 'liquidations',
            label: 'Liquidations',
            icon: <Flame size={12} />,
            content: <LiquidationFeed key={selectedSymbol} symbol={selectedSymbol} />,
        },
    ], [selectedSymbol]);

    const researchTabs = useMemo(() => [
        {
            id: 'signal',
            label: 'Signal',
            icon: <Activity size={12} />,
            content: (
                <Suspense fallback={<LoadingSpinner />}>
                    <QuantSignalEngine key={selectedSymbol} />
                </Suspense>
            ),
        },
        {
            id: 'factors',
            label: 'Factors',
            icon: <Waves size={12} />,
            content: <AlphaPanel key={selectedSymbol} symbol={selectedSymbol} />,
        },
    ], [selectedSymbol]);

    const intelligenceTabs = useMemo(() => [
        {
            id: 'portfolio',
            label: 'Paper',
            icon: <BriefcaseBusiness size={12} />,
            content: <PaperTradingPanel symbol={selectedSymbol} />,
        },
        {
            id: 'network',
            label: 'Network',
            icon: <Activity size={12} />,
            content: <NetworkPulsePanel />,
        },
        {
            id: 'alerts',
            label: 'Alerts',
            icon: <Bell size={12} />,
            content: <AlertPanel symbol={selectedSymbol} />,
        },
        {
            id: 'news',
            label: 'News Feed',
            icon: <Newspaper size={12} />,
            content: <NewsFeed symbol={selectedSymbol} />,
        },
    ], [selectedSymbol]);

    return (
        <>
            <MarketOverviewBar symbol={selectedSymbol} isConnected={isGlobalConnected} />
            <NewsTicker />

            <main className="main-content" id="terminal-workspace" tabIndex={-1}>
                <PanelGroup direction="horizontal">
                    <Panel defaultSize={18} minSize={14} maxSize={25} collapsible>
                        <div id="panel-market-watch" tabIndex={-1} style={{ height: '100%' }}>
                            <DashboardPanel title="Market Watch">
                                <PanelErrorBoundary>
                                    <MarketGrid onSelectSymbol={onSelectSymbol} />
                                </PanelErrorBoundary>
                            </DashboardPanel>
                        </div>
                    </Panel>

                    <PanelResizeHandle className="resize-handle" />

                    <Panel defaultSize={57} minSize={42}>
                        <PanelGroup direction="vertical">
                            <Panel defaultSize={58} minSize={40}>
                                <div id="panel-chart" tabIndex={-1} style={{ height: '100%' }}>
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

                            <Panel defaultSize={14} minSize={10}>
                                <div id="panel-ribbon" tabIndex={-1} style={{ height: '100%' }}>
                                    <DashboardPanel title={`Microstructure - ${selectedSymbol}`}>
                                        <PanelErrorBoundary>
                                            <MicrostructureRibbon symbol={selectedSymbol} />
                                        </PanelErrorBoundary>
                                    </DashboardPanel>
                                </div>
                            </Panel>

                            <PanelResizeHandle className="resize-handle" />

                            <Panel defaultSize={32} minSize={20}>
                                <DashboardPanel title="Market Depth">
                                    <PanelErrorBoundary>
                                        <TabPanel tabs={marketDepthTabs} defaultTab="orderbook" />
                                    </PanelErrorBoundary>
                                </DashboardPanel>
                            </Panel>
                        </PanelGroup>
                    </Panel>

                    <PanelResizeHandle className="resize-handle" />

                    <Panel defaultSize={25} minSize={20} maxSize={35}>
                        <PanelGroup direction="vertical">
                            <Panel defaultSize={52}>
                                <div id="panel-research" tabIndex={-1} style={{ height: '100%' }}>
                                    <DashboardPanel title="Research Monitor">
                                        <PanelErrorBoundary>
                                            <TabPanel tabs={researchTabs} defaultTab="signal" />
                                        </PanelErrorBoundary>
                                    </DashboardPanel>
                                </div>
                            </Panel>

                            <PanelResizeHandle className="resize-handle" />

                            <Panel defaultSize={48}>
                                <div id="panel-intelligence" tabIndex={-1} style={{ height: '100%' }}>
                                    <DashboardPanel title="Market Intelligence">
                                        <PanelErrorBoundary>
                                            <TabPanel tabs={intelligenceTabs} defaultTab="portfolio" />
                                        </PanelErrorBoundary>
                                    </DashboardPanel>
                                </div>
                            </Panel>
                        </PanelGroup>
                    </Panel>
                </PanelGroup>
            </main>
        </>
    );
};

export default MonitorWorkspace;
