import React, { useState, useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { useMarketStore } from '@/stores/marketStore';

/**
 * CommandTerminal - Bloomberg-style command line interface
 * Supports commands like:
 * - BTC <GO> (Load Bitcoin)
 * - WL <GO> (Watchlist)
 * - NEWS <GO> (News)
 * - HELP <GO> (Show commands)
 */
const CommandTerminal = ({ onExecute }) => {
    const [input, setInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef(null);
    const { setSymbol } = useMarketStore();

    // Command definitions
    const COMMANDS = [
        { cmd: 'WL', desc: 'Watchlist Monitor', action: () => console.log('Open Watchlist') },
        { cmd: 'NEWS', desc: 'News Ticker', action: () => console.log('Open News') },
        { cmd: 'HEAT', desc: 'Market Heatmap', action: () => console.log('Open Heatmap') },
        { cmd: 'DEPTH', desc: 'Depth Chart', action: () => console.log('Open Depth') },
        { cmd: 'TOP', desc: 'Top Gainers/Losers', action: () => console.log('Open Top') },
        { cmd: 'PORT', desc: 'Portfolio Manager', action: () => console.log('Open Portfolio') },
        { cmd: 'RISK', desc: 'Risk Analytics', action: () => console.log('Open Risk') },
        { cmd: 'ALERTS', desc: 'Alert Manager', action: () => console.log('Open Alerts') },
        { cmd: 'HELP', desc: 'Show Help', action: () => console.log('Show Help') },
    ];

    // Crypto assets for autocomplete
    const ASSETS = [
        'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOGE', 'DOT', 'MATIC', 'LINK',
        'LTC', 'UNI', 'ATOM', 'ETC', 'XLM', 'FIL', 'BCH', 'APT', 'NEAR', 'QNT'
    ];

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Toggle terminal on Ctrl+Space or /
            if ((e.ctrlKey && e.code === 'Space') || e.key === '/') {
                e.preventDefault();
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 10);
            }
            // Close on Escape
            if (e.key === 'Escape') {
                setIsOpen(false);
                setInput('');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (!input) {
            setSuggestions([]);
            return;
        }

        const upperInput = input.toUpperCase();

        // Find matching commands
        const cmdMatches = COMMANDS.filter(c => c.cmd.startsWith(upperInput));

        // Find matching assets
        const assetMatches = ASSETS.filter(a => a.startsWith(upperInput)).map(a => ({
            cmd: a,
            desc: `${a} Crypto Asset`,
            isAsset: true
        }));

        setSuggestions([...cmdMatches, ...assetMatches].slice(0, 5));
    }, [input]);

    const executeCommand = (cmdItem) => {
        const command = cmdItem.cmd;

        if (cmdItem.isAsset) {
            // It's an asset, load it
            const symbol = `${command} USDT`;
            setSymbol(symbol);
            // Also trigger any parent callback
            if (onExecute) onExecute({ type: 'ASSET', payload: symbol });
        } else {
            // It's a system command
            cmdItem.action();
            if (onExecute) onExecute({ type: 'COMMAND', payload: command });
        }

        setInput('');
        setIsOpen(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (suggestions.length > 0) {
            executeCommand(suggestions[0]);
        } else {
            // Try to interpret as asset if no direct match but valid format
            const upper = input.toUpperCase();
            if (ASSETS.includes(upper)) {
                executeCommand({ cmd: upper, isAsset: true });
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            background: 'rgba(20, 20, 30, 0.95)',
            border: '1px solid var(--accent-primary)',
            borderRadius: '8px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 20px rgba(0, 255, 157, 0.2)',
            zIndex: 9999,
            overflow: 'hidden',
            backdropFilter: 'blur(10px)'
        }}>
            {/* Bloomberg-style Header */}
            <div style={{
                background: 'linear-gradient(90deg, var(--accent-primary) 0%, #004433 100%)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#000',
                fontWeight: 'bold',
                fontSize: '12px',
                letterSpacing: '1px'
            }}>
                <Terminal size={14} />
                <span>COMMAND LINE</span>
                <div style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.8 }}>
                    ESC to close
                </div>
            </div>

            {/* Input Area */}
            <div style={{ padding: '16px', position: 'relative' }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '18px' }}>{'>'}</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a command or symbol (e.g., BTC, NEWS)..."
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            fontSize: '18px',
                            fontFamily: 'var(--font-mono)',
                            width: '100%',
                            outline: 'none',
                            textTransform: 'uppercase'
                        }}
                        autoFocus
                    />
                    <div style={{
                        background: 'var(--accent-primary)',
                        color: '#000',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold'
                    }}>
                        GO
                    </div>
                </form>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    {suggestions.map((item, index) => (
                        <div
                            key={item.cmd}
                            onClick={() => executeCommand(item)}
                            style={{
                                padding: '10px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: index === 0 ? 'rgba(0, 255, 157, 0.1)' : 'transparent',
                                borderLeft: index === 0 ? '3px solid var(--accent-primary)' : '3px solid transparent'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = index === 0 ? 'rgba(0, 255, 157, 0.1)' : 'transparent'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    fontFamily: 'var(--font-mono)',
                                    minWidth: '60px'
                                }}>
                                    {item.cmd}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                    {item.desc}
                                </span>
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                {item.isAsset ? 'Equity' : 'Function'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer Hint */}
            <div style={{
                padding: '8px 16px',
                background: 'rgba(0,0,0,0.3)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                textAlign: 'right'
            }}>
                QUANT TERMINAL OS v3.0
            </div>
        </div>
    );
};

export default CommandTerminal;
