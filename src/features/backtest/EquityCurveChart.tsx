import React, { useMemo } from 'react';
import type { BacktestEquityPoint } from '@/backtest/types';
import { formatCurrency } from '@/utils/format';

interface EquityCurveChartProps {
    points: BacktestEquityPoint[];
}

const WIDTH = 900;
const HEIGHT = 260;
const PADDING = { top: 22, right: 18, bottom: 34, left: 72 } as const;

const EquityCurveChart: React.FC<EquityCurveChartProps> = ({ points }) => {
    const chart = useMemo(() => {
        if (points.length === 0) return null;

        const values = points.map((point) => point.equity);
        const rawMin = Math.min(...values);
        const rawMax = Math.max(...values);
        const padding = Math.max((rawMax - rawMin) * 0.12, rawMax * 0.002);
        const min = rawMin - padding;
        const max = rawMax + padding;
        const innerWidth = WIDTH - PADDING.left - PADDING.right;
        const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

        const x = (index: number): number => (
            PADDING.left + ((index / Math.max(1, points.length - 1)) * innerWidth)
        );
        const y = (value: number): number => (
            PADDING.top + (((max - value) / Math.max(Number.EPSILON, max - min)) * innerHeight)
        );

        const line = points
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(point.equity).toFixed(2)}`)
            .join(' ');
        const area = `${line} L${x(points.length - 1).toFixed(2)},${(HEIGHT - PADDING.bottom).toFixed(2)} L${PADDING.left},${(HEIGHT - PADDING.bottom).toFixed(2)} Z`;
        const ticks = Array.from({ length: 5 }, (_, index) => {
            const ratio = index / 4;
            const value = max - ((max - min) * ratio);
            return { value, y: PADDING.top + (innerHeight * ratio) };
        });

        return { min: rawMin, max: rawMax, line, area, ticks };
    }, [points]);

    if (!chart) return null;

    const first = points[0]!;
    const last = points.at(-1)!;
    const direction = last.equity >= first.equity ? 'positive' : 'negative';
    const lineColor = direction === 'positive' ? 'var(--accent-success)' : 'var(--accent-danger)';

    return (
        <figure className="backtest-chart">
            <figcaption>
                <span>MARK-TO-MARKET EQUITY</span>
                <strong className={direction}>
                    {formatCurrency(first.equity)} → {formatCurrency(last.equity)}
                </strong>
            </figcaption>
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                role="img"
                aria-labelledby="equity-chart-title equity-chart-description"
                preserveAspectRatio="none"
            >
                <title id="equity-chart-title">Backtest equity curve</title>
                <desc id="equity-chart-description">
                    Equity ranges from {formatCurrency(chart.min)} to {formatCurrency(chart.max)}
                    across {points.length} one-minute candles.
                </desc>
                <defs>
                    <linearGradient id="equity-area-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity="0.24" />
                        <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
                    </linearGradient>
                </defs>
                {chart.ticks.map((tick) => (
                    <g key={tick.y}>
                        <line
                            x1={PADDING.left}
                            x2={WIDTH - PADDING.right}
                            y1={tick.y}
                            y2={tick.y}
                            stroke="var(--chart-grid)"
                            strokeWidth="1"
                        />
                        <text
                            x={PADDING.left - 10}
                            y={tick.y + 3}
                            textAnchor="end"
                            fill="var(--text-muted)"
                            fontSize="10"
                        >
                            {formatCurrency(tick.value)}
                        </text>
                    </g>
                ))}
                <path d={chart.area} fill="url(#equity-area-gradient)" />
                <path
                    d={chart.line}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                />
                <text
                    x={PADDING.left}
                    y={HEIGHT - 10}
                    fill="var(--text-muted)"
                    fontSize="10"
                >
                    {new Date(first.time * 1000).toISOString().slice(11, 16)} UTC
                </text>
                <text
                    x={WIDTH - PADDING.right}
                    y={HEIGHT - 10}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="10"
                >
                    {new Date(last.time * 1000).toISOString().slice(11, 16)} UTC
                </text>
            </svg>
        </figure>
    );
};

export default React.memo(EquityCurveChart);
