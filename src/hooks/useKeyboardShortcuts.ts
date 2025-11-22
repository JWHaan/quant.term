import { useEffect, useState } from 'react';

export interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    description: string;
    action: () => void;
    category: 'navigation' | 'panels' | 'actions';
}

interface UseKeyboardShortcutsOptions {
    shortcuts: KeyboardShortcut[];
    enabled?: boolean;
}

/**
 * Global keyboard shortcuts hook
 * Handles keyboard events and executes registered shortcuts
 */
export const useKeyboardShortcuts = ({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) => {
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for help shortcut (?)
            if (event.key === '?' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
                event.preventDefault();
                setShowHelp(true);
                return;
            }

            // Check for Escape to close help
            if (event.key === 'Escape') {
                setShowHelp(false);
                return;
            }

            // Check registered shortcuts
            for (const shortcut of shortcuts) {
                const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
                const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
                const altMatch = shortcut.alt ? event.altKey : !event.altKey;
                const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

                if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
                    event.preventDefault();
                    shortcut.action();
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts, enabled]);

    return {
        showHelp,
        setShowHelp,
        shortcuts
    };
};
