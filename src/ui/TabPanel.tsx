import React, { useState } from 'react';

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
}

interface TabPanelProps {
    tabs: Tab[];
    defaultTab?: string;
}

const TabPanel: React.FC<TabPanelProps> = ({ tabs, defaultTab }) => {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Tab Headers */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(255,255,255,0.02)',
                gap: '2px'
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '8px 16px',
                            background: activeTab === tab.id ? 'rgba(255,128,0,0.1)' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontSize: '11px',
                            fontWeight: activeTab === tab.id ? '600' : '400',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontFamily: 'var(--font-mono)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== tab.id) {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== tab.id) {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content - Keep all tabs mounted to prevent remounting */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        style={{
                            display: activeTab === tab.id ? 'block' : 'none',
                            height: '100%',
                            overflow: 'hidden'
                        }}
                    >
                        {tab.content}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TabPanel;
