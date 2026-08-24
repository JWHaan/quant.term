import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    useKeyboardShortcuts,
    type KeyboardShortcut,
} from '@/hooks/useKeyboardShortcuts';

const makeShortcut = (action: () => void): KeyboardShortcut => ({
    key: '`',
    description: 'Toggle command palette',
    action,
    category: 'actions',
});

const fireKeyDown = (target: EventTarget, key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: target });
    target.dispatchEvent(event);
    return event;
};

describe('useKeyboardShortcuts editable-target guard', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('ignores shortcuts and does not preventDefault when typing in an input', () => {
        const action = vi.fn();
        const preventDefaultSpy = vi.spyOn(KeyboardEvent.prototype, 'preventDefault');
        renderHook(() => useKeyboardShortcuts({ shortcuts: [makeShortcut(action)] }));

        const input = document.createElement('input');
        input.type = 'text';
        document.body.appendChild(input);

        const event = fireKeyDown(input, '`');

        expect(action).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
        expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('does not fire shortcuts for textarea or contentEditable targets', () => {
        const action = vi.fn();
        renderHook(() => useKeyboardShortcuts({ shortcuts: [makeShortcut(action)] }));

        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        fireKeyDown(textarea, '`');

        const editable = document.createElement('div');
        editable.setAttribute('contenteditable', 'true');
        document.body.appendChild(editable);
        fireKeyDown(editable, '`');

        expect(action).not.toHaveBeenCalled();
    });

    it('still fires the shortcut for the same key on document.body', () => {
        const action = vi.fn();
        renderHook(() => useKeyboardShortcuts({ shortcuts: [makeShortcut(action)] }));

        fireKeyDown(document.body, '`');

        expect(action).toHaveBeenCalledTimes(1);
    });

    it('keeps Escape closing help while an input is focused', () => {
        const { result } = renderHook(() =>
            useKeyboardShortcuts({ shortcuts: [makeShortcut(vi.fn())] })
        );
        result.current.setShowHelp(true);

        const input = document.createElement('input');
        document.body.appendChild(input);
        fireKeyDown(input, 'Escape');

        expect(result.current.showHelp).toBe(false);
    });
});
