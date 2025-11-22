/**
 * Performance Utilities
 * Throttling, debouncing, and delta computation for high-frequency data
 */

/**
 * Throttle function calls to maximum rate
 * @param fn - Function to throttle
 * @param delay - Minimum delay between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    return function throttled(...args: Parameters<T>) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;

        if (timeSinceLastCall >= delay) {
            lastCall = now;
            fn(...args);
        } else {
            // Schedule for later
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                fn(...args);
                timeoutId = null;
            }, delay - timeSinceLastCall);
        }
    };
}

/**
 * Debounce function calls - only execute after quiet period
 * @param fn - Function to debounce
 * @param delay - Quiet period in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return function debounced(...args: Parameters<T>) {
        if (timeoutId) clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delay);
    };
}

/**
 * Compute delta (changes only) between two objects
 * Useful for reducing bandwidth in order book updates
 * 
 * @param previous - Previous state
 * @param current - Current state
 * @returns Object containing only changed fields
 */
export function computeDelta<T extends Record<string, any>>(
    previous: T | null,
    current: T
): Partial<T> {
    if (!previous) return current;

    const delta: Partial<T> = {};
    let hasChanges = false;

    for (const key in current) {
        if (current[key] !== previous[key]) {
            delta[key] = current[key];
            hasChanges = true;
        }
    }

    return hasChanges ? delta : {};
}

/**
 * Compute delta for array of order book levels
 * Only returns changed/new/removed levels
 * 
 * @param previous - Previous levels array
 * @param current - Current levels array
 * @returns Object with added, updated, and removed levels
 */
export interface OrderBookLevel {
    price: number;
    quantity: number;
}

export interface OrderBookDelta {
    added: OrderBookLevel[];
    updated: OrderBookLevel[];
    removed: number[]; // prices of remove levels
}

export function computeOrderBookDelta(
    previous: OrderBookLevel[],
    current: OrderBookLevel[]
): OrderBookDelta {
    const delta: OrderBookDelta = {
        added: [],
        updated: [],
        removed: []
    };

    // Create maps for O(1) lookup
    const prevMap = new Map<number, number>();
    previous.forEach(level => prevMap.set(level.price, level.quantity));

    const currMap = new Map<number, number>();
    current.forEach(level => currMap.set(level.price, level.quantity));

    // Find added and updated levels
    current.forEach(level => {
        const prevQty = prevMap.get(level.price);

        if (prevQty === undefined) {
            // New level
            delta.added.push(level);
        } else if (prevQty !== level.quantity) {
            // Updated level
            delta.updated.push(level);
        }
    });

    // Find removed levels
    previous.forEach(level => {
        if (!currMap.has(level.price)) {
            delta.removed.push(level.price);
        }
    });

    return delta;
}

/**
 * Batch processor for high-frequency updates
 * Collects updates and processes them in batches
 */
export class BatchProcessor<T> {
    private queue: T[] = [];
    private timeoutId: NodeJS.Timeout | null = null;
    private readonly batchDelay: number;
    private readonly processor: (batch: T[]) => void;

    constructor(processor: (batch: T[]) => void, batchDelay: number = 50) {
        this.processor = processor;
        this.batchDelay = batchDelay;
    }

    /**
     * Add item to batch queue
     */
    add(item: T): void {
        this.queue.push(item);
        this.scheduleBatch();
    }

    /**
     * Schedule batch processing
     */
    private scheduleBatch(): void {
        if (this.timeoutId) return;

        this.timeoutId = setTimeout(() => {
            this.processBatch();
        }, this.batchDelay);
    }

    /**
     * Process accumulated batch
     */
    private processBatch(): void {
        if (this.queue.length === 0) {
            this.timeoutId = null;
            return;
        }

        const batch = [...this.queue];
        this.queue = [];
        this.timeoutId = null;

        try {
            this.processor(batch);
        } catch (error) {
            console.error('[BatchProcessor] Error processing batch:', error);
        }
    }

    /**
     * Force immediate processing
     */
    flush(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        if (this.queue.length > 0) {
            this.processBatch();
        }
    }

    /**
     * Clear queued items
     */
    clear(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.queue = [];
    }
}

/**
 * FPS limiter for animation frames
 * Ensures renders don't exceed target FPS
 * 
 * @param targetFPS - Target frames per second (default: 60)
 * @returns Function to call requestAnimationFrame with FPS limiting
 */
export function createFPSLimiter(targetFPS: number = 60) {
    const frameDelay = 1000 / targetFPS;
    let lastFrameTime = 0;

    return function limitedRAF(callback: FrameRequestCallback): number {
        const now = performance.now();
        const elapsed = now - lastFrameTime;

        if (elapsed >= frameDelay) {
            lastFrameTime = now;
            return requestAnimationFrame(callback);
        } else {
            // Schedule for next available frame after delay
            return setTimeout(() => {
                lastFrameTime = performance.now();
                requestAnimationFrame(callback);
            }, frameDelay - elapsed) as unknown as number;
        }
    };
}

/**
 * Memory-efficient ring buffer for storing recent values
 * Useful for maintaining sliding windows of data
 */
export class RingBuffer<T> {
    private buffer: T[];
    private writeIndex: number = 0;
    private readonly capacity: number;
    private size: number = 0;

    constructor(capacity: number) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
    }

    /**
     * Add value to buffer
     */
    push(value: T): void {
        this.buffer[this.writeIndex] = value;
        this.writeIndex = (this.writeIndex + 1) % this.capacity;

        if (this.size < this.capacity) {
            this.size++;
        }
    }

    /**
     * Get all values in chronological order
     */
    toArray(): T[] {
        if (this.size < this.capacity) {
            return this.buffer.slice(0, this.size);
        }

        // Return in order: from writeIndex to end, then from start to writeIndex
        return [
            ...this.buffer.slice(this.writeIndex),
            ...this.buffer.slice(0, this.writeIndex)
        ];
    }

    /**
     * Get most recent value
     */
    latest(): T | undefined {
        if (this.size === 0) return undefined;
        const lastIndex = (this.writeIndex - 1 + this.capacity) % this.capacity;
        return this.buffer[lastIndex];
    }

    /**
     * Get current size
     */
    getSize(): number {
        return this.size;
    }

    /**
     * Check if buffer is full
     */
    isFull(): boolean {
        return this.size === this.capacity;
    }

    /**
     * Clear buffer
     */
    clear(): void {
        this.writeIndex = 0;
        this.size = 0;
    }
}
