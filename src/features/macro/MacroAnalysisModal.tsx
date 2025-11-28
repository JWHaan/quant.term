import React, { useEffect, useRef, useState, useContext } from 'react';
import { ThemeContext } from '../../ui/ThemeProvider';
import { createChart, ColorType, LineSeries, IChartApi } from 'lightweight-charts';
import { X, Globe } from 'lucide-react';
import { OpenBBService, MacroData } from '../../services/OpenBBService';

interface MacroAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MacroAnalysisModal: React.FC<MacroAnalysisModalProps> = ({ isOpen, onClose }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [data, setData] = useState<MacroData | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'CPI' | 'GDP' | 'RATES'>('CPI');
    const { theme } = useContext(ThemeContext);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            OpenBBService.getMacroData().then(d => {
                setData(d);
                setLoading(false);
            });
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !chartContainerRef.current || !data) return;

        // Cleanup previous chart
        if (chartRef.current) {
            chartRef.current.remove();
        }

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: getComputedStyle(document.documentElement).getPropertyValue('--bg-panel').trim() },
                textColor: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim(),
                fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim(),
            },
            grid: {
                vertLines: { color: getComputedStyle(document.documentElement).getPropertyValue('--border-subtle').trim(), style: 1 },
                horzLines: { color: getComputedStyle(document.documentElement).getPropertyValue('--border-subtle').trim(), style: 1 },
            },
            width: chartContainerRef.current.clientWidth,
            height: 300,
            timeScale: {
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim(),
            },
            rightPriceScale: {
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim(),
            },
        });

        chartRef.current = chart;

        const series = chart.addSeries(LineSeries, {
            color: 'var(--accent-primary)',
            lineWidth: 2,
            title: activeTab,
        });

        let seriesData: any[] = [];
        if (activeTab === 'CPI') seriesData = data.cpi;
        if (activeTab === 'GDP') seriesData = data.gdp;
        if (activeTab === 'RATES') seriesData = data.fedRate;

        series.setData(seriesData.map(d => ({ time: d.date, value: d.value })));

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [isOpen, data, activeTab, theme]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={onClose}>
            <div style={{
                width: '800px',
                maxWidth: '95%',
                height: '600px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-app)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Globe size={20} color="var(--accent-primary)" />
                        <h2 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                            Macro Analysis <span style={{ opacity: 0.5, fontSize: '12px' }}>powered by OpenBB</span>
                        </h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        {(['CPI', 'GDP', 'RATES'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '8px 16px',
                                    background: activeTab === tab ? 'var(--accent-primary)' : 'transparent',
                                    color: activeTab === tab ? '#fff' : 'var(--text-muted)',
                                    border: activeTab === tab ? 'none' : '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-ui)',
                                    fontWeight: 500,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Chart Area */}
                    <div style={{ flex: 1, position: 'relative', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                        {loading && (
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,0,0,0.5)',
                                zIndex: 10
                            }}>
                                <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>LOADING DATA...</span>
                            </div>
                        )}
                        <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
                    </div>

                    {/* Stats / Insights */}
                    <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>BTC Correlation</div>
                            <div style={{ color: 'var(--text-primary)', fontSize: '18px', fontFamily: 'var(--font-mono)' }}>-0.45</div>
                        </div>
                        <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Trend (YoY)</div>
                            <div style={{ color: 'var(--accent-danger)', fontSize: '18px', fontFamily: 'var(--font-mono)' }}>+3.2%</div>
                        </div>
                        <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Next Release</div>
                            <div style={{ color: 'var(--accent-warning)', fontSize: '18px', fontFamily: 'var(--font-mono)' }}>2 Days</div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MacroAnalysisModal;
