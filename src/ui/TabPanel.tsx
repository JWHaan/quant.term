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
                background: 'var(--bg-panel)',
                paddingTop: '4px'
            }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '4px 12px',
                            background: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                            border: '1px solid transparent',
                            borderBottom: 'none',
                            color: activeTab === tab.id ? '#000' : 'var(--text-secondary)',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-mono)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginRight: '2px',
                            position: 'relative',
                            top: '1px' // Overlap border
                        }}
                    >
                        {activeTab === tab.id && <span style={{ marginRight: '4px' }}>&gt;</span>}
                        {tab.icon}
                        {tab.label}
                        {activeTab === tab.id && <span style={{ marginLeft: '4px' }}>_</span>}
                    </button>
                ))}
                <div style={{ flex: 1, borderBottom: '1px solid var(--border-color)' }}></div>
            </div>

            {/* Tab Content - Keep all tabs mounted to prevent remounting */}
            <div style={{
                flex: 1,
                overflow: 'hidden',
                position: 'relative',
                borderTop: 'none' // Handled by headers
            }}>
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
