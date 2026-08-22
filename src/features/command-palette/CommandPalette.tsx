import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    const filteredCommands = useMemo(() => commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(query.toLowerCase())
    ), [commands, query]);

    // Reset selection when query changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedIndex(0);
    }, [query]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
        return () => {
            if (!isOpen) {
                setQuery('');
            }
        };
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
        <div className="command-overlay" onClick={onClose}>
            <div className="command-dialog" onClick={e => e.stopPropagation()}>
                {/* Search Input */}
                <div className="command-search">
                    <Search size={20} color="var(--text-muted)" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Type a command or search..."
                    />
                    <div className="command-kbd">
                        ESC
                    </div>
                </div>

                {/* Results List */}
                <div ref={listRef} className="command-list">
                    {filteredCommands.length > 0 ? (
                        filteredCommands.map((cmd, index) => (
                            <div
                                key={cmd.id}
                                className={`command-option${index === selectedIndex ? ' is-selected' : ''}`}
                                onClick={() => {
                                    cmd.action();
                                    onClose();
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <div className="command-option__icon">
                                    {cmd.icon || <Terminal size={16} />}
                                </div>
                                <div className="command-option__body">
                                    <div className="command-option__label">
                                        {cmd.label}
                                    </div>
                                    {cmd.description && (
                                        <div className="command-option__desc">
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
                        <div className="command-empty">
                            No commands found matching "{query}"
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="command-footer">
                    <div>
                        Command Palette
                    </div>
                    <div className="command-footer__keys">
                        <span><strong>↑↓</strong> to navigate</span>
                        <span><strong>↵</strong> to select</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
