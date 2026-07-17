import React, { useRef, useState } from 'react';

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
}

interface TabPanelProps {
    tabs: Tab[];
    defaultTab?: string;
    ariaLabel?: string;
}

const TabPanel: React.FC<TabPanelProps> = ({
    tabs,
    defaultTab,
    ariaLabel = 'Panel views'
}) => {
    const baseId = React.useId();
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const fallbackTab = tabs.some(tab => tab.id === defaultTab)
        ? defaultTab ?? ''
        : tabs[0]?.id ?? '';
    const [activeTabId, setActiveTabId] = useState(fallbackTab);
    const resolvedActiveTab = tabs.some(tab => tab.id === activeTabId)
        ? activeTabId
        : fallbackTab;
    const activeTab = tabs.find((tab) => tab.id === resolvedActiveTab);

    const activateTab = (index: number) => {
        const tab = tabs[index];
        if (!tab) return;
        setActiveTabId(tab.id);
        tabRefs.current[index]?.focus();
    };

    const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (tabs.length === 0) return;

        let nextIndex: number | null = null;
        switch (event.key) {
            case 'ArrowRight':
                nextIndex = (index + 1) % tabs.length;
                break;
            case 'ArrowLeft':
                nextIndex = (index - 1 + tabs.length) % tabs.length;
                break;
            case 'Home':
                nextIndex = 0;
                break;
            case 'End':
                nextIndex = tabs.length - 1;
                break;
            default:
                return;
        }

        event.preventDefault();
        activateTab(nextIndex);
    };

    return (
        <div className="tab-panel">
            <div
                className="tab-panel__list"
                role="tablist"
                aria-label={ariaLabel}
                aria-orientation="horizontal"
            >
                {tabs.map((tab, index) => {
                    const isActive = resolvedActiveTab === tab.id;
                    const tabId = `${baseId}-tab-${tab.id}`;
                    const panelId = `${baseId}-panel-${tab.id}`;

                    return (
                        <button
                            key={tab.id}
                            ref={(node) => { tabRefs.current[index] = node; }}
                            id={tabId}
                            type="button"
                            className="tab-panel__tab"
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={panelId}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => setActiveTabId(tab.id)}
                            onKeyDown={(event) => handleTabKeyDown(event, index)}
                        >
                            {tab.icon && (
                                <span className="tab-panel__icon" aria-hidden="true">
                                    {tab.icon}
                                </span>
                            )}
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="tab-panel__content">
                {activeTab && (
                    <div
                        key={activeTab.id}
                        id={`${baseId}-panel-${activeTab.id}`}
                        className="tab-panel__panel"
                        role="tabpanel"
                        aria-labelledby={`${baseId}-tab-${activeTab.id}`}
                        tabIndex={0}
                    >
                        {activeTab.content}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TabPanel;
