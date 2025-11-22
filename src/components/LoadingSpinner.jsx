import React from 'react';

const LoadingSpinner = () => {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            color: 'var(--text-muted)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            flexDirection: 'column',
            gap: '8px'
        }}>
            <div className="spinner" style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.1)',
                borderTop: '2px solid var(--accent-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
            }} />
            <span>LOADING...</span>
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default LoadingSpinner;
