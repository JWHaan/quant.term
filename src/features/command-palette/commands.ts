import React from 'react';
import { Activity, BarChart2, Beaker, Flame, Keyboard, Monitor, Newspaper } from 'lucide-react';

export interface Command {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    action: () => void;
    category: string;
}

export interface CommandsConfig {
    setShowHelp: (v: boolean) => void;
    setSymbol: (s: string) => void;
    openMonitor: () => void;
    openStrategyLab: () => void;
    scrollToMarket: () => void;
    scrollToChart: () => void;
    scrollToAlpha: () => void;
    scrollToNews: () => void;
}

export function buildCommands(cfg: CommandsConfig): Command[] {
    return [
        {
            id: 'open-monitor',
            label: 'Open Market Monitor',
            description: 'Switch to live market monitoring',
            icon: React.createElement(Monitor, { size: 16 }),
            action: cfg.openMonitor,
            category: 'Workspaces'
        },
        {
            id: 'open-strategy-lab',
            label: 'Open Strategy Lab',
            description: 'Configure and run a deterministic candle replay',
            icon: React.createElement(Beaker, { size: 16 }),
            action: cfg.openStrategyLab,
            category: 'Workspaces'
        },
        {
            id: 'focus-market',
            label: 'Focus Market Watch',
            description: 'Navigate to the market watch panel',
            icon: React.createElement(Activity, { size: 16 }),
            action: cfg.scrollToMarket,
            category: 'Navigation'
        },
        {
            id: 'focus-chart',
            label: 'Focus Chart',
            description: 'Navigate to the main chart',
            icon: React.createElement(BarChart2, { size: 16 }),
            action: cfg.scrollToChart,
            category: 'Navigation'
        },
        {
            id: 'focus-alpha',
            label: 'Focus Alpha Panel',
            description: 'Navigate to alpha factors',
            icon: React.createElement(Flame, { size: 16 }),
            action: cfg.scrollToAlpha,
            category: 'Navigation'
        },
        {
            id: 'focus-news',
            label: 'Focus News',
            description: 'Navigate to news feed',
            icon: React.createElement(Newspaper, { size: 16 }),
            action: cfg.scrollToNews,
            category: 'Navigation'
        },
        {
            id: 'toggle-help',
            label: 'Show Keyboard Shortcuts',
            description: 'View all available keyboard shortcuts',
            icon: React.createElement(Keyboard, { size: 16 }),
            action: () => cfg.setShowHelp(true),
            category: 'Help'
        },
        {
            id: 'analyze-btc',
            label: 'Analyze BTCUSDT',
            description: 'Switch symbol to Bitcoin',
            icon: React.createElement(Activity, { size: 16 }),
            action: () => cfg.setSymbol('BTCUSDT'),
            category: 'Actions'
        },
        {
            id: 'analyze-eth',
            label: 'Analyze ETHUSDT',
            description: 'Switch symbol to Ethereum',
            icon: React.createElement(Activity, { size: 16 }),
            action: () => cfg.setSymbol('ETHUSDT'),
            category: 'Actions'
        },
        {
            id: 'analyze-sol',
            label: 'Analyze SOLUSDT',
            description: 'Switch symbol to Solana',
            icon: React.createElement(Activity, { size: 16 }),
            action: () => cfg.setSymbol('SOLUSDT'),
            category: 'Actions'
        }
    ];
}
