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

interface FireKeyDownOptions {
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
}

const fireKeyDown = (
    target: EventTarget,
    key: string,
    { ctrlKey, metaKey, altKey, shiftKey }: FireKeyDownOptions = {}
) => {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ctrlKey: ctrlKey ?? false,
        metaKey: metaKey ?? false,
        altKey: altKey ?? false,
        shiftKey: shiftKey ?? false,
    });
    Object.defineProperty(event, 'target', { value: target });
    target.dispatchEvent(event);
    return event;
};

const appendInput = (): HTMLInputElement => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    return input;
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

    it('fires modifier shortcuts (ctrl+1) and preventDefault even when an input is focused', () => {
        const action = vi.fn();
        renderHook(() =>
            useKeyboardShortcuts({
                shortcuts: [
                    {
                        key: '1',
                        ctrl: true,
                        description: 'Focus first panel',
                        action,
                        category: 'panels',
                    },
                ],
            })
        );

        const input = appendInput();

        const event = fireKeyDown(input, '1', { ctrlKey: true });

        expect(action).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
    });

    it('passes alt+` through to a registered shortcut on an input, else ignores harmlessly', () => {
        const action = vi.fn();
        renderHook(() =>
            useKeyboardShortcuts({
                shortcuts: [
                    {
                        key: '`',
                        alt: true,
                        description: 'Toggle command palette (alt)',
                        action,
                        category: 'actions',
                    },
                ],
            })
        );

        const input = appendInput();
        const event = fireKeyDown(input, '`', { altKey: true });

        expect(action).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);

        // Unregistered modifier combo with an input target is ignored harmlessly.
        const unregistered = fireKeyDown(input, 'k', { ctrlKey: true });
        expect(action).toHaveBeenCalledTimes(1);
        expect(unregistered.defaultPrevented).toBe(false);
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
