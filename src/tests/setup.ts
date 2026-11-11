import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
    cleanup();
});

// Mock ResizeObserver (needed for charting libraries)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Provide a minimal WebSocket constructor for components that only check its presence.
if (!global.WebSocket) {
    // @ts-expect-error: vitest globals need explicit typing
    global.WebSocket = vi.fn();
}

// Vitest's happy-dom environment does not copy `localStorage` or
// `sessionStorage` onto the test global: modern Node defines them on
// `globalThis`, and Vitest only overrides a fixed key list that omits both.
// Provide deterministic in-memory implementations so storage-backed stores
// behave the same on every host runtime.
class MemoryStorage {
    private readonly items = new Map<string, string>();

    get length(): number {
        return this.items.size;
    }

    clear(): void {
        this.items.clear();
    }

    getItem(key: string): string | null {
        return this.items.get(String(key)) ?? null;
    }

    key(index: number): string | null {
        return Array.from(this.items.keys())[index] ?? null;
    }

    removeItem(key: string): void {
        this.items.delete(String(key));
    }

    setItem(key: string, value: string): void {
        this.items.set(String(key), String(value));
    }
}

function installStorage(name: 'localStorage' | 'sessionStorage'): void {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, name, {
        configurable: true,
        enumerable: true,
        value: storage,
        writable: false,
    });
    if (typeof window !== 'undefined' && (window as unknown) !== globalThis) {
        Object.defineProperty(window, name, {
            configurable: true,
            value: storage,
        });
    }
}

installStorage('localStorage');
installStorage('sessionStorage');

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
