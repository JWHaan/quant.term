import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, HistogramSeries } from 'lightweight-charts';

const VaRChart = ({ returns = [] }) => {
    const chartContainerRef = useRef();
    const [var95, setVar95] = useState(0);
    const [var99, setVar99] = useState(0);

    useEffect(() => {
        if (!chartContainerRef.current) return;
        if (returns.length < 10) return; // Need data
        chartContainerRef.current.innerHTML = '';

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#a0a0a0',
            },
            grid: {
                vertLines: { color: '#222222' },
                horzLines: { color: '#222222' },
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            rightPriceScale: {
                borderColor: '#333333',
            },
            timeScale: {
                borderColor: '#333333',
                visible: false,
            },
        });

        const series = chart.addSeries(HistogramSeries, {
            color: '#26a69a',
        });

        // Monte Carlo Simulation using Historical Stats
        const simulations = 10000;

        // Calculate Mean and StdDev from real returns
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        const results = [];

        for (let i = 0; i < simulations; i++) {
            // Box-Muller transform for normal distribution
            const u = 1 - Math.random();
            const v = Math.random();
            const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            results.push(mean + stdDev * z);
        }

        results.sort((a, b) => a - b);

        // Calculate VaR and update state in a separate function
        const updateVaRValues = () => {
            const idx95 = Math.floor(simulations * 0.05);
            const idx99 = Math.floor(simulations * 0.01);
            const var95Value = results[idx95] * 100;
            const var99Value = results[idx99] * 100;
            
            setVar95(var95Value);
            setVar99(var99Value);
        };

        // Use setTimeout to defer state updates
        setTimeout(updateVaRValues, 0);

        // Calculate VaR indices for histogram coloring
        const idx95 = Math.floor(simulations * 0.05);
        const idx99 = Math.floor(simulations * 0.01);

        // Histogram Data
        const bins = 50;
        const min = results[0];
        const max = results[results.length - 1];
        const range = max - min;
        const binSize = range / bins;
        const histogramData = [];

        for (let i = 0; i < bins; i++) {
            const binStart = min + i * binSize;
            const binEnd = binStart + binSize;
            const count = results.filter(r => r >= binStart && r < binEnd).length;

            let color = 'var(--accent-primary)';
            if (binStart < results[idx95]) color = 'orange';
            if (binStart < results[idx99]) color = 'red';

            histogramData.push({
                time: i, // Dummy time
                value: count,
                color: color
            });
        }

        series.setData(histogramData);

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };

        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, [returns]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
            <div style={{
                position: 'absolute',
                top: 10,
                left: 10,
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                pointerEvents: 'none',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '8px',
                borderRadius: '4px'
            }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>MONTE CARLO VaR (1D)</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div>
                        <span style={{ fontSize: '10px', color: 'orange' }}>95% VaR</span>
                        <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'orange' }}>{var95.toFixed(2)}%</div>
                    </div>
                    <div>
                        <span style={{ fontSize: '10px', color: 'red' }}>99% VaR</span>
                        <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'red' }}>{var99.toFixed(2)}%</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VaRChart;
