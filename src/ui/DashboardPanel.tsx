import React from 'react';

interface DashboardPanelProps {
    title: string;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    headerActions?: React.ReactNode;
}

const DashboardPanel: React.FC<DashboardPanelProps> = ({
    title,
    children,
    className = '',
    style = {},
    headerActions
}) => {
    const titleId = React.useId();

    return (
        <section
            className={`dashboard-panel ${className}`.trim()}
            style={style}
            aria-labelledby={titleId}
        >
            <header className="dashboard-panel__header">
                <span className="dashboard-panel__accent" aria-hidden="true" />
                <h2 id={titleId} className="dashboard-panel__title">{title}</h2>
                <span className="dashboard-panel__rule" aria-hidden="true" />
                {headerActions && (
                    <div className="dashboard-panel__actions">
                        {headerActions}
                    </div>
                )}
            </header>

            <div className="dashboard-panel__content">
                {children}
            </div>
        </section>
    );
};

export default DashboardPanel;
