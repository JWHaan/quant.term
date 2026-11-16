import { vi } from 'vitest';
import {
    fetch as platformFetch,
    Headers as PlatformHeaders,
    Response as PlatformResponse,
} from 'undici';

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

// Vite's wasm plugin loads .wasm modules via fetch() and hands the result to
// WebAssembly.instantiateStreaming, which requires a real undici Response.
// happy-dom replaces globalThis.fetch with its own implementation whose
// Response is rejected, so restore the platform fetch in DOM environments.
// Tests that need a mocked fetch still override it via vi.stubGlobal.
if (typeof window !== 'undefined') {
    // undici requires absolute URLs; happy-dom's fetch resolved relative ones
    // against window.location, so do the same before delegating.
    type UndiciResponse = InstanceType<typeof PlatformResponse>;
    const undiciFetch = platformFetch as unknown as (
        input: unknown,
        init?: unknown,
    ) => Promise<UndiciResponse>;
    const resolvedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const target =
            typeof input === 'string' || input instanceof URL
                ? new URL(String(input), window.location.href).href
                : input;
        const response = await undiciFetch(target, init);
        // Vite's wasm helper streams .wasm via WebAssembly.instantiateStreaming,
        // which requires Node's internal Response class — unreachable once
        // happy-dom has replaced the globals. Serving the bytes under a
        // non-wasm content type makes the helper fall back to
        // arrayBuffer() + WebAssembly.instantiate instead.
        const urlString =
            typeof target === 'string'
                ? target
                : target instanceof URL
                  ? target.href
                  : (target as Request).url;
        if (urlString.includes('.wasm')) {
            const headers = new PlatformHeaders(response.headers);
            headers.set('Content-Type', 'application/octet-stream');
            return new PlatformResponse(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            });
        }
        return response;
    }) as unknown as typeof fetch;
    globalThis.fetch = resolvedFetch;
    window.fetch = resolvedFetch;
}

// Mock window.matchMedia (DOM environments only; WASM-backed pure-math
// tests run under the node environment where `window` does not exist)
if (typeof window !== 'undefined') {
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
}
