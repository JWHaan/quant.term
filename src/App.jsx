import React, { useState, useEffect, Suspense } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useMarketStore } from './stores/marketStore';
import { useConnectionStore } from './stores/connectionStore';
import DashboardPanel from './components/DashboardPanel';
import MarketGrid from './components/MarketGrid';
import LoadingSpinner from './components/LoadingSpinner';
import PanelErrorBoundary from './components/PanelErrorBoundary';
import { Wifi, WifiOff } from 'lucide-react';

import ChartContainer from './components/ChartContainer';
import OrderBookDOM from './components/OrderBookDOM';

// Lazy Load Secondary/Heavy Analytics
const QuantSignalEngine = React.lazy(() => import('./components/QuantSignalEngine'));
const OrderFlowImbalance = React.lazy(() => import('./components/OrderFlowImbalance'));
const CanvasTimeAndSales = React.lazy(() => import('./components/CanvasTimeAndSales'));
const AlertPanel = React.lazy(() => import('./components/AlertPanel'));

const App = () => {
  const { selectedSymbol, setSymbol } = useMarketStore();
  const connections = useConnectionStore(state => state.connections);

  // Calculate overall status
  const isGlobalConnected = Object.values(connections).every(status => status === 'connected');
  const hasErrors = Object.values(connections).some(status => status === 'error');

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-text">
            <h1>BLOOMBERG TERMINAL</h1>
            <span className="version">PROFESSIONAL v3.0</span>
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

          {/* COLUMN 2: Chart & Options (60%) */}
          <Panel defaultSize={60} minSize={40}>
            <PanelGroup direction="vertical">
              {/* Top: Main Chart (70%) */}
              <Panel defaultSize={70}>
                <DashboardPanel title={`Chart - ${selectedSymbol}`}>
                  <PanelErrorBoundary>
                    <ChartContainer symbol={selectedSymbol} />
                  </PanelErrorBoundary>
                </DashboardPanel>
              </Panel>

              <PanelResizeHandle className="resize-handle" />

              {/* Bottom: Quant Signals (30%) */}
              <Panel defaultSize={30}>
                <DashboardPanel title="Quant Signal Engine">
                  <PanelErrorBoundary>
                    <Suspense fallback={<LoadingSpinner />}>
                      <QuantSignalEngine />
                    </Suspense>
                  </PanelErrorBoundary>
                </DashboardPanel>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* COLUMN 3: Order Flow Stack (25%) */}
          <Panel defaultSize={25} minSize={20} maxSize={30}>
            <PanelGroup direction="vertical">
              {/* Top: DOM (40%) */}
              <Panel defaultSize={40}>
                <DashboardPanel title="Order Book (DOM)">
                  <PanelErrorBoundary>
                    <OrderBookDOM symbol={selectedSymbol} />
                  </PanelErrorBoundary>
                </DashboardPanel>
              </Panel>

              <PanelResizeHandle className="resize-handle" />

              {/* Middle: Tape (30%) */}
              <Panel defaultSize={30}>
                <DashboardPanel title="Time & Sales">
                  <PanelErrorBoundary>
                    <Suspense fallback={<LoadingSpinner />}>
                      <CanvasTimeAndSales symbol={selectedSymbol} />
                    </Suspense>
                  </PanelErrorBoundary>
                </DashboardPanel>
              </Panel>

              <PanelResizeHandle className="resize-handle" />

              {/* Bottom: Alerts (30%) */}
              <Panel defaultSize={30}>
                <DashboardPanel title="Alerts">
                  <PanelErrorBoundary>
                    <Suspense fallback={<LoadingSpinner />}>
                      <AlertPanel />
                    </Suspense>
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
      </footer>
    </div>
  );
};

export default App;
