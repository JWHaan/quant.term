import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { get, set } from 'idb-keyval';
import type { OHLCV } from '@/types/common';
import { calculateRSI, calculateMACD, calculateBollingerBands, calculateOFI } from '@/utils/indicators';
import type { MLPrediction, ModelMetrics } from '@/stores/quantStore';

/**
 * ML Service - Machine Learning for trading signal generation
 * Uses TensorFlow.js for browser-based ML inference
 */

interface TrainingData {
    features: number[];
    label: number; // 0 = DOWN, 1 = NEUTRAL, 2 = UP
}

interface StandardScaler {
    mean: number[];
    std: number[];
}

class MLService {
    private model: tf.LayersModel | null = null;
    private scaler: StandardScaler | null = null;
    private isTraining: boolean = false;
    private featureNames: string[] = ['RSI', 'MACD', 'BB_Position', 'Volume_Ratio', 'OFI', 'Funding_Rate'];

    constructor() {
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            // Set WebGL backend for GPU acceleration
            await tf.setBackend('webgl');
            await tf.ready();
            console.log('[MLService] TensorFlow.js initialized with WebGL backend');
            
            // Try to load existing model
            await this.loadModel();
        } catch (error) {
            console.error('[MLService] Initialization error:', error);
        }
    }

    /**
     * Extract features from market data
     * Features: RSI, MACD histogram, BB position, volume ratio, OFI, funding rate
     */
    extractFeatures(data: OHLCV[], additionalData?: {
        fundingRate?: number;
        trades?: Array<{ quantity: number | string; isBuyerMaker: boolean }>;
    }): number[] {
        if (data.length < 50) {
            throw new Error('Insufficient data for feature extraction (need at least 50 candles)');
        }

        try {
            // Calculate indicators
            const rsiData = calculateRSI(data, 14);
            const macdData = calculateMACD(data, 12, 26, 9);
            const bbData = calculateBollingerBands(data, 20, 2);

            // Get latest values
            const rsi = rsiData[rsiData.length - 1]?.value ?? 50;
            const macd = macdData[macdData.length - 1]?.histogram ?? 0;
            const bb = bbData[bbData.length - 1];
            const lastCandle = data[data.length - 1];
            if (!lastCandle) throw new Error('No candle data');
            const lastClose = lastCandle.close;

            // BB Position (0 = lower band, 1 = upper band)
            const bbPosition = bb ? (lastClose - bb.lower) / (bb.upper - bb.lower) : 0.5;

            // Volume ratio (current vs 20-period average)
            const recentVolumes = data.slice(-20).map(d => d.volume);
            const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
            const volumeRatio = lastCandle.volume / avgVolume;

            // Order Flow Imbalance
            let ofi = 0;
            if (additionalData?.trades && additionalData.trades.length > 0) {
                const ofiData = calculateOFI(additionalData.trades);
                ofi = ofiData.imbalanceRatio;
            }

            // Funding rate (if available)
            const fundingRate = additionalData?.fundingRate ?? 0;

            return [
                rsi / 100,              // Normalize to 0-1
                macd,                   // Keep as is (can be negative)
                bbPosition,             // Already 0-1
                Math.min(volumeRatio, 5) / 5, // Cap at 5x and normalize
                (ofi + 1) / 2,         // Convert from -1,1 to 0,1
                fundingRate * 100       // Scale funding rate
            ];
        } catch (error) {
            console.error('[MLService] Feature extraction error:', error);
            // Return neutral features on error
            return [0.5, 0, 0.5, 1, 0.5, 0];
        }
    }

    /**
     * Normalize features using StandardScaler
     */
    private normalizeFeatures(features: number[][]): number[][] {
        if (!this.scaler) {
            // Fit scaler
            const n = features.length;
            const firstRow = features[0];
            if (!firstRow) throw new Error('No features to normalize');
            const m = firstRow.length;
            
            const mean = new Array(m).fill(0);
            const std = new Array(m).fill(0);

            // Calculate mean
            for (let j = 0; j < m; j++) {
                for (let i = 0; i < n; i++) {
                    const val = features[i]?.[j];
                    if (val !== undefined) mean[j] += val;
                }
                mean[j] /= n;
            }

            // Calculate std
            for (let j = 0; j < m; j++) {
                for (let i = 0; i < n; i++) {
                    const val = features[i]?.[j];
                    if (val !== undefined) {
                        std[j] += Math.pow(val - mean[j], 2);
                    }
                }
                std[j] = Math.sqrt(std[j] / n);
                if (std[j] === 0) std[j] = 1; // Avoid division by zero
            }

            this.scaler = { mean, std };
        }

        // Transform
        return features.map(row => 
            row.map((val, j) => (val - (this.scaler!.mean[j] ?? 0)) / (this.scaler!.std[j] ?? 1))
        );
    }

    /**
     * Create neural network model
     */
    private createModel(): tf.LayersModel {
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [6],
                    units: 32,
                    activation: 'relu',
                    kernelInitializer: 'heNormal'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 16,
                    activation: 'relu',
                    kernelInitializer: 'heNormal'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 3,
                    activation: 'softmax'
                })
            ]
        });

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    /**
     * Train model on historical data
     * @param trainingData - Array of {features, label} objects
     * @returns Model metrics
     */
    async trainModel(trainingData: TrainingData[]): Promise<ModelMetrics> {
        if (this.isTraining) {
            throw new Error('Model is already training');
        }

        if (trainingData.length < 100) {
            throw new Error('Insufficient training data (need at least 100 samples)');
        }

        this.isTraining = true;
        console.log(`[MLService] Training model with ${trainingData.length} samples`);

        try {
            // Prepare data
            const features = trainingData.map(d => d.features);
            const labels = trainingData.map(d => d.label);

            // Normalize features
            const normalizedFeatures = this.normalizeFeatures(features);

            // Convert to tensors
            const xs = tf.tensor2d(normalizedFeatures);
            const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), 3);

            // Split train/validation (80/20)
            const splitIdx = Math.floor(trainingData.length * 0.8);
            const xsTrain = xs.slice([0, 0], [splitIdx, 6]);
            const ysTrain = ys.slice([0, 0], [splitIdx, 3]);
            const xsVal = xs.slice([splitIdx, 0], [-1, 6]);
            const ysVal = ys.slice([splitIdx, 0], [-1, 3]);

            // Create or reset model
            if (this.model) {
                this.model.dispose();
            }
            this.model = this.createModel();

            // Train
            await this.model.fit(xsTrain, ysTrain, {
                epochs: 50,
                batchSize: 32,
                validationData: [xsVal, ysVal],
                shuffle: true,
                verbose: 0,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        if (epoch % 10 === 0 && logs) {
                            console.log(`[MLService] Epoch ${epoch}: loss=${logs.loss?.toFixed(4)}, acc=${logs.acc?.toFixed(4)}`);
                        }
                    }
                }
            });

            // Calculate metrics on validation set
            const predictions = this.model.predict(xsVal) as tf.Tensor;
            const predLabels = predictions.argMax(-1);
            const trueLabels = ysVal.argMax(-1);

            const accuracy = await tf.metrics.categoricalAccuracy(ysVal, predictions).mean().data();
            
            // Calculate precision, recall, F1 (simplified)
            const predArray = await predLabels.array() as number[];
            const trueArray = await trueLabels.array() as number[];

            let tp = 0, fp = 0, fn = 0;
            for (let i = 0; i < predArray.length; i++) {
                if (predArray[i] === 2 && trueArray[i] === 2) tp++; // UP class
                if (predArray[i] === 2 && trueArray[i] !== 2) fp++;
                if (predArray[i] !== 2 && trueArray[i] === 2) fn++;
            }

            const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
            const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
            const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

            const metrics: ModelMetrics = {
                accuracy: accuracy[0] ?? 0,
                precision,
                recall,
                f1Score,
                lastTraining: Date.now()
            };

            console.log('[MLService] Training complete:', metrics);

            // Save model
            await this.saveModel();

            // Cleanup
            xs.dispose();
            ys.dispose();
            xsTrain.dispose();
            ysTrain.dispose();
            xsVal.dispose();
            ysVal.dispose();
            predictions.dispose();
            predLabels.dispose();
            trueLabels.dispose();

            this.isTraining = false;
            return metrics;

        } catch (error) {
            this.isTraining = false;
            console.error('[MLService] Training error:', error);
            throw error;
        }
    }

    /**
     * Make prediction for current market state
     * @param features - Feature vector
     * @param symbol - Trading symbol
     * @param horizon - Prediction horizon
     * @returns ML prediction with confidence
     */
    async predict(
        features: number[],
        symbol: string,
        horizon: '15m' | '1h' | '4h' = '15m'
    ): Promise<MLPrediction> {
        if (!this.model) {
            throw new Error('Model not trained. Call trainModel() first.');
        }

        if (features.length !== 6) {
            throw new Error(`Expected 6 features, got ${features.length}`);
        }

        try {
            // Normalize
            const normalized = this.scaler 
                ? features.map((val, j) => (val - (this.scaler!.mean[j] ?? 0)) / (this.scaler!.std[j] ?? 1))
                : features;

            // Predict
            const input = tf.tensor2d([normalized]);
            const prediction = this.model.predict(input) as tf.Tensor;
            const probabilities = await prediction.data();

            // Get predicted class and confidence
            const maxProb = Math.max(...Array.from(probabilities));
            const predictedClass = Array.from(probabilities).indexOf(maxProb);

            const direction = predictedClass === 2 ? 'UP' : predictedClass === 0 ? 'DOWN' : 'NEUTRAL';
            const confidence = maxProb;

            // Feature importance (simplified - use feature values as proxy)
            const featureImportance: Record<string, number> = {};
            this.featureNames.forEach((name, i) => {
                featureImportance[name] = Math.abs(normalized[i] ?? 0);
            });

            // Cleanup
            input.dispose();
            prediction.dispose();

            return {
                symbol,
                direction,
                confidence,
                horizon,
                features: {
                    RSI: features[0] ?? 0,
                    MACD: features[1] ?? 0,
                    BB_Position: features[2] ?? 0,
                    Volume_Ratio: features[3] ?? 0,
                    OFI: features[4] ?? 0,
                    Funding_Rate: features[5] ?? 0
                },
                featureImportance,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('[MLService] Prediction error:', error);
            throw error;
        }
    }

    /**
     * Calculate feature importance using permutation importance
     * (Simplified version - full implementation would require validation set)
     */
    calculateFeatureImportance(_testData: TrainingData[]): Record<string, number> {
        // Placeholder - would need full implementation with validation set
        const importance: Record<string, number> = {};
        this.featureNames.forEach(name => {
            importance[name] = Math.random(); // Simplified
        });
        return importance;
    }

    /**
     * Save model to IndexedDB
     */
    async saveModel(): Promise<void> {
        if (!this.model) {
            throw new Error('No model to save');
        }

        try {
            await this.model.save('indexeddb://ml-model');
            await set('ml-scaler', this.scaler);
            console.log('[MLService] Model saved to IndexedDB');
        } catch (error) {
            console.error('[MLService] Model save error:', error);
            throw error;
        }
    }

    /**
     * Load model from IndexedDB
     */
    async loadModel(): Promise<boolean> {
        try {
            this.model = await tf.loadLayersModel('indexeddb://ml-model');
            const scaler = await get<StandardScaler>('ml-scaler');
            this.scaler = scaler ?? null;
            
            if (this.model && this.scaler) {
                console.log('[MLService] Model loaded from IndexedDB');
                return true;
            }
            return false;
        } catch (error) {
            console.log('[MLService] No saved model found');
            return false;
        }
    }

    /**
     * Check if model is ready for predictions
     */
    isReady(): boolean {
        return this.model !== null && this.scaler !== null;
    }

    /**
     * Get model summary
     */
    getModelSummary(): string {
        if (!this.model) {
            return 'No model loaded';
        }
        
        const layers = this.model.layers.length;
        const params = this.model.countParams();
        return `${layers} layers, ${params} parameters`;
    }

    /**
     * Dispose model and free memory
     */
    dispose(): void {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
        this.scaler = null;
        console.log('[MLService] Model disposed');
    }
}

// Export singleton instance
export const mlService = new MLService();
export default mlService;
