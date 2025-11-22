/**
 * Robust API Client with retry logic, caching, and error handling
 * Designed for production use with proper timeout and rate limiting
 */

interface APIClientOptions {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
}

interface RequestOptions extends Omit<RequestInit, 'cache'> {
    params?: Record<string, any>;
    useCache?: boolean;
    cacheTTL?: number;
    headers?: Record<string, string>;
    cache?: RequestCache;
}

interface CacheItem<T> {
    data: T;
    timestamp: number;
}

interface ExtendedError extends Error {
    status?: number;
    response?: Response;
    isTimeout?: boolean;
}

class APIClient {
    private baseURL: string;
    private timeout: number;
    private retries: number;
    private retryDelay: number;
    private cache: Map<string, CacheItem<any>>;

    constructor(baseURL: string, options: APIClientOptions = {}) {
        this.baseURL = baseURL;
        this.timeout = options.timeout || 10000;
        this.retries = options.retries || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.cache = new Map();
    }

    /**
     * Main request method with retry logic
     */
    async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;
        const cacheKey = this.getCacheKey(url, options);

        // Check cache
        if (options.useCache !== false) {
            const cached = this.getFromCache<T>(cacheKey, options.cacheTTL || 60000);
            if (cached) return cached;
        }

        // Retry logic with exponential backoff
        let lastError: ExtendedError | undefined;
        for (let attempt = 0; attempt < this.retries; attempt++) {
            try {
                const data = await this.fetchWithTimeout<T>(url, options);

                // Update cache
                if (options.useCache !== false) {
                    this.setCache(cacheKey, data);
                }

                return data;
            } catch (error: any) {
                lastError = error;

                // Don't retry on client errors (4xx)
                if (error.status && error.status >= 400 && error.status < 500) {
                    break;
                }

                // Wait before retry with exponential backoff
                if (attempt < this.retries - 1) {
                    await this.delay(this.retryDelay * Math.pow(2, attempt));
                }
            }
        }

        // All retries failed
        console.error(`API request failed after ${this.retries} attempts:`, lastError);
        throw lastError || new Error('Unknown error');
    }

    /**
     * Fetch with timeout
     */
    private async fetchWithTimeout<T>(url: string, options: RequestOptions): Promise<T> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error: ExtendedError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.response = response;
                throw error;
            }

            const data = await response.json();
            return data as T;
        } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                const timeoutError: ExtendedError = new Error(`Request timeout after ${this.timeout}ms`);
                timeoutError.isTimeout = true;
                throw timeoutError;
            }

            throw error;
        }
    }

    /**
     * HTTP Methods
     */
    get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    post<T>(endpoint: string, data: any, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    put<T>(endpoint: string, data: any, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }

    /**
     * Cache management
     */
    private getCacheKey(url: string, options: RequestOptions): string {
        return `${url}_${JSON.stringify(options.params || {})}`;
    }

    private getFromCache<T>(key: string, ttl: number): T | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age > ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data as T;
    }

    private setCache(key: string, data: any): void {
        // Limit cache size to prevent memory leaks
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Utilities
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Pre-configured API clients for common services
 */
export const binanceClient = new APIClient('https://api.binance.com/api/v3', {
    timeout: 5000,
    retries: 2
});

export const coinGeckoClient = new APIClient('https://api.coingecko.com/api/v3', {
    timeout: 15000,
    retries: 2,
    retryDelay: 2000
});

// Alternative.me API (Fear & Greed Index)
export const alternativeClient = new APIClient('https://api.alternative.me', {
    timeout: 10000,
    retries: 2
});

export default APIClient;
