/**
 * Worker Pool - Manages Web Workers for parallel computation
 * Distributes tasks across multiple workers based on CPU cores
 */

interface Task {
    id: string;
    type: string;
    payload: any;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

class WorkerPool {
    private workers: Worker[] = [];
    private availableWorkers: Worker[] = [];
    private taskQueue: Task[] = [];
    private activeTasks: Map<string, Task> = new Map();
    private maxWorkers: number;
    private workerPath: string;
    private taskIdCounter: number = 0;

    constructor(workerPath: string = '/workers/quantWorker.js', maxWorkers?: number) {
        this.workerPath = workerPath;
        this.maxWorkers = maxWorkers || navigator.hardwareConcurrency || 4;
        this.initialize();
    }

    private initialize(): void {
        console.log(`[WorkerPool] Initializing with ${this.maxWorkers} workers`);
        
        for (let i = 0; i < this.maxWorkers; i++) {
            try {
                const worker = new Worker(this.workerPath);
                
                worker.onmessage = (e) => this.handleWorkerMessage(worker, e);
                worker.onerror = (error) => this.handleWorkerError(worker, error);
                
                this.workers.push(worker);
                this.availableWorkers.push(worker);
            } catch (error) {
                console.error(`[WorkerPool] Failed to create worker ${i}:`, error);
            }
        }
    }

    private handleWorkerMessage(worker: Worker, e: MessageEvent): void {
        const { type, payload, id } = e.data;

        if (type === 'READY') {
            console.log('[WorkerPool] Worker ready');
            return;
        }

        if (type === 'ERROR') {
            const task = this.activeTasks.get(id);
            if (task) {
                clearTimeout(task.timeout);
                this.activeTasks.delete(id);
                this.availableWorkers.push(worker);
                task.reject(new Error(payload.message));
                this.processQueue();
            }
            return;
        }

        // Handle result
        const task = this.activeTasks.get(id);
        if (task) {
            clearTimeout(task.timeout);
            this.activeTasks.delete(id);
            this.availableWorkers.push(worker);
            task.resolve(payload);
            this.processQueue();
        }
    }

    private handleWorkerError(worker: Worker, error: ErrorEvent): void {
        console.error('[WorkerPool] Worker error:', error);
        
        // Find and reject all tasks assigned to this worker
        for (const [id, task] of this.activeTasks.entries()) {
            clearTimeout(task.timeout);
            this.activeTasks.delete(id);
            task.reject(new Error(`Worker error: ${error.message}`));
        }

        // Remove failed worker and create a new one
        const index = this.workers.indexOf(worker);
        if (index > -1) {
            this.workers.splice(index, 1);
            this.availableWorkers = this.availableWorkers.filter(w => w !== worker);
        }

        try {
            worker.terminate();
        } catch (e) {
            console.error('[WorkerPool] Failed to terminate worker:', e);
        }

        // Create replacement worker
        try {
            const newWorker = new Worker(this.workerPath);
            newWorker.onmessage = (e) => this.handleWorkerMessage(newWorker, e);
            newWorker.onerror = (error) => this.handleWorkerError(newWorker, error);
            this.workers.push(newWorker);
            this.availableWorkers.push(newWorker);
        } catch (e) {
            console.error('[WorkerPool] Failed to create replacement worker:', e);
        }

        this.processQueue();
    }

    private processQueue(): void {
        while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
            const task = this.taskQueue.shift();
            const worker = this.availableWorkers.shift();

            if (task && worker) {
                this.activeTasks.set(task.id, task);
                worker.postMessage({
                    type: task.type,
                    payload: task.payload,
                    id: task.id
                });
            }
        }
    }

    /**
     * Execute a task in the worker pool
     * @param type - Task type (e.g., 'CALCULATE_INDICATORS')
     * @param payload - Task data
     * @param timeoutMs - Timeout in milliseconds (default: 30000)
     * @returns Promise with result
     */
    execute<T = any>(type: string, payload: any, timeoutMs: number = 30000): Promise<T> {
        return new Promise((resolve, reject) => {
            const id = `task_${++this.taskIdCounter}_${Date.now()}`;

            const timeout = setTimeout(() => {
                this.activeTasks.delete(id);
                const taskIndex = this.taskQueue.findIndex(t => t.id === id);
                if (taskIndex > -1) {
                    this.taskQueue.splice(taskIndex, 1);
                }
                reject(new Error(`Task ${type} timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            const task: Task = {
                id,
                type,
                payload,
                resolve,
                reject,
                timeout
            };

            this.taskQueue.push(task);
            this.processQueue();
        });
    }

    /**
     * Get pool statistics
     */
    getStats(): {
        totalWorkers: number;
        availableWorkers: number;
        activeTasks: number;
        queuedTasks: number;
    } {
        return {
            totalWorkers: this.workers.length,
            availableWorkers: this.availableWorkers.length,
            activeTasks: this.activeTasks.size,
            queuedTasks: this.taskQueue.length
        };
    }

    /**
     * Terminate all workers and clear queue
     */
    terminate(): void {
        console.log('[WorkerPool] Terminating all workers');
        
        // Clear all timeouts
        for (const task of this.activeTasks.values()) {
            clearTimeout(task.timeout);
            task.reject(new Error('Worker pool terminated'));
        }

        // Clear queue
        for (const task of this.taskQueue) {
            clearTimeout(task.timeout);
            task.reject(new Error('Worker pool terminated'));
        }

        // Terminate workers
        for (const worker of this.workers) {
            try {
                worker.terminate();
            } catch (e) {
                console.error('[WorkerPool] Failed to terminate worker:', e);
            }
        }

        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
        this.activeTasks.clear();
    }
}

// Export singleton instance
export const workerPool = new WorkerPool();
export default workerPool;
