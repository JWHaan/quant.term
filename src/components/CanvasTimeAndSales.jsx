import React, { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';

// Column positions for the time & sales tape
const COLUMNS = {
    TIME: 10,
    PRICE: 70,
    SIZE: 150,
    TOTAL: 220,
    SIDE: 290,
};

/**
 * Canvas Time & Sales (High Performance)
 * Uses HTML5 Canvas to render trade tape at 60 FPS
 * Eliminates DOM overhead for high-frequency updates
 */
const CanvasTimeAndSales = ({ symbol = 'BTCUSDT' }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const wsRef = useRef(null);

    // Data buffer (Mutable, no re-renders)
    const tradesRef = useRef([]);
    const statsRef = useRef({ tps: 0, vwap: 0, buyPressure: 50, volume: 0 });
    const animationFrameRef = useRef(null);

    // React state only for low-frequency stats updates (1Hz)
    const [displayStats, setDisplayStats] = useState({ tps: 0, vwap: 0, buyPressure: 50 });

    // Constants
    const MAX_TRADES = 50; // Visible trades
    const ROW_HEIGHT = 20;
    const FONT_SIZE = 11;

    useEffect(() => {
        if (!symbol) return;

        // Initialize WebSocket
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@aggTrade`);

        ws.onmessage = (event) => {
            const trade = JSON.parse(event.data);
            const price = parseFloat(trade.p);
            const quantity = parseFloat(trade.q);
            const isBuyerMaker = trade.m; // true = sell, false = buy
            const time = trade.T;
            const value = price * quantity;

            // Add to buffer
            const newTrade = {
                time,
                price,
                quantity,
                value,
                isBuy: !isBuyerMaker,
                timestamp: Date.now(),
                alpha: 0 // For fade-in effect
            };

            tradesRef.current.unshift(newTrade);
            if (tradesRef.current.length > MAX_TRADES + 20) {
                tradesRef.current.pop();
            }

            // Update Stats (Accumulate)
            const stats = statsRef.current;
            stats.volume += quantity;
            // Simple moving average for stats to avoid heavy calc every frame
            // We'll do proper calc in the interval
        };

        wsRef.current = ws;

        // Animation Loop
        const render = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');

            if (canvas && ctx) {
                // Handle Resize
                const container = containerRef.current;
                if (container) {
                    const { clientWidth, clientHeight } = container;
                    if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
                        canvas.width = clientWidth;
                        canvas.height = clientHeight;
                    }
                }

                // Clear
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Draw Trades
                ctx.font = `600 ${FONT_SIZE}px "JetBrains Mono", monospace`;
                ctx.textBaseline = 'middle';

                tradesRef.current.forEach((trade, index) => {
                    const y = index * ROW_HEIGHT + (ROW_HEIGHT / 2) + 5; // +5 padding

                    if (y > canvas.height) return;

                    // Fade in logic
                    if (trade.alpha < 1) {
                        trade.alpha += 0.1;
                        if (trade.alpha > 1) trade.alpha = 1;
                    }

                    // Color
                    const baseColor = trade.isBuy ? [0, 255, 157] : [255, 0, 85];
                    const isWhale = trade.value > 100000;
                    const isLarge = trade.value > 10000;

                    // Background highlight for whales
                    if (isWhale) {
                        ctx.fillStyle = `rgba(255, 215, 0, ${0.15 * trade.alpha})`;
                        ctx.fillRect(0, index * ROW_HEIGHT, canvas.width, ROW_HEIGHT);
                    } else if (isLarge) {
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.05 * trade.alpha})`;
                        ctx.fillRect(0, index * ROW_HEIGHT, canvas.width, ROW_HEIGHT);
                    }

                    // Text Color
                    ctx.fillStyle = isWhale
                        ? `rgba(255, 215, 0, ${trade.alpha})`
                        : `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${trade.alpha})`;

                    // Draw Columns
                    // Time
                    const date = new Date(trade.time);
                    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
                    ctx.fillStyle = `rgba(150, 150, 150, ${trade.alpha})`;
                    ctx.fillText(timeStr, COLUMNS.TIME, y);

                    // Price
                    ctx.fillStyle = isWhale
                        ? `rgba(255, 215, 0, ${trade.alpha})`
                        : `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${trade.alpha})`;
                    ctx.fillText(trade.price.toFixed(2), COLUMNS.PRICE, y);

                    // Size
                    ctx.fillStyle = `rgba(255, 255, 255, ${trade.alpha})`;
                    ctx.fillText(trade.quantity.toFixed(4), COLUMNS.SIZE, y);

                    // Value (Total)
                    const valStr = trade.value >= 1000 ? `${(trade.value / 1000).toFixed(1)}K` : trade.value.toFixed(0);
                    ctx.fillText(valStr, COLUMNS.TOTAL, y);

                    // Side
                    ctx.fillStyle = trade.isBuy ? `rgba(0, 255, 157, ${trade.alpha})` : `rgba(255, 0, 85, ${trade.alpha})`;
                    ctx.fillText(trade.isBuy ? 'BUY' : 'SELL', COLUMNS.SIDE, y);
                });
            }

            animationFrameRef.current = requestAnimationFrame(render);
        };

        animationFrameRef.current = requestAnimationFrame(render);

        // Stats Interval (1Hz)
        const statsInterval = setInterval(() => {
            const recent = tradesRef.current.slice(0, 100);
            if (recent.length === 0) return;

            // Calc VWAP
            const totalVal = recent.reduce((a, b) => a + b.value, 0);
            const totalVol = recent.reduce((a, b) => a + b.quantity, 0);
            const vwap = totalVol ? totalVal / totalVol : 0;

            // Calc Buy Pressure
            const buyVol = recent.filter(t => t.isBuy).reduce((a, b) => a + b.quantity, 0);
            const buyPressure = totalVol ? (buyVol / totalVol) * 100 : 50;

            // Calc TPS
            const now = Date.now();
            const tps = recent.filter(t => now - t.timestamp < 1000).length;

            setDisplayStats({
                vwap,
                buyPressure,
                tps
            });
        }, 1000);

        return () => {
            if (ws.readyState === WebSocket.OPEN) ws.close();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            clearInterval(statsInterval);
        };
    }, [symbol]);

    return (
        <div ref={containerRef} style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden' }}>
            {/* Header Stats */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 8px',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)'
            }}>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>TPS: </span>
                    <span style={{ color: displayStats.tps > 10 ? 'var(--accent-primary)' : '#fff' }}>
                        {displayStats.tps}
                    </span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>VWAP: </span>
                    <span style={{ color: '#fff' }}>${displayStats.vwap.toFixed(2)}</span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>Buy: </span>
                    <span style={{
                        color: displayStats.buyPressure > 55 ? 'var(--accent-primary)' :
                            displayStats.buyPressure < 45 ? 'var(--accent-danger)' : '#fff'
                    }}>
                        {displayStats.buyPressure.toFixed(0)}%
                    </span>
                </div>
            </div>

            {/* Column Headers */}
            <div style={{
                display: 'flex',
                padding: '4px 0',
                fontSize: '9px',
                color: 'var(--text-muted)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                position: 'relative'
            }}>
                <div style={{ position: 'absolute', left: COLUMNS.TIME }}>Time</div>
                <div style={{ position: 'absolute', left: COLUMNS.PRICE }}>Price</div>
                <div style={{ position: 'absolute', left: COLUMNS.SIZE }}>Size</div>
                <div style={{ position: 'absolute', left: COLUMNS.TOTAL }}>Val</div>
                <div style={{ position: 'absolute', left: COLUMNS.SIDE }}>Side</div>
            </div>

            {/* Canvas */}
            <div style={{ flex: 1, position: 'relative' }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        display: 'block',
                        width: '100%',
                        height: '100%'
                    }}
                />
            </div>
        </div>
    );
};

export default CanvasTimeAndSales;
