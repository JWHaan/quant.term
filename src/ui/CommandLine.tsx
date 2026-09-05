import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { normalizeSymbolArg, type Command } from '@/features/command-palette/commands';

export type ResolvedCommandInput =
    | { kind: 'exact'; command: Command }
    | { kind: 'filtered'; items: Command[] };

/**
 * Pure dispatch rule for the header command line.
 * Exact mnemonics win ("top <arg>" routes to the first TOP command);
 * anything else falls back to a case-insensitive substring filter
 * over mnemonic/label/description in registry order.
 */
// Exported as a pure helper for tests; react-refresh would prefer a separate module.
// eslint-disable-next-line react-refresh/only-export-components
export function resolveCommandInput(query: string, commands: Command[]): ResolvedCommandInput {
    const trimmed = query.trim();
    const lower = trimmed.toLowerCase();

    if (lower.startsWith('top ') || lower === 'top') {
        const top = commands.find((command) => command.mnemonic?.toUpperCase() === 'TOP');
        if (top) return { kind: 'exact', command: top };
    }

    const exact = commands.find((command) => command.mnemonic?.toLowerCase() === lower);
    if (exact) return { kind: 'exact', command: exact };

    const items = commands.filter((command) =>
        command.label.toLowerCase().includes(lower)
        || command.description.toLowerCase().includes(lower)
        || (command.mnemonic ?? '').toLowerCase().includes(lower),
    );
    return { kind: 'filtered', items };
}

interface CommandLineProps {
    commands: Command[];
    onOpenPalette: () => void;
    /** When provided, "TOP <sym>" routes here instead of the command action. */
    onSymbolArg?: (symbol: string) => void;
}

const MAX_RESULTS = 7;

/**
 * Bloomberg-style always-visible command line.
 * Exact mnemonics execute directly; other queries filter the command registry.
 */
const CommandLine: React.FC<CommandLineProps> = ({ commands, onOpenPalette, onSymbolArg }) => {
    const [query, setQuery] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [noMatch, setNoMatch] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const resolved = useMemo(() => resolveCommandInput(query, commands), [query, commands]);
    const items = resolved.kind === 'exact' ? [resolved.command] : resolved.items;
    const safeIndex = Math.min(highlightIndex, Math.max(items.length - 1, 0));
    const showResults = query.trim().length > 0 && items.length > 0;

    const resetInput = () => {
        setQuery('');
        setHighlightIndex(0);
        setNoMatch(null);
        inputRef.current?.blur();
    };

    /**
     * Execute the resolved command for the current query.
     * "TOP <sym>" routes through onSymbolArg when provided.
     * Bad TOP arg shows feedback and does not fall back to the command action.
     */
    const execute = (command: Command) => {
        const trimmedQuery = query.trim();
        const lower = trimmedQuery.toLowerCase();
        if (onSymbolArg && command.mnemonic?.toUpperCase() === 'TOP' && lower.startsWith('top')) {
            const arg = trimmedQuery.slice(lower.startsWith('top ') ? 4 : 3);
            const symbol = normalizeSymbolArg(arg);
            if (symbol) {
                onSymbolArg(symbol);
                resetInput();
                return;
            }
            setNoMatch(trimmedQuery);
            setQuery('Bad symbol');
            return;
        }
        command.action();
        resetInput();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        switch (event.key) {
            case 'Enter': {
                event.preventDefault();
                if (resolved.kind === 'exact') {
                    execute(resolved.command);
                    break;
                }
                if (items[safeIndex] && query.trim()) {
                    execute(items[safeIndex]);
                    break;
                }
                if (query.trim()) {
                    setNoMatch(query.trim());
                }
                break;
            }
            case 'ArrowDown':
                event.preventDefault();
                setHighlightIndex((index) => Math.min(index + 1, items.length - 1));
                break;
            case 'ArrowUp':
                event.preventDefault();
                setHighlightIndex((index) => Math.max(index - 1, 0));
                break;
            case 'Escape':
                event.preventDefault();
                if (query) {
                    setQuery('');
                    setHighlightIndex(0);
                    setNoMatch(null);
                } else {
                    inputRef.current?.blur();
                }
                break;
        }
    };

    return (
        <div className="command-line" role="search">
            <Search size={13} aria-hidden="true" />
            <label className="visually-hidden" htmlFor="qt-command-input">Command line</label>
            <input
                id="qt-command-input"
                ref={inputRef}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Command… e.g. TOP BTC, LAB, NEWS"
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlightIndex(0);
                    setNoMatch(null);
                }}
                onKeyDown={handleKeyDown}
                aria-expanded={showResults}
                aria-controls={showResults ? 'command-line-results' : undefined}
                aria-autocomplete="list"
            />
            {showResults && resolved.kind === 'filtered' && (
                <ul id="command-line-results" className="command-line__results" role="listbox">
                    {items.slice(0, MAX_RESULTS).map((item, index) => (
                        <li key={item.id} role="option" aria-selected={index === safeIndex}>
                            <button
                                type="button"
                                className={`command-line__option${index === safeIndex ? ' is-active' : ''}`}
                                onMouseEnter={() => setHighlightIndex(index)}
                                onClick={() => execute(item)}
                            >
                                {item.mnemonic && <kbd>{item.mnemonic}</kbd>}
                                <span>{item.label}</span>
                                <ChevronRight size={12} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {noMatch !== null && (
                <div className="command-line__no-match" role="status">
                    No match: {noMatch}
                </div>
            )}
            <button
                type="button"
                className="command-line__palette-trigger"
                onClick={onOpenPalette}
                aria-label="Open command palette"
                title="Command palette (⌘K)"
            >
                <kbd aria-hidden="true">⌘K</kbd>
            </button>
        </div>
    );
};

export { CommandLine };
export default CommandLine;
