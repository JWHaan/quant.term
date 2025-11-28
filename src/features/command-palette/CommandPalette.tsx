import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, Terminal } from 'lucide-react';

export interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
    action: () => void;
    category?: string;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    commands: CommandItem[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Filter commands based on query
    const filteredCommands = commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(query.toLowerCase())
    );

    // Reset selection when query changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setQuery('');
        }
    }, [isOpen]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredCommands[selectedIndex]) {
                        filteredCommands[selectedIndex].action();
                        onClose();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current && listRef.current.children[selectedIndex]) {
            listRef.current.children[selectedIndex].scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(2px)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: '15vh',
                zIndex: 10000,
                animation: 'fadeIn 0.15s ease-out'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '600px',
                    maxWidth: '90%',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'scaleIn 0.15s ease-out'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '20px',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-app)'
                }}>
                    <Search size={20} color="var(--text-muted)" style={{ marginRight: '12px' }} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Type a command or search..."
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '16px',
                            width: '100%',
                            outline: 'none',
                            fontFamily: 'var(--font-ui)'
                        }}
                    />
                    <div style={{
                        padding: '4px 8px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        ESC
                    </div>
                </div>

                {/* Results List */}
                <div
                    ref={listRef}
                    style={{
                        maxHeight: '400px',
                        overflowY: 'auto',
                        padding: '8px'
                    }}
                >
                    {filteredCommands.length > 0 ? (
                        filteredCommands.map((cmd, index) => (
                            <div
                                key={cmd.id}
                                onClick={() => {
                                    cmd.action();
                                    onClose();
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    background: index === selectedIndex ? 'var(--accent-secondary)' : 'transparent',
                                    borderLeft: index === selectedIndex ? '3px solid var(--accent-primary)' : '3px solid transparent',
                                    transition: 'all 0.1s ease'
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    marginRight: '12px',
                                    color: index === selectedIndex ? 'var(--accent-primary)' : 'var(--text-muted)'
                                }}>
                                    {cmd.icon || <Terminal size={16} />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        color: index === selectedIndex ? 'var(--text-primary)' : 'var(--text-primary)',
                                        fontSize: '14px',
                                        fontWeight: index === selectedIndex ? '500' : '400'
                                    }}>
                                        {cmd.label}
                                    </div>
                                    {cmd.description && (
                                        <div style={{
                                            color: 'var(--text-muted)',
                                            fontSize: '12px',
                                            marginTop: '2px'
                                        }}>
                                            {cmd.description}
                                        </div>
                                    )}
                                </div>
                                {index === selectedIndex && (
                                    <ArrowRight size={14} color="var(--accent-primary)" />
                                )}
                            </div>
                        ))
                    ) : (
                        <div style={{
                            padding: '32px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '14px'
                        }}>
                            No commands found matching "{query}"
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 20px',
                    background: 'var(--bg-app)',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Command Palette
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span><strong style={{ color: 'var(--text-primary)' }}>↑↓</strong> to navigate</span>
                        <span><strong style={{ color: 'var(--text-primary)' }}>↵</strong> to select</span>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { transform: scale(0.98); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default CommandPalette;
