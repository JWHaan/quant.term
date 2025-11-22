import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class PanelErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Panel Crashed:", error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#000',
                    color: 'var(--text-muted)',
                    padding: '16px',
                    textAlign: 'center'
                }}>
                    <AlertTriangle size={24} color="var(--accent-danger)" style={{ marginBottom: '8px' }} />
                    <h3 style={{ fontSize: '12px', color: '#fff', margin: '0 0 4px 0' }}>Panel Crashed</h3>
                    <p style={{ fontSize: '10px', margin: '0 0 12px 0', maxWidth: '200px' }}>
                        {this.state.error?.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '10px',
                            cursor: 'pointer'
                        }}
                    >
                        <RefreshCw size={10} />
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default PanelErrorBoundary;
