import React, { useEffect, useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { mlService } from '@/services/mlService';
import { useQuantStore } from '@/stores/quantStore';

interface MLSignalPanelProps {
    symbol: string;
}

const MLSignalPanel: React.FC<MLSignalPanelProps> = ({ symbol }) => {
    const { mlModelMetrics, getMLPrediction } = useQuantStore();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const prediction = getMLPrediction(symbol);

    useEffect(() => {
        // Check if model is ready
        const checkModel = async () => {
            try {
                const ready = mlService.isReady();
                setIsLoading(!ready);
                
                if (!ready) {
                    setError('Model not trained. Train the model first.');
                } else {
                    setError(null);
                }
            } catch (err) {
                setError('Failed to load ML model');
                console.error('[MLSignalPanel] Error:', err);
            }
        };

        checkModel();
    }, []);

    const getDirectionIcon = (direction: string) => {
        switch (direction) {
            case 'UP':
                return <TrendingUp size={20} color="var(--accent-primary)" />;
            case 'DOWN':
                return <TrendingDown size={20} color="var(--accent-danger)" />;
            default:
                return <Minus size={20} color="var(--text-muted)" />;
        }
    };

    const getDirectionColor = (direction: string) => {
        switch (direction) {
            case 'UP':
                return 'var(--accent-primary)';
            case 'DOWN':
                return 'var(--accent-danger)';
            default:
                return 'var(--text-muted)';
        }
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.75) return 'var(--accent-primary)';
        if (confidence >= 0.65) return 'var(--accent-warning)';
        return 'var(--accent-danger)';
    };

    if (isLoading) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                color: 'var(--text-muted)',
                fontSize: '12px'
            }}>
                <Brain size={16} style={{ marginRight: '8px' }} />
                Loading ML model...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                color: 'var(--accent-warning)',
                fontSize: '12px',
                textAlign: 'center'
            }}>
                <AlertCircle size={24} style={{ marginBottom: '8px' }} />
                {error}
            </div>
        );
    }

    if (!prediction) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                color: 'var(--text-muted)',
                fontSize: '12px'
            }}>
                No prediction available for {symbol}
            </div>
        );
    }

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            fontFamily: 'var(--font-mono)',
            overflow: 'auto'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <Brain size={16} color="var(--accent-primary)" />
                <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        ML PREDICTION
                    </div>
                    <div style={{ fontSize: '12px', color: '#fff' }}>
                        {symbol} @ {prediction.horizon}
                    </div>
                </div>
            </div>

            {/* Main Prediction */}
            <div style={{
                background: `linear-gradient(135deg, ${getDirectionColor(prediction.direction)}15 0%, ${getDirectionColor(prediction.direction)}05 100%)`,
                border: `1px solid ${getDirectionColor(prediction.direction)}40`,
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                textAlign: 'center'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    marginBottom: '8px'
                }}>
                    {getDirectionIcon(prediction.direction)}
                    <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        color: getDirectionColor(prediction.direction)
                    }}>
                        {prediction.direction}
                    </div>
                </div>
                <div style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    marginBottom: '4px'
                }}>
                    CONFIDENCE
                </div>
                <div style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: getConfidenceColor(prediction.confidence)
                }}>
                    {(prediction.confidence * 100).toFixed(1)}%
                </div>
            </div>

            {/* Feature Importance */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px'
            }}>
                <div style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: '#fff',
                    marginBottom: '10px'
                }}>
                    FEATURE IMPORTANCE
                </div>
                {Object.entries(prediction.featureImportance)
                    .sort(([, a], [, b]) => b - a)
                    .map(([feature, importance]) => (
                        <div key={feature} style={{ marginBottom: '8px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '9px',
                                color: 'var(--text-muted)',
                                marginBottom: '3px'
                            }}>
                                <span>{feature.replace('_', ' ')}</span>
                                <span>{importance.toFixed(3)}</span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '4px',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '2px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${Math.min(importance * 100, 100)}%`,
                                    height: '100%',
                                    background: 'var(--accent-primary)',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                        </div>
                    ))}
            </div>

            {/* Model Metrics */}
            {mlModelMetrics && (
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    padding: '12px'
                }}>
                    <div style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        color: '#fff',
                        marginBottom: '10px'
                    }}>
                        MODEL PERFORMANCE
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        fontSize: '9px'
                    }}>
                        <div>
                            <div style={{ color: 'var(--text-muted)' }}>Accuracy</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                                {(mlModelMetrics.accuracy * 100).toFixed(1)}%
                            </div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)' }}>Precision</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                                {(mlModelMetrics.precision * 100).toFixed(1)}%
                            </div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)' }}>Recall</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                                {(mlModelMetrics.recall * 100).toFixed(1)}%
                            </div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)' }}>F1 Score</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                                {(mlModelMetrics.f1Score * 100).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                    <div style={{
                        marginTop: '8px',
                        fontSize: '8px',
                        color: 'var(--text-muted)',
                        textAlign: 'center'
                    }}>
                        Last trained: {new Date(mlModelMetrics.lastTraining).toLocaleString()}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{
                marginTop: 'auto',
                fontSize: '8px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '8px'
            }}>
                Neural Network • {mlService.getModelSummary()}
            </div>
        </div>
    );
};

export default React.memo(MLSignalPanel);
