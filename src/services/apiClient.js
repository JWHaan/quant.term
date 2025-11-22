/**
 * Robust API Client with retry logic, caching, and error handling
 * Designed for production use with proper timeout and rate limiting
 */
class APIClient {
    constructor(baseURL, options = {}) {
        this.baseURL = baseURL;
        this.timeout = options.timeout || 10000;
        this.retries = options.retries || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.cache = new Map();
        this.requestQueue = [];
        this.isProcessing = false;
    }

    /**
     * Main request method with retry logic
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const cacheKey = this.getCacheKey(url, options);

        // Check cache
        if (options.cache !== false) {
            const cached = this.getFromCache(cacheKey, options.cacheTTL || 60000);
            if (cached) return cached;
        }

        // Retry logic with exponential backoff
        let lastError;
        for (let attempt = 0; attempt < this.retries; attempt++) {
            try {
                const data = await this.fetchWithTimeout(url, options);

                // Update cache
                if (options.cache !== false) {
                    this.setCache(cacheKey, data);
                }

                return data;
            } catch (error) {
                lastError = error;

                // Don't retry on client errors (4xx)
                if (error.status >= 400 && error.status < 500) {
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
        throw lastError;
    }

    /**
     * Fetch with timeout
     */
    async fetchWithTimeout(url, options) {
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
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.response = response;
                throw error;
            }

            const data = await response.json();
            return data;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                const timeoutError = new Error(`Request timeout after ${this.timeout}ms`);
                timeoutError.isTimeout = true;
                throw timeoutError;
            }

            throw error;
        }
    }

    /**
     * HTTP Methods
     */
    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    post(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    put(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    /**
     * Cache management
     */
    getCacheKey(url, options) {
        return `${url}_${JSON.stringify(options.params || {})}`;
    }

    getFromCache(key, ttl) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age > ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    setCache(key, data) {
        // Limit cache size to prevent memory leaks
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    /**
     * Utilities
     */
    delay(ms) {
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
